import { motion } from 'framer-motion'
import { Eraser } from 'lucide-react'
import { BOARD_MUTED, BOARD_SURFACE } from '../../../theme/tokens'

/**
 * SudokuNumberPad — the 1..size buttons plus an erase button. Each number
 * shows how many of it are still left to place (helps younger players).
 *
 * Props:
 *   size, onPick(value), onErase, remaining { [value]: count left }, disabled
 *   tint
 */
export default function SudokuNumberPad({ size, onPick, onErase, remaining = {}, disabled, tint = '#2DD4BF' }) {
  const nums = Array.from({ length: size }, (_, i) => i + 1)
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {nums.map((n) => {
        const left = remaining[n] ?? size
        const done = left <= 0
        return (
          <motion.button
            key={n}
            type="button"
            disabled={disabled || done}
            onClick={() => onPick(n)}
            whileTap={disabled || done ? undefined : { scale: 0.92 }}
            className="relative flex h-12 w-12 items-center justify-center rounded-xl border-2 font-game text-xl font-extrabold transition-colors duration-150 disabled:opacity-40 sm:h-14 sm:w-14"
            style={{
              borderColor: done ? BOARD_SURFACE : `${tint}66`,
              background: done ? 'transparent' : `${tint}18`,
              color: done ? BOARD_MUTED : tint,
            }}
            aria-label={`Place ${n}, ${left} left`}
          >
            {n}
            {!done && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-surface px-1 text-[9px] font-bold text-text-secondary">
                {left}
              </span>
            )}
          </motion.button>
        )
      })}
      <motion.button
        type="button"
        disabled={disabled}
        onClick={onErase}
        whileTap={disabled ? undefined : { scale: 0.92 }}
        className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-error/50 bg-error/10 text-error transition-colors duration-150 disabled:opacity-40 sm:h-14 sm:w-14"
        aria-label="Erase selected cell"
      >
        <Eraser size={20} />
      </motion.button>
    </div>
  )
}
