import React, { useState } from 'react'
import type { PendingPermission } from '../../../api.js'
import { respondToPermission } from '../../../api.js'

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

  function buildAnswer(qIndex: number, q: Question): string | null {
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

  const allAnswered = questions.every(
    (q, i) => buildAnswer(i, q) !== null
  )

  async function submit() {
    if (!allAnswered || submitting) return
    setSubmitting(true)
    const answers: Record<string, string> = {}
    questions.forEach((q, i) => {
      const a = buildAnswer(i, q)
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
    <div className="mx-3 mb-3 rounded-md border border-indigo-300 bg-indigo-50 overflow-hidden">
      <div className="px-3 py-2 border-b border-indigo-200">
        <div className="text-[11px] font-semibold text-indigo-900">
          Claude needs your input
        </div>
      </div>
      <div className="px-3 py-2 flex flex-col gap-3">
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
      <div className="px-3 py-2 border-t border-indigo-200 flex gap-2">
        <button
          onClick={submit}
          disabled={submitting || !allAnswered}
          className="px-3 py-1 text-[11px] font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          aria-label="Submit answers"
          tabIndex={0}
        >
          Submit
        </button>
        <button
          onClick={cancel}
          disabled={submitting}
          className="px-3 py-1 text-[11px] font-semibold rounded border border-indigo-300 text-indigo-800 hover:bg-indigo-100 disabled:opacity-50 cursor-pointer"
          aria-label="Dismiss question"
          tabIndex={0}
        >
          Dismiss
        </button>
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
      <legend className="flex items-center gap-1.5 mb-1">
        {question.header && (
          <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-200 text-indigo-900 text-[9px] font-semibold uppercase tracking-wide">
            {question.header}
          </span>
        )}
        <span className="text-[11px] font-medium text-indigo-900">
          {question.question}
        </span>
      </legend>
      {question.options.map((opt) => {
        const isSelected = selected.includes(opt.label)
        return (
          <label
            key={opt.label}
            className={`flex items-start gap-2 px-2 py-1.5 rounded border text-[11px] cursor-pointer ${
              isSelected
                ? 'border-indigo-400 bg-indigo-100'
                : 'border-indigo-200 bg-white hover:bg-indigo-50'
            }`}
          >
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={question.question}
              checked={isSelected}
              onChange={() => onToggle(opt.label)}
              className="mt-0.5 accent-indigo-600"
            />
            <span className="flex-1 min-w-0">
              <span className="font-medium text-indigo-900">{opt.label}</span>
              {opt.description && (
                <span className="block text-[10px] text-indigo-700 mt-0.5">
                  {opt.description}
                </span>
              )}
            </span>
          </label>
        )
      })}
      <OtherOption
        multi={multi}
        questionName={question.question}
        selected={selected.includes(OTHER_KEY)}
        text={otherText}
        onToggle={() => onToggle(OTHER_KEY)}
        onChange={onOtherChange}
      />
    </fieldset>
  )
}

function OtherOption({
  multi,
  questionName,
  selected,
  text,
  onToggle,
  onChange,
}: {
  multi: boolean
  questionName: string
  selected: boolean
  text: string
  onToggle: () => void
  onChange: (text: string) => void
}) {
  return (
    <label
      className={`flex items-start gap-2 px-2 py-1.5 rounded border text-[11px] cursor-pointer ${
        selected
          ? 'border-indigo-400 bg-indigo-100'
          : 'border-indigo-200 bg-white hover:bg-indigo-50'
      }`}
    >
      <input
        type={multi ? 'checkbox' : 'radio'}
        name={questionName}
        checked={selected}
        onChange={onToggle}
        className="mt-0.5 accent-indigo-600"
      />
      <span className="flex-1 min-w-0">
        <span className="font-medium text-indigo-900">Other</span>
        {selected && (
          <input
            type="text"
            value={text}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your answer..."
            className="mt-1 w-full px-2 py-1 text-[11px] border border-indigo-300 rounded bg-white outline-none focus:border-indigo-500"
            autoFocus
          />
        )}
      </span>
    </label>
  )
}
