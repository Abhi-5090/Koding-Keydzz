import { motion } from 'framer-motion'
import { boxDims } from '../../../games/sudoku/engine'

/**
 * SudokuBoard — renders the grid with bold sub-box borders, locked givens,
 * tappable empties, conflict highlighting, and a subtle peer (row/col/box)
 * highlight for the selected cell.
 *
 * Props:
 *   grid       current values (size x size, 0 = blank)
 *   size       4 | 6 | 9
 *   givens     the immutable starting grid (givens[r][c] !== 0 => locked)
 *   selected   { r, c } | null
 *   conflicts  Array<{ r, c }> currently in conflict
 *   onSelect(r, c)
 *   tint
 */
export default function SudokuBoard({ grid, size, givens, selected, conflicts, onSelect, tint = '#2DD4BF' }) {
  const { rows: bRows, cols: bCols } = boxDims(size)
  const conflictSet = new Set(conflicts.map((c) => `${c.r},${c.c}`))

  const inPeer = (r, c) => {
    if (!selected) return false
    if (r === selected.r || c === selected.c) return true
    const br = Math.floor(r / bRows) === Math.floor(selected.r / bRows)
    const bc = Math.floor(c / bCols) === Math.floor(selected.c / bCols)
    return br && bc
  }

  // Cap visual cell size so 9x9 still fits comfortably on phones.
  const maxPx = size <= 4 ? 360 : size <= 6 ? 420 : 468

  return (
    <div className="mx-auto w-full" style={{ maxWidth: maxPx }}>
      <div
        className="grid overflow-hidden rounded-xl border-2"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          borderColor: `${tint}99`,
          background: '#001621',
        }}
        role="grid"
        aria-label={`${size} by ${size} Sudoku board`}
      >
        {grid.map((row, r) =>
          row.map((val, c) => {
            const locked = givens[r][c] !== 0
            const isSel = selected && selected.r === r && selected.c === c
            const conflicted = conflictSet.has(`${r},${c}`)
            const peer = inPeer(r, c)
            const sameValue =
              selected && val !== 0 && grid[selected.r][selected.c] === val && !isSel

            // Bold borders on box boundaries.
            const thickRight = (c + 1) % bCols === 0 && c !== size - 1
            const thickBottom = (r + 1) % bRows === 0 && r !== size - 1

            return (
              <motion.button
                key={`${r}-${c}`}
                type="button"
                role="gridcell"
                onClick={() => onSelect(r, c)}
                whileTap={locked ? undefined : { scale: 0.9 }}
                className={[
                  'relative flex aspect-square items-center justify-center font-game font-bold tabular-nums transition-colors duration-150 focus-visible:z-10',
                  size === 9 ? 'text-base sm:text-xl' : 'text-xl sm:text-2xl',
                  locked ? 'cursor-default text-text-primary' : 'cursor-pointer',
                ].join(' ')}
                style={{
                  borderRight: `1px solid ${tint}22`,
                  borderBottom: `1px solid ${tint}22`,
                  boxShadow: [
                    thickRight ? `inset -2px 0 0 ${tint}aa` : '',
                    thickBottom ? `inset 0 -2px 0 ${tint}aa` : '',
                  ]
                    .filter(Boolean)
                    .join(', '),
                  background: conflicted
                    ? 'rgba(255,84,112,0.28)'
                    : isSel
                      ? `${tint}3a`
                      : sameValue
                        ? `${tint}24`
                        : peer
                          ? 'rgba(10,46,60,0.85)'
                          : locked
                            ? 'rgba(4,33,46,0.6)'
                            : 'transparent',
                  color: conflicted ? '#FF5470' : locked ? '#FFFFFF' : tint,
                }}
                aria-label={`Row ${r + 1} column ${c + 1}${val ? `, value ${val}` : ', empty'}${
                  locked ? ', given' : ''
                }`}
              >
                {val !== 0 ? val : ''}
                {isSel && (
                  <span
                    className="pointer-events-none absolute inset-0 rounded-[3px]"
                    style={{ boxShadow: `inset 0 0 0 2px ${tint}` }}
                  />
                )}
              </motion.button>
            )
          })
        )}
      </div>
    </div>
  )
}
