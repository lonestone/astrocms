import { getEntry } from 'astro:content'
import config from '../website.config'

export const { langs, defaultLang } = config
export type Lang = (typeof langs)[number]

export async function getTranslations(lang: Lang) {
  const entry = await getEntry('translations', lang)
  return entry!.data as Record<string, string>
}

export function getLangFromUrl(url: URL): Lang {
  const first = url.pathname.split('/')[1]?.replace(/\.html$/, '')
  return langs.includes(first as Lang) ? (first as Lang) : defaultLang
}

export function getLangFromId(id: string): Lang {
  return id.split('/')[1] as Lang
}

export function getSlugFromId(id: string): string {
  return id.split('/')[0]
}
