import { motion, useReducedMotion } from 'framer-motion'
import useGridKeyboardNav from '../../../games/shared/useGridKeyboardNav'

/** Player (X) and bot (O) mark colours — Ember brand vs. the game's purple tint. */
const X_COLOR = '#FF602F'
const O_COLOR = '#9E86F5'

/**
 * A single hand-drawn X or O that strokes itself in. Respects reduced motion by
 * rendering instantly (no draw-in). `win` gives it an extra glow when it's part
 * of the completed line.
 */
function Mark({ mark, win }) {
  const reduce = useReducedMotion()
  const color = mark === 'X' ? X_COLOR : O_COLOR
  const draw = { pathLength: 1, opacity: 1 }
  const from = reduce ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0.4 }
  const glow = win
    ? `drop-shadow(0 0 10px ${color}) drop-shadow(0 0 4px ${color})`
    : `drop-shadow(0 0 5px ${color}88)`

  return (
    <svg viewBox="0 0 100 100" className="h-[62%] w-[62%]" style={{ filter: glow }} aria-hidden="true">
      {mark === 'X' ? (
        <>
          <motion.line
            x1={24}
            y1={24}
            x2={76}
            y2={76}
            stroke={color}
            strokeWidth={13}
            strokeLinecap="round"
            initial={from}
            animate={draw}
            transition={{ duration: reduce ? 0 : 0.22, ease: [0.23, 1, 0.32, 1] }}
          />
          <motion.line
            x1={76}
            y1={24}
            x2={24}
            y2={76}
            stroke={color}
            strokeWidth={13}
            strokeLinecap="round"
            initial={from}
            animate={draw}
            transition={{ duration: reduce ? 0 : 0.22, delay: reduce ? 0 : 0.16, ease: [0.23, 1, 0.32, 1] }}
          />
        </>
      ) : (
        <motion.circle
          cx={50}
          cy={50}
          r={27}
          fill="none"
          stroke={color}
          strokeWidth={13}
          strokeLinecap="round"
          initial={from}
          animate={draw}
          transition={{ duration: reduce ? 0 : 0.34, ease: [0.23, 1, 0.32, 1] }}
        />
      )}
    </svg>
  )
}

/**
 * TicTacToeBoard — the 3x3 play grid. Bold tinted gridlines (via the gap),
 * square cells, animated marks, and a glowing pulse on the winning line.
 *
 * Props:
 *   board     Array(9) of 'X' | 'O' | null
 *   winLine   number[] | null      indices of the winning line to highlight
 *   winMark   'X' | 'O' | 'draw' | null
 *   disabled  boolean              blocks input (AI's turn / game over)
 *   tint      gridline / accent colour
 *   onCell(i) place the human's mark at cell i
 */
export default function TicTacToeBoard({ board, winLine, winMark, disabled, tint = '#9E86F5', onCell }) {
  const reduce = useReducedMotion()
  const winSet = new Set(winLine || [])
  const gameOver = winMark != null

  // 3x3 arrow-key navigation. The cells are already buttons (so Enter/Space
  // played a move), but reaching one required tabbing through the board.
  const kb = useGridKeyboardNav({ rows: 3, cols: 3, wrap: true })

  return (
    <div className="board-fit mx-auto w-full max-w-[22rem]">
      <div
        className="grid grid-cols-3 gap-2.5 rounded-3xl p-2.5"
        style={{ background: `${tint}26`, boxShadow: `inset 0 0 0 1px ${tint}40` }}
        role="grid"
        aria-label="Tic Tac Toe board. Use the arrow keys to move, then press Enter to play."
        {...kb.containerProps}
      >
        {board.map((cell, i) => {
          const isWin = winSet.has(i)
          const empty = cell === null
          const playable = empty && !disabled
          return (
            <motion.button
              key={i}
              type="button"
              role="gridcell"
              {...kb.cellProps(Math.floor(i / 3), i % 3)}
              disabled={!playable}
              onClick={() => playable && onCell(i)}
              whileTap={playable && !reduce ? { scale: 0.97 } : undefined}
              className="relative flex aspect-square items-center justify-center rounded-2xl bg-card transition-[background-color,box-shadow,transform] duration-200 disabled:cursor-default can-hover:enabled:hover:bg-surface"
              style={{
                boxShadow: isWin
                  ? `0 0 22px ${winMark === 'X' ? '#FF602F' : winMark === 'O' ? '#9E86F5' : tint}80, inset 0 0 0 2px ${winMark === 'X' ? '#FF602F' : '#9E86F5'}cc`
                  : `inset 0 0 0 1px ${tint}22`,
                cursor: playable ? 'pointer' : 'default',
              }}
              aria-label={
                cell
                  ? `Cell ${i + 1}, ${cell === 'X' ? 'your X' : 'bot O'}`
                  : disabled
                    ? `Cell ${i + 1}, ${gameOver ? 'game over' : 'wait for the bot'}`
                    : `Cell ${i + 1}, empty — tap to play`
              }
            >
              <motion.span
                className={`flex h-full w-full items-center justify-center ${isWin ? 'motion-safe:animate-pulse' : ''}`}
                initial={cell && !reduce ? { scale: 0.4 } : false}
                animate={cell ? { scale: 1 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 18 }}
              >
                {cell && <Mark mark={cell} win={isWin} />}
              </motion.span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
