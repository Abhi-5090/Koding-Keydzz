import { useState } from 'react'
import { Check } from 'lucide-react'
import Button from '../ui/Button'

/**
 * Fill-in-the-blank. `question.template` contains one or more "____"
 * placeholders; `question.answer` is an array of accepted strings
 * (matched case-insensitively, in order).
 */
export default function FillBlankQuestion({ question, onResult }) {
  const parts = question.template.split('____')
  const blanks = parts.length - 1
  const [values, setValues] = useState(Array(blanks).fill(''))
  const [submitted, setSubmitted] = useState(false)

  const setVal = (i, v) => {
    setValues((arr) => arr.map((x, idx) => (idx === i ? v : x)))
  }

  const submit = () => {
    if (submitted) return
    setSubmitted(true)
    const correct = values.every(
      (v, i) => v.trim().toLowerCase() === String(question.answer[i] ?? '').trim().toLowerCase()
    )
    onResult(correct)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-k-border bg-malt p-4 font-mono text-sm">
        {parts.map((part, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="text-text-secondary">{part}</span>
            {i < blanks && (
              <input
                value={values[i]}
                onChange={(e) => setVal(i, e.target.value)}
                disabled={submitted}
                className={`w-28 rounded-lg border-2 bg-card px-2 py-1 text-center text-turmeric outline-none ${
                  submitted
                    ? values[i].trim().toLowerCase() ===
                      String(question.answer[i] ?? '').trim().toLowerCase()
                      ? 'border-success'
                      : 'border-error'
                    : 'border-k-border focus:border-turmeric'
                }`}
                placeholder="?"
              />
            )}
          </span>
        ))}
      </div>
      {!submitted && (
        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={values.some((v) => v.trim() === '')} className="flex items-center gap-2">
            Check Answer <Check size={18} />
          </Button>
        </div>
      )}
    </div>
  )
}
