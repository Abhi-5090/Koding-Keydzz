import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Bot, Flag } from 'lucide-react'
import { parseLevel } from '../../../games/maze/engine'

const ROBOT_ROTATION = { up: 0, right: 90, down: 180, left: 270 }

/**
 * MazeBoard — responsive CSS-grid maze.
 *  - walls filled, open tiles subtle, goal = pulsing Flag.
 *  - robot is a single absolutely-positioned tile translated cell-to-cell
 *    (transform = hardware accelerated) over ~200ms with var(--ease-out).
 *  - faint trail over visited tiles.
 *  - quick shake on crash; respects prefers-reduced-motion.
 */
export default function MazeBoard({ level, robot, trail, crashing }) {
  const reduce = useReducedMotion()
  const { cols, rows, walls, goal } = useMemo(() => parseLevel(level), [level])

  // Keep tiles comfortably tappable but shrink for big grids. Cell size is
  // resolved against the CONTAINER (.board-fit wrapper) via 100cqi — this
  // board's own inline width — so the grid always fits its column and never
  // overflows into a neighbouring panel. `--cell`/`--gap` stay concrete lengths
  // so the robot token's calc(x * (--cell + --gap)) positioning stays exact.
  const gap = 6
  const cell = `clamp(24px, calc((100cqi - ${(cols - 1) * gap}px) / ${cols}), 56px)`
  const maxBoard = cols * 56 + (cols - 1) * gap

  const trailSet = trail || new Set()

  return (
    <motion.div
      animate={
        crashing && !reduce
          ? { x: [0, -8, 8, -6, 6, -3, 3, 0] }
          : { x: 0 }
      }
      transition={{ duration: 0.42, ease: 'easeInOut' }}
      className="board-fit relative mx-auto w-full rounded-2xl bg-malt p-3"
      style={{ '--cell': cell, '--gap': `${gap}px`, maxWidth: maxBoard + 24 }}
    >
      <div
        className="relative grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, var(--cell))`,
          gridTemplateRows: `repeat(${rows}, var(--cell))`,
          gap: 'var(--gap)',
        }}
      >
        {Array.from({ length: rows }).flatMap((_, y) =>
          Array.from({ length: cols }).map((__, x) => {
            const isWall = walls.has(`${x},${y}`)
            const isGoal = goal.x === x && goal.y === y
            const visited = trailSet.has(`${x},${y}`)
            return (
              <div
                key={`${x},${y}`}
                className={[
                  'flex items-center justify-center rounded-lg transition-colors duration-200',
                  isWall
                    ? 'bg-surface shadow-inner'
                    : 'border border-k-border bg-card/60',
                  visited && !isWall ? 'bg-turmeric/15 border-turmeric/40' : '',
                ].join(' ')}
                style={{ width: 'var(--cell)', height: 'var(--cell)' }}
                aria-hidden="true"
              >
                {isGoal && (
                  <motion.span
                    className="text-success"
                    animate={reduce ? {} : { scale: [1, 1.18, 1], opacity: [0.85, 1, 0.85] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Flag size="58%" strokeWidth={2.4} />
                  </motion.span>
                )}
              </div>
            )
          })
        )}

        {/* Robot — one element, translated to its cell. */}
        <motion.div
          className="pointer-events-none absolute left-0 top-0 z-10 flex items-center justify-center"
          style={{ width: 'var(--cell)', height: 'var(--cell)' }}
          initial={false}
          animate={{
            x: `calc(${robot.x} * (var(--cell) + var(--gap)))`,
            y: `calc(${robot.y} * (var(--cell) + var(--gap)))`,
          }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 0.2, ease: [0.23, 1, 0.32, 1] }
          }
        >
          <motion.span
            className="flex h-[78%] w-[78%] items-center justify-center rounded-lg bg-turmeric text-malt shadow-golden-glow"
            animate={{ rotate: ROBOT_ROTATION[robot.dir] || 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
          >
            <Bot size="62%" strokeWidth={2.5} />
          </motion.span>
        </motion.div>
      </div>
    </motion.div>
  )
}
