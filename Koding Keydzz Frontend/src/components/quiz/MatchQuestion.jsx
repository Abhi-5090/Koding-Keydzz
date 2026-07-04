import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import Button from '../ui/Button'

const PAIR_COLORS = ['#FF602F', '#1FB6A6', '#FF8A4D', '#2DD4BF', '#FF6A3D']

/**
 * Click-to-pair matching. Tap a left item, then a right item to link them.
 * `question.answer` maps leftIndex -> correct rightIndex.
 */
export default function MatchQuestion({ question, onResult }) {
  const [pairs, setPairs] = useState({}) // leftIndex -> rightIndex
  const [activeLeft, setActiveLeft] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const usedRight = new Set(Object.values(pairs))

  const pickLeft = (li) => {
    if (submitted) return
    setActiveLeft(li === activeLeft ? null : li)
  }
  const pickRight = (ri) => {
    if (submitted || activeLeft == null) return
    setPairs((p) => {
      const next = { ...p }
      // remove any existing mapping to this right item
      for (const k of Object.keys(next)) if (next[k] === ri) delete next[k]
      next[activeLeft] = ri
      return next
    })
    setActiveLeft(null)
  }

  const allPaired = Object.keys(pairs).length === question.left.length
  const submit = () => {
    if (submitted) return
    setSubmitted(true)
    const correct = question.left.every((_, li) => pairs[li] === question.answer[li])
    onResult(correct)
  }

  const colorFor = (li) => PAIR_COLORS[li % PAIR_COLORS.length]

  return (
    <div>
      <p className="mb-3 text-sm text-text-secondary">Tap a concept, then tap its match:</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2.5">
          {question.left.map((item, li) => {
            const paired = pairs[li] != null
            const good = submitted && pairs[li] === question.answer[li]
            const bad = submitted && pairs[li] !== question.answer[li]
            return (
              <motion.button
                key={li}
                whileHover={!submitted ? { scale: 1.02 } : {}}
                onClick={() => pickLeft(li)}
                className={`game-text flex w-full items-center gap-2 rounded-xl border-2 px-3 py-3 text-left transition-[background-color,border-color,color,box-shadow] duration-200 ${
                  good
                    ? 'border-success bg-success/15 text-success'
                    : bad
                    ? 'border-error bg-error/10 text-error'
                    : activeLeft === li
                    ? 'border-turmeric bg-turmeric/15'
                    : 'border-k-border bg-surface/50'
                }`}
              >
                {paired && (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: colorFor(li) }}
                  />
                )}
                <span className="flex-1">{item}</span>
              </motion.button>
            )
          })}
        </div>
        <div className="space-y-2.5">
          {question.right.map((item, ri) => {
            const owner = Object.keys(pairs).find((k) => pairs[k] === ri)
            const paired = owner != null
            return (
              <motion.button
                key={ri}
                whileHover={!submitted && activeLeft != null ? { scale: 1.02 } : {}}
                onClick={() => pickRight(ri)}
                disabled={submitted || (activeLeft == null && !paired)}
                className={`game-text flex w-full items-center gap-2 rounded-xl border-2 px-3 py-3 text-left transition-[background-color,border-color,color,box-shadow] duration-200 ${
                  paired ? 'border-k-border bg-surface/80' : 'border-k-border bg-surface/50 hover:border-turmeric'
                } ${usedRight.has(ri) && activeLeft == null ? '' : ''}`}
              >
                {paired && (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: colorFor(Number(owner)) }}
                  />
                )}
                <span className="flex-1">{item}</span>
              </motion.button>
            )
          })}
        </div>
      </div>
      {!submitted && (
        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={!allPaired} className="flex items-center gap-2">
            Check Matches <Check size={18} />
          </Button>
        </div>
      )}
    </div>
  )
}
