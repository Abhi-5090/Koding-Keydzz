import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'
import AnimatedIcon from '../ui/AnimatedIcon'

/**
 * Multiple-choice question.
 * Calls onResult(isCorrect) once the user confirms.
 */
export default function McqQuestion({ question, onResult }) {
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)

  const choose = (i) => {
    if (answered) return
    setSelected(i)
    setAnswered(true)
    onResult(i === question.answer)
  }

  return (
    <div>
      <div className="space-y-3">
        {question.options.map((opt, i) => {
          let state = 'idle'
          if (answered) {
            if (i === question.answer) state = 'correct'
            else if (i === selected) state = 'wrong'
          }
          return (
            <motion.button
              key={i}
              whileHover={!answered ? { x: 4 } : {}}
              whileTap={!answered ? { scale: 0.98 } : {}}
              transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
              onClick={() => choose(i)}
              disabled={answered}
              className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-[background-color,border-color,color] duration-200 game-text ${
                state === 'correct'
                  ? 'border-success bg-success/15 text-success'
                  : state === 'wrong'
                  ? 'border-error bg-error/15 text-error'
                  : 'border-k-border bg-surface/50 hover:border-turmeric'
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-malt text-sm font-bold">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{opt}</span>
              {state === 'correct' && <AnimatedIcon icon={CheckCircle2} size={20} animation="pop" className="text-success" />}
              {state === 'wrong' && <AnimatedIcon icon={XCircle} size={20} animation="pop" className="text-error" />}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
