import { useState } from 'react'
import { Reorder } from 'framer-motion'
import { GripVertical, Check } from 'lucide-react'
import Button from '../ui/Button'

/**
 * Drag-to-order question. `question.tiles` is the display order;
 * `question.answer` is an array of original tile indices in correct order.
 */
export default function DragDropQuestion({ question, onResult }) {
  // Each entry carries its original index so we can grade the order.
  const initial = question.tiles.map((label, idx) => ({ id: idx, label }))
  const [order, setOrder] = useState(initial)
  const [submitted, setSubmitted] = useState(false)

  const submit = () => {
    if (submitted) return
    setSubmitted(true)
    const correct = order.every((item, i) => item.id === question.answer[i])
    onResult(correct)
  }

  return (
    <div>
      <p className="mb-3 text-sm text-text-secondary">Drag the tiles into the correct order:</p>
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2.5">
        {order.map((item, i) => {
          const good = submitted && item.id === question.answer[i]
          const bad = submitted && item.id !== question.answer[i]
          return (
            <Reorder.Item
              key={item.id}
              value={item}
              className={`game-text flex cursor-grab items-center gap-3 rounded-xl border-2 px-4 py-3 active:cursor-grabbing ${
                good
                  ? 'border-success bg-success/15 text-success'
                  : bad
                  ? 'border-error bg-error/10 text-error'
                  : 'border-k-border bg-surface/50 hover:border-turmeric'
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-malt text-sm font-bold text-turmeric">
                {i + 1}
              </span>
              <span className="flex-1">{item.label}</span>
              <GripVertical size={18} className="text-text-secondary" />
            </Reorder.Item>
          )
        })}
      </Reorder.Group>
      {!submitted && (
        <div className="mt-4 flex justify-end">
          <Button onClick={submit} className="flex items-center gap-2">Check Order <Check size={18} /></Button>
        </div>
      )}
    </div>
  )
}
