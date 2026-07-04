import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Bot, Target } from 'lucide-react'
import { parseLevel } from '../../../games/robot/engine'

// The Bot glyph points up by default; rotate it to face the last move direction.
const ROBOT_ROTATION = { up: 0, right: 90, down: 180, left: 270 }

/**
 * RobotBoard — responsive CSS-grid arena for Robot Navigation.
 *
 * Renders walls, the goal (pulsing Target), ×2 / ÷2 power tiles (clear badges),
 * a faint visited trail, and the robot as a single translated element that
 * jumps cell-to-cell. A `blocked` bump shakes the board. Power-2 lands two cells
 * away so the transform animation reads as a real leap.
 *
 * Props:
 *   level, robot:{x,y,dir,power}, trail:Set<'x,y'>, blocked:boolean
 */
export default function RobotBoard({ level, robot, trail, blocked }) {
  const reduce = useReducedMotion()
  const { cols, rows, walls, powerUp, powerDown, goal } = useMemo(
    () => parseLevel(level),
    [level]
  )

  const gap = 6
  // Cell size is resolved against the CONTAINER (the .board-fit wrapper), never
  // the viewport: 100cqi is this board's own inline width, so the grid always
  // fits its column at any screen width. `--cell`/`--gap` stay concrete lengths
  // so the token's calc(x * (--cell + --gap)) positioning remains exact.
  const cell = `clamp(26px, calc((100cqi - ${(cols - 1) * gap}px) / ${cols}), 60px)`
  // Cap the board so it never sprawls on ultrawide screens.
  const maxBoard = cols * 60 + (cols - 1) * gap
  const trailSet = trail || new Set()
  const powered = robot.power === 2

  return (
    <motion.div
      animate={blocked && !reduce ? { x: [0, -7, 7, -5, 5, -2, 0] } : { x: 0 }}
      transition={{ duration: 0.36, ease: 'easeInOut' }}
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
            const k = `${x},${y}`
            const isWall = walls.has(k)
            const isGoal = goal.x === x && goal.y === y
            const isUp = powerUp.has(k)
            const isDown = powerDown.has(k)
            const visited = trailSet.has(k)
            return (
              <div
                key={k}
                className={[
                  'flex items-center justify-center rounded-lg transition-colors duration-200',
                  isWall
                    ? 'bg-surface shadow-inner'
                    : 'border border-k-border bg-card/60',
                  visited && !isWall && !isUp && !isDown ? 'border-accent/40 bg-accent/15' : '',
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
                    <Target size="58%" strokeWidth={2.4} />
                  </motion.span>
                )}
                {isUp && !isGoal && (
                  <span className="rounded-md border border-accent/60 bg-accent/15 px-1.5 py-0.5 text-[clamp(10px,3cqi,15px)] font-extrabold leading-none text-accent">
                    ×2
                  </span>
                )}
                {isDown && !isGoal && (
                  <span className="rounded-md border border-error/60 bg-error/15 px-1.5 py-0.5 text-[clamp(10px,3cqi,15px)] font-extrabold leading-none text-error">
                    ÷2
                  </span>
                )}
              </div>
            )
          })
        )}

        {/* Robot — one element translated to its cell, GPU-accelerated. */}
        <motion.div
          className="pointer-events-none absolute left-0 top-0 z-10 flex items-center justify-center"
          style={{ width: 'var(--cell)', height: 'var(--cell)' }}
          initial={false}
          animate={{
            x: `calc(${robot.x} * (var(--cell) + var(--gap)))`,
            y: `calc(${robot.y} * (var(--cell) + var(--gap)))`,
          }}
          transition={reduce ? { duration: 0 } : { duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        >
          <motion.span
            className={[
              'flex h-[80%] w-[80%] items-center justify-center rounded-xl text-malt',
              powered ? 'bg-accent shadow-golden-glow-lg' : 'bg-turmeric shadow-golden-glow',
            ].join(' ')}
            animate={{
              rotate: ROBOT_ROTATION[robot.dir] || 0,
              scale: powered && !reduce ? [1, 1.08, 1] : 1,
            }}
            transition={{
              rotate: reduce ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' },
              scale: reduce ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' },
            }}
          >
            <Bot size="62%" strokeWidth={2.5} />
          </motion.span>
        </motion.div>
      </div>
    </motion.div>
  )
}
