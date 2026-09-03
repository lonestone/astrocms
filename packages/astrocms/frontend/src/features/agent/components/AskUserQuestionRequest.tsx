import React, { useState } from 'react'
import { TbMessageQuestion } from 'react-icons/tb'
import type { PendingPermission } from '../../../api.js'
import { respondToPermission } from '../../../api.js'
import Button from '../../common/components/Button.js'
import { inputCompactClass } from '../../common/components/Input.js'

interface Option {
  label: string
  description?: string
  preview?: string
}

interface Question {
  question: string
  header?: string
  options: Option[]
  multiSelect?: boolean
}

interface Props {
  permission: PendingPermission
  onResolved: () => void
}

const OTHER_KEY = '__other__'

export function AskUserQuestionRequest({ permission, onResolved }: Props) {
  const questions = (permission.input?.questions as Question[] | undefined) ?? []
  const [selections, setSelections] = useState<string[][]>(() =>
    questions.map(() => [])
  )
  const [otherText, setOtherText] = useState<string[]>(() =>
    questions.map(() => '')
  )
  const [submitting, setSubmitting] = useState(false)

  function toggle(qIndex: number, label: string, multi: boolean) {
    setSelections((prev) => {
      const next = prev.map((s) => [...s])
      const current = next[qIndex]
      const idx = current.indexOf(label)
      if (multi) {
        if (idx >= 0) current.splice(idx, 1)
        else current.push(label)
      } else {
        next[qIndex] = idx >= 0 ? [] : [label]
      }
      return next
    })
  }

  function buildAnswer(qIndex: number): string | null {
    const picked = selections[qIndex]
    const hasOther = picked.includes(OTHER_KEY)
    const labels = picked.filter((l) => l !== OTHER_KEY)
    if (hasOther) {
      const text = otherText[qIndex]?.trim()
      if (!text) return null
      labels.push(text)
    }
    if (labels.length === 0) return null
    return labels.join(', ')
  }

  const allAnswered = questions.every((_, i) => buildAnswer(i) !== null)

  async function submit() {
    if (!allAnswered || submitting) return
    setSubmitting(true)
    const answers: Record<string, string> = {}
    questions.forEach((q, i) => {
      const a = buildAnswer(i)
      if (a !== null) answers[q.question] = a
    })
    await respondToPermission(permission.id, 'allow', {
      updatedInput: { ...permission.input, answers },
    })
    onResolved()
  }

  async function cancel() {
    if (submitting) return
    setSubmitting(true)
    await respondToPermission(permission.id, 'deny', {
      message: 'User dismissed the question',
    })
    onResolved()
  }

  if (questions.length === 0) {
    return null
  }

  return (
    <div className="mb-3 overflow-hidden rounded-panel border border-accent/30 bg-surface-raised animate-pop-in">
      <div className="flex items-center gap-2 border-b border-border bg-accent-soft px-3 py-2">
        <TbMessageQuestion size={16} className="text-accent-text" />
        <span className="text-xs font-semibold text-accent-text">
          Claude needs your input
        </span>
      </div>
      <div className="flex flex-col gap-4 px-3 py-3">
        {questions.map((q, qi) => (
          <QuestionField
            key={qi}
            question={q}
            selected={selections[qi] ?? []}
            otherText={otherText[qi] ?? ''}
            onToggle={(label) => toggle(qi, label, !!q.multiSelect)}
            onOtherChange={(text) =>
              setOtherText((prev) => {
                const next = [...prev]
                next[qi] = text
                return next
              })
            }
          />
        ))}
      </div>
      <div className="flex gap-2 border-t border-border bg-surface px-3 py-2">
        <Button
          variant="primary"
          onClick={submit}
          disabled={submitting || !allAnswered}
        >
          Submit
        </Button>
        <Button variant="ghost" onClick={cancel} disabled={submitting}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}

function QuestionField({
  question,
  selected,
  otherText,
  onToggle,
  onOtherChange,
}: {
  question: Question
  selected: string[]
  otherText: string
  onToggle: (label: string) => void
  onOtherChange: (text: string) => void
}) {
  const multi = !!question.multiSelect

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 flex flex-col gap-1">
        {question.header && (
          <span className="self-start rounded-full bg-surface-active px-1.5 py-0.5 text-xs font-medium text-text-secondary">
            {question.header}
          </span>
        )}
        <span className="text-ui font-medium text-text">
          {question.question}
        </span>
      </legend>
      {question.options.map((opt) => (
        <OptionRow
          key={opt.label}
          multi={multi}
          questionName={question.question}
          selected={selected.includes(opt.label)}
          onToggle={() => onToggle(opt.label)}
          label={opt.label}
          description={opt.description}
        />
      ))}
      <OptionRow
        multi={multi}
        questionName={question.question}
        selected={selected.includes(OTHER_KEY)}
        onToggle={() => onToggle(OTHER_KEY)}
        label="Other"
      >
        {selected.includes(OTHER_KEY) && (
          <input
            type="text"
            value={otherText}
            onChange={(e) => onOtherChange(e.target.value)}
            placeholder="Type your answer"
            className={`${inputCompactClass} mt-1.5`}
            autoFocus
          />
        )}
      </OptionRow>
    </fieldset>
  )
}

function OptionRow({
  multi,
  questionName,
  selected,
  onToggle,
  label,
  description,
  children,
}: {
  multi: boolean
  questionName: string
  selected: boolean
  onToggle: () => void
  label: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-ui transition-colors duration-100 ${
        selected
          ? 'border-accent bg-accent-soft'
          : 'border-border bg-surface-raised hover:bg-surface-hover'
      }`}
    >
      <input
        type={multi ? 'checkbox' : 'radio'}
        name={questionName}
        checked={selected}
        onChange={onToggle}
        className="mt-0.5 accent-accent"
      />
      <span className="min-w-0 flex-1">
        <span className="font-medium text-text">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-text-muted">
            {description}
          </span>
        )}
        {children}
      </span>
    </label>
  )
}
