# Testplan: Komponenten-Parser (JS-Compiler-API)

Ziel: Die Laufzeit-Nutzung der TypeScript-JS-Compiler-API in
`packages/astrocms/backend/parsers/components.ts` durch Tests absichern, damit der
Parser anschließend auf eine aktuelle Toolchain (TS 7 / tsgo ohne JS-Compiler-API)
umgestellt werden kann, ohne dass Verhalten verloren geht.

## 1. Analyse: Wo wird die JS-Compiler-API genutzt?

Nur eine Datei nutzt sie zur Laufzeit: `packages/astrocms/backend/parsers/components.ts`.

Genutzte APIs (Paket `typescript`, installiert: 5.9.3, aktuellste v5):

- `ts.createSourceFile('props.ts', frontmatter, ts.ScriptTarget.Latest, true)`
  parst die Frontmatter einer `.astro`-Datei als TypeScript-Quelltext.
- `ts.forEachChild` + `ts.isInterfaceDeclaration` finden das `interface Props`.
- `node.members.filter(ts.isPropertySignature)` extrahiert die Prop-Signaturen.
- Typauflösung über Type-Guards: `isUnionTypeNode`, `isLiteralTypeNode`,
  `isStringLiteral`, `isTypeReferenceNode`, `isArrayTypeNode`, `isIdentifier` sowie
  `SyntaxKind`-Checks für die Keywords `string`, `number`, `boolean`.

Keine weitere Laufzeit-Nutzung im Repo (per Suche verifiziert). Der Frontend-Build
läuft über Vite/esbuild, ein `tsc`-Typecheck-Skript existiert nicht. Die
`typescript`-Dependency dient also genau zwei Zwecken: dem Laufzeit-Parser und der
Editor-IntelliSense. Solange `components.ts` die Compiler-API nutzt, blockiert sie
den Sprung auf TS 7 (tsgo liefert die JS-Compiler-API nicht mehr mit).

Verbrauchte Datenstruktur (Backend, `components.ts`):

```ts
interface PropSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'json' | 'image'
  optional?: boolean
  options?: string[]
  itemSchema?: PropSchema[]
}

interface ComponentDescriptor { name: string; props: PropSchema[]; slots: string[] }
```

Hinweis am Rande: Das Frontend (`frontend/src/api.ts`) kennt zusätzlich die Typen
`date`, `string-array` und `object`. Der Backend-Parser produziert sie nie. Das
bleibt außerhalb dieses Plans.

## 2. Designprinzip der Tests

Die Tests sichern den **Verhaltensvertrag** dreier Funktionen ab, nicht die
Implementierung:

- `parseProps(frontmatter): PropSchema[]` (heute privat, wird exportiert)
- `parseSlots(source): string[]` (heute privat, wird exportiert)
- `scanComponents(): ComponentDescriptor[]` (bereits exportiert)

Die Tests importieren nie `typescript`. Nach der Migration ändert sich nur die
Implementierung in `components.ts`, das Testset bleibt unverändert und dient als
Regressionsnetz.

Zwei Testarten:

- **Vertrags-Tests**: prüfen das beabsichtigte Verhalten (Typ-Mapping, Slot-Erkennung).
- **Charakterisierungs-Tests**: fixieren das aktuelle Verhalten an Stellen, die
  überraschend oder fragil sind (Fehlererholung des Parsers, `---` in der
  Frontmatter). Vorgehen: einmal gegen die aktuelle Implementierung ausführen, das
  tatsächliche Ergebnis notieren und dann als Erwartungswert fixieren.

## 3. Test-Infrastruktur

**Runner: Vitest.** Passt zur bestehenden Vite 8-Stack, native ESM/TS-Unterstützung
(Paket ist `"type": "module"`), `vi.resetModules()` für die unten beschriebene
Umgang mit Umgebungsvariablen.

Änderungen in `packages/astrocms/package.json`:

- devDependency: `vitest` (aktuelle stabile Version)
- Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`

Neue Datei `packages/astrocms/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

**Test-Ort:** neue Top-Level-Dateien unter `packages/astrocms/tests/parsers/`.
Der npm-`files`-Whitelist (`backend`, `shared`, `dist`, `bin`, `patches`) zufolge
gelangen sie so nicht ins publizierte Paket.

**Testbarkeit-Refactoring (ohne Verhaltensänderung):** `parseProps` und
`parseSlots` in `components.ts` exportieren.

**Umgang mit der Umgebungsabhängigkeit von `scanComponents`:**
`ROOT_DIR` ist ein Modul-Konstante (aus `ASTROCMS_ROOT`, beim Import aufgelöst) und
`loadConfig()` cached pro Modulinstanz. Muster für die Scan-Tests:

```ts
process.env.ASTROCMS_ROOT = tmpDir   // vor dem Import setzen
vi.resetModules()
const { scanComponents } = await import('../../backend/parsers/components.js')
// afterEach: delete process.env.ASTROCMS_ROOT; vi.resetModules()
```

Temp-Verzeichnisse via `fs.mkdtemp(join(os.tmpdir(), 'astrocms-test-'))`, Aufräumen
in `afterAll`.

## 4. Testfälle: `parseProps` (Kern der TS-Compiler-API)

Datei: `packages/astrocms/tests/parsers/components.test.ts`
Tabelle: Frontmatter-String → erwartetes `PropSchema[]`.

| # | Frontmatter (Auszug) | Erwartet | Art |
|---|---|---|---|
| P1 | `''` (leer) | `[]` | Vertrag |
| P2 | `const x = 1` (kein Interface) | `[]` | Vertrag |
| P3 | `interface Foo { a: string }` (nur anderes Interface) | `[]` | Vertrag |
| P4 | `interface Props { title: string }` | `[{ name: 'title', type: 'string' }]` | Vertrag |
| P5 | `interface Props { title?: string }` | `[{ name: 'title', type: 'string', optional: true }]` | Vertrag |
| P6 | `count: number; active: boolean` | `[{ count, 'number' }, { active, 'boolean' }]` | Vertrag |
| P7 | `variant?: 'dark' \| 'light'` | `{ name: 'variant', type: 'select', optional: true, options: ['dark', 'light'] }` (Reihenfolge erhalten) | Vertrag |
| P8 | `x: string \| number` (gemischte Union) | `{ name: 'x', type: 'string' }` (Fallback) | Vertrag |
| P9 | `cover: ImagePath` | `{ name: 'cover', type: 'image' }` | Vertrag |
| P10 | `interface Item { label: string; count?: number }` + `items: Item[]` | `{ name: 'items', type: 'json', itemSchema: [{ label, 'string' }, { count, 'number', optional: true }] }` | Vertrag |
| P11 | `items: Array<Item>` (gleiche Interfaces wie P10) | identisch zu P10 | Vertrag |
| P12 | `tags: string[]` (Array von Primitiven) | `{ name: 'tags', type: 'json' }` (ohne `itemSchema`) | Vertrag |
| P13 | `items: Unknown[]` (`Unknown` nicht lokal definiert) | `{ name: 'items', type: 'json' }` (ohne `itemSchema`) | Vertrag |
| P14 | `lang?: Lang` (`Lang` extern importiert, nicht lokal) | `{ name: 'lang', type: 'string', optional: true }` (Fallback) | Vertrag |
| P15 | `foo;` (keine Typannotation) | `{ name: 'foo', type: 'string' }` | Charakterisierung |
| P16 | `"foo-bar": string` (quoted Name) | `{ name: 'foo-bar', type: 'string' }` (funktioniert über `StringLiteral.text`) | Charakterisierung |
| P17 | `readonly title: string` | `{ name: 'title', type: 'string' }` (wird mitgenommen) | Vertrag |
| P18 | `title: string; getLabel(): string` (Method-Signatur) | nur `{ title, 'string' }`, Methode wird übersprungen | Vertrag |
| P19 | `interface Base { a: string }` + `interface Props extends Base { b: number }` | nur `{ b, 'number' }` (geerbte Member werden ignoriert) | Charakterisierung |
| P20 | `type Props = { a: string }` (Type-Alias statt Interface) | `[]` | Vertrag |
| P21 | `interface Props { a: }` (ungültiges TS) | wirft keine Exception; Ergebnis wird einmalig notiert und fixiert (Fehlererholung von `createSourceFile`) | Charakterisierung |
| P22 | CRLF-Zeilenenden in der Frontmatter | identisch zu LF-Variante (P4) | Vertrag |

## 5. Testfälle: `parseSlots`

Gleiche Datei wie oben. Eingabe ist die komplette `.astro`-Quelle (Frontmatter +
Template), Ausgabe `string[]`. `''` steht für den Default-Slot.

| # | Quelle (Auszug) | Erwartet | Art |
|---|---|---|---|
| S1 | kein Frontmatter, `<div>hi</div>` | `[]` | Vertrag |
| S2 | Template mit `<slot />` | `['']` | Vertrag |
| S3 | `<slot name="footer" />` | `['footer']` | Vertrag |
| S4 | `<slot name="a" /><slot /><slot name="a" />` | `['a', '']` (Dedup, Reihenfolge der ersten Erwähnung) | Vertrag |
| S5 | Frontmatter: `Astro.slots.render('footer')`, Template ohne Slot-Tag | `['footer']` | Vertrag |
| S6 | Frontmatter: `Astro.slots.has('header')` | `['header']` | Vertrag |
| S7 | Frontmatter: `Astro.slots.render('default')` + Template `<slot />` | `['']` (`'default'` wird zu `''` normalisiert, dedupliziert) | Vertrag |
| S8 | Template `<slot name="b" />` + Frontmatter `Astro.slots.render('a')` | `['b', 'a']` (Template-Slots zuerst, dann API-Aufrufe) | Vertrag |
| S9 | Frontmatter enthält die Zeichenkette `'<slot name="x" />'`, Template ohne Slot | `[]` (Tags in der Frontmatter werden ignoriert) | Vertrag |
| S10 | Template enthält `Astro.slots.render('x')`, kein Slot-Tag | `[]` (API-Aufrufe im Template werden ignoriert) | Vertrag |
| S11 | `Astro.slots.render("footer")` (Doppelquotes) und `<slot name="x">content</slot>` (geschlossenes Tag) | `['footer', 'x']` bzw. `['x']` je nach Kombination | Vertrag |
| S12 | `<slot {...rest} />` (Attribute ohne `name`) | `['']` | Vertrag |
| S13 | Frontmatter mit wörtlichem `---` in einer YAML-String-Zeile | Verhalten wird einmalig notiert und fixiert (Split auf `'---'` ist fragil) | Charakterisierung |

## 6. Integrationstests: `scanComponents` (Temp-Verzeichnis)

Datei: `packages/astrocms/tests/parsers/components-scan.test.ts`
Fixture pro Test (bzw. geteilt in `beforeAll`) im Temp-Verzeichnis:

```
tmp/
  astrocms.json            { "componentsDir": "src/components" }
  src/
    components/
      A.astro              (Props: string + select, Default-Slot)
      sub/
        B.astro            (Props: json mit itemSchema, benannter Slot)
      notes.txt            (muss ignoriert werden)
```

| # | Test | Erwartet |
|---|---|---|
| C1 | Rekursion + Filter auf `.astro` | Namen enthalten `A` und `B`, nicht `notes.txt` |
| C2 | Descriptor-Inhalt | Props/Slots von `A` und `B` stimmen mit dem Output der Unit-Tests überein |
| C3 | Wildcard-Descriptor | `{ name: '*', props: [], slots: [''] }` ist vorhanden |
| C4 | Sortierung | Namen sind nach `localeCompare` sortiert (Reihenfolge der Namen prüfen, nicht die exakte Position des Wildcards) |
| C5 | `astrocms.json` ohne `componentsDir` | nur der Wildcard-Descriptor |
| C6 | kein `astrocms.json` im Root | nur der Wildcard-Descriptor (Default) |
| C7 | Name = Basisname ohne Pfad | `sub/B.astro` liefert den Namen `B`, nicht `sub/B` |
| C8 | Namenskonflikt in zwei Unterverzeichnissen (zwei `C.astro`) | beide Einträge vorhanden, keine Deduplizierung | Charakterisierung |

## 7. Golden-Test gegen `example/`

Datei: `packages/astrocms/tests/parsers/example-golden.test.ts`
Setzt `ASTROCMS_ROOT` auf das Repo-Verzeichnis `example/` (read-only, nichts
schreiben) und ruft `scanComponents()` auf. `componentsDir` ist dort
`src/components`, also Button, Header und Section (BaseLayout liegt in `layouts/`
und wird nicht gescannt).

Erwartete Descriptoren (von Hand aus den Quelldateien abgeleitet):

- `Button`: props `{ label, 'string' }`, `{ href, 'string', optional: true }`,
  `{ variant, 'select', options: ['dark', 'light'], optional: true }`, slots `[]`
- `Header`: props `{ lang, 'string', optional: true }` (`Lang` ist extern
  importiert und fällt auf `string` zurück), slots `[]`
- `Section`: props `{ variant, 'select', options: ['light', 'dark'], optional: true }`,
  slots `['']`
- Wildcard `{ name: '*', props: [], slots: [''] }`

Abgleich per expliziten Assertions (klarer als Snapshot bei so wenigen Werten),
optional zusätzlich ein `toMatchSnapshot()` als Zweitabsicherung.

## 8. Migrationsplan (nachdem die Tests grün sind)

Die Tests definieren den Vertrag, deshalb kann der Parser hinter denselben
Funktursignaturen (`parseProps`, `parseSlots`) ausgetauscht werden. Kandidaten:

**Option A: `@babel/parser` mit TypeScript-Plugin (empfohlen)**
Reines JS, keine nativen Binaries. `parse(frontmatter, { sourceType: 'module',
plugins: ['typescript'] })` liefert einen AST; der Walk ist für das schmale Muster
(`Program.body` → `TSInterfaceDeclaration` mit Name `Props` →
`TSPropertySignature`) handwerklich einfach, ohne `@babel/traverse`. Passt sauber
in den Docker-Build (`node:22-slim`, frisches `npm install` ohne Lockfile), weil
keine plattformspezifischen Prebuilds aufgelöst werden müssen.

**Option B: `@swc/core`**
Rust-basiert, schnellster Parser. `parseSync(frontmatter, { syntax: 'typescript' })`,
Walk über `Module.body` → `InterfaceDecl`. Prebuilt glibc-Binaries laufen auf
`node:22-slim`, aber es kommt eine native Dependency mit Plattform-Matrix ins Spiel.
Für die hier gescannten kleinen Dateien ist der Geschwindigkeitsvorteil irrelevant.

**Option C: `@oxc-parser`**
Rust-basiert, ähnlich SWC, jüngeres Ökosystem. Gleiche Abwägung wie B.

**Option D: `typescript@5` behalten (Baseline)**
Keine Migration, die Blockade bleibt. Dient als Referenz: Die Tests müssen auch
gegen die heutige Implementierung grün sein, bevor eine Option gewählt wird.

Empfehlung: **Option A**. Null native Dependencies, minimale API-Oberfläche, und
der Parser bleibt ein isoliertes Modul mit demselben Vertrag.

Ablauf der Migration:

1. Testset aus Abschnitt 3 bis 7 ist grün gegen die aktuelle Implementierung (TS 5.9.3).
2. Neue Parser-Implementierung (Babel) hinter `parseProps`/`parseSlots` schreiben,
   `import * as ts from 'typescript'` aus `components.ts` entfernen.
3. Testset erneut grün (ohne Änderungen an den Tests).
4. `typescript` aus `dependencies` in `devDependencies` verschieben (nur noch
   Editor-IntelliSense) oder direkt auf 7 bumpen.
5. `npm install` lokal und im Docker-Build verifizieren (frische Auflösung ohne
   Lockfile).
6. Optional: ein `typecheck`-Skript (`tsc --noEmit`) ergänzen, das heute fehlt.
   Mit TS 7 wäre tsgo dann der Typecheck-Pfad.

## 9. Meilensteine

| Schritt | Inhalt | Ergebnis |
|---|---|---|
| M1 | Vitest einrichten, `parseProps`/`parseSlots` exportieren, Unit-Tests P1 bis P22 | Kern der Compiler-API abgesichert |
| M2 | Unit-Tests S1 bis S13 (`parseSlots`) | Slot-Erkennung abgesichert |
| M3 | Integrationstests C1 bis C8 (`scanComponents`, Temp-Verzeichnis) | Scan + Config-Auflösung abgesichert |
| M4 | Golden-Test gegen `example/` | Reales Verhalten fixiert |
| M5 | Migration (Option A), `typescript` auf 7 bumpen, Docker-Build verifiziert | TS-7-Blockade gelöst |
