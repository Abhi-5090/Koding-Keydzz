import { motion } from 'framer-motion'
import { Crown } from 'lucide-react'
import useGridKeyboardNav from '../../../games/shared/useGridKeyboardNav'
import { BOARD_MUTED, CONFLICT } from '../../../theme/tokens'

/**
 * NQueensBoard — an N x N checkerboard. Tap a square to place/remove a queen.
 * Squares under attack glow red; attacking queens render in the error color;
 * fixed (pre-placed) queens are locked and styled distinctly.
 *
 * Props:
 *   n
 *   queens      Array<{ r, c }>  (includes fixed)
 *   fixedSet    Set<"r,c">       immovable queens
 *   conflictSet Set<"r,c">       queens currently attacking each other
 *   attackedSet Set<"r,c">       empty squares under attack
 *   onToggle(r, c)
 *   tint
 */
export default function NQueensBoard({
  n,
  queens,
  fixedSet,
  conflictSet,
  attackedSet,
  onToggle,
  tint = '#FF8A4D',
}) {
  const queenAt = new Map(queens.map((q) => [`${q.r},${q.c}`, q]))
  const maxPx = n <= 5 ? 360 : n <= 6 ? 408 : 456

  // Arrow-key navigation across the board (roving tabindex).
  const kb = useGridKeyboardNav({ rows: n, cols: n })

  return (
    <div className="mx-auto w-full" style={{ maxWidth: maxPx }}>
      <div
        className="grid overflow-hidden rounded-xl border-2"
        style={{
          gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
          borderColor: `${tint}99`,
        }}
        role="grid"
        aria-label={`${n} by ${n} queens board. Use the arrow keys to move, then press Enter to place or remove a queen.`}
        {...kb.containerProps}
      >
        {Array.from({ length: n }).map((_, r) =>
          Array.from({ length: n }).map((__, c) => {
            const k = `${r},${c}`
            const hasQueen = queenAt.has(k)
            const fixed = fixedSet.has(k)
            const conflicted = conflictSet.has(k)
            const attacked = attackedSet.has(k)
            const dark = (r + c) % 2 === 1

            let bg = dark ? 'rgba(10,46,60,0.9)' : 'rgba(4,33,46,0.55)'
            if (attacked && !hasQueen) bg = 'rgba(255,84,112,0.18)'

            return (
              <motion.button
                key={k}
                type="button"
                role="gridcell"
                {...kb.cellProps(r, c)}
                onClick={() => onToggle(r, c)}
                whileTap={fixed ? undefined : { scale: 0.88 }}
                className="relative flex aspect-square items-center justify-center transition-colors duration-150 focus-visible:z-10"
                style={{ background: bg, cursor: fixed ? 'default' : 'pointer' }}
                aria-label={`Row ${r + 1} column ${c + 1}${
                  hasQueen ? (fixed ? ', fixed queen' : ', queen') : attacked ? ', under attack' : ', empty'
                }`}
                aria-pressed={hasQueen}
              >
                {/* attack marker on empty threatened squares */}
                {attacked && !hasQueen && (
                  <span className="h-1.5 w-1.5 rounded-full bg-error/70" />
                )}
                {hasQueen && (
                  <motion.span
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 460, damping: 16 }}
                    style={{
                      color: conflicted ? CONFLICT : fixed ? BOARD_MUTED : tint,
                      filter: conflicted
                        ? 'drop-shadow(0 0 6px rgba(255,84,112,0.8))'
                        : `drop-shadow(0 0 6px ${tint}aa)`,
                    }}
                  >
                    <Crown
                      size={n >= 7 ? 22 : 28}
                      strokeWidth={2.25}
                      fill={fixed ? '#9DB8C433' : conflicted ? '#FF547033' : `${tint}33`}
                    />
                  </motion.span>
                )}
              </motion.button>
            )
          })
        )}
      </div>
    </div>
  )
}
