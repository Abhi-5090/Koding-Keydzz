import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { key, numberAt } from '../../../games/zip/engine'
import { BOARD_BG } from '../../../theme/tokens'

/**
 * ZipBoard — the interactive Zip grid.
 *
 * The board sizes itself to its CONTAINER (the `.board-fit` wrapper sets a
 * container-query context) using a `cqmin`-based square, so it never overflows
 * on phone / tablet / ultrawide. Cells are laid out on a CSS grid; the drawn
 * path is rendered as one thick rounded turmeric SVG polyline through cell
 * centres, animated as segments are added. Walls render as thick error-tinted
 * bars straddling the blocked edge.
 *
 * Interaction uses pointer events for a unified mouse/touch experience:
 *   - pointer-down on a cell starts (or continues) the drag,
 *   - dragging over an adjacent legal cell extends the path,
 *   - dragging back onto the previous cell backtracks (removes the last cell),
 *   - a plain tap also extends the path one cell.
 *
 * It is ALSO fully playable with the keyboard, which a drag-only board is not.
 * The model is deliberately the same one Sudoku and N-Queens use, so a pupil
 * learns it once:
 *   - a roving tabindex puts exactly ONE cell in the tab order, so the board is
 *     a single tab stop instead of dozens,
 *   - the arrow keys move that cursor,
 *   - Enter or Space draws to the cursor cell (or backtracks onto it),
 *   - Backspace undoes the last cell.
 *
 * Props:
 *   level        the Zip level
 *   path         Array<{x,y}> current drawn path
 *   onExtend(cell)   request to append `cell` (parent validates)
 *   onBacktrack()    request to drop the last cell
 *   tint         accent colour (turmeric family)
 *   shakeKey     bump to replay the reject shake
 */
export default function ZipBoard({ level, path, onExtend, onBacktrack, tint = '#FF602F', shakeKey = 0 }) {
  const { cols, rows } = level
  const gridRef = useRef(null)
  const draggingRef = useRef(false)

  const pathIndex = useMemo(() => {
    const m = new Map()
    path.forEach((c, i) => m.set(key(c.x, c.y), i))
    return m
  }, [path])

  const last = path.length ? path[path.length - 1] : null
  const prev = path.length > 1 ? path[path.length - 2] : null

  // Map a pointer event to the grid cell under it (works for drag across cells).
  const cellFromEvent = useCallback(
    (e) => {
      const el = gridRef.current
      if (!el) return null
      const rect = el.getBoundingClientRect()
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * cols)
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * rows)
      if (x < 0 || y < 0 || x >= cols || y >= rows) return null
      return { x, y }
    },
    [cols, rows]
  )

  const adjacent = (a, b) => a && b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1

  const handleCell = useCallback(
    (cell, fromDrag) => {
      if (!cell) return
      // Staying on the current head is a no-op.
      if (last && last.x === cell.x && last.y === cell.y) return
      // Moving onto the second-to-last cell backtracks.
      if (prev && prev.x === cell.x && prev.y === cell.y) {
        onBacktrack()
        return
      }
      // While dragging, silently ignore cells that aren't a legal next step so a
      // fast finger that skips over cells isn't punished with slips. A deliberate
      // TAP (pointer-down) on a far/visited cell still gets reject feedback.
      if (fromDrag && !(path.length === 0) && !adjacent(last, cell)) return
      onExtend(cell) // parent validates (adjacency, wall, revisit, order)
    },
    [last, prev, path.length, onExtend, onBacktrack]
  )

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault()
      draggingRef.current = true
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* capture unsupported — plain taps still work */
      }
      handleCell(cellFromEvent(e), false)
    },
    [cellFromEvent, handleCell]
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!draggingRef.current) return
      handleCell(cellFromEvent(e), true)
    },
    [cellFromEvent, handleCell]
  )

  const endDrag = useCallback((e) => {
    draggingRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* nothing to release */
    }
  }, [])

  // ---- keyboard play ----------------------------------------------------
  // The cursor starts on the "1" cell, which is where the path must begin, so
  // the first Enter is always a legal move.
  const startCell = useMemo(() => {
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) if (numberAt(level, x, y) === 1) return { x, y }
    }
    return { x: 0, y: 0 }
  }, [level, cols, rows])

  const [cursor, setCursor] = useState(startCell)
  const cellRefs = useRef(new Map())

  // A new level means a new board — put the cursor back on its start.
  useEffect(() => {
    setCursor(startCell)
  }, [startCell])

  // Follow the drawn head, so switching from dragging to the keyboard mid-game
  // does not jump the cursor back across the board.
  useEffect(() => {
    if (last) setCursor({ x: last.x, y: last.y })
  }, [last?.x, last?.y]) // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = useCallback(
    (e) => {
      const deltas = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      }
      const d = deltas[e.key]

      if (d) {
        e.preventDefault()
        const nx = Math.min(cols - 1, Math.max(0, cursor.x + d[0]))
        const ny = Math.min(rows - 1, Math.max(0, cursor.y + d[1]))
        if (nx === cursor.x && ny === cursor.y) return // at the edge
        setCursor({ x: nx, y: ny })
        // Synchronously: the element already exists, only its tabIndex changes
        // on re-render. Deferring this to a frame later leaves the OLD cell as
        // document.activeElement in the meantime, which is what a screen
        // reader announces.
        cellRefs.current.get(key(nx, ny))?.focus?.()
        return
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleCell({ x: cursor.x, y: cursor.y }, false)
        return
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        onBacktrack()
      }
    },
    [cursor, cols, rows, handleCell, onBacktrack]
  )

  // SVG polyline through cell centres, in a 0..cols / 0..rows viewBox so the
  // line scales perfectly with the (square-cell) grid.
  const points = path.map((c) => `${c.x + 0.5},${c.y + 0.5}`).join(' ')

  // Wall bars: for each blocked edge, place a thick bar on the shared border.
  const wallBars = (level.walls || []).map(([a, b], i) => {
    const [ax, ay] = a.split(',').map(Number)
    const [bx, by] = b.split(',').map(Number)
    const horiz = ay === by // horizontally adjacent -> vertical wall bar
    const x = horiz ? Math.max(ax, bx) : Math.min(ax, bx)
    const y = horiz ? Math.min(ay, by) : Math.max(ay, by)
    return { i, horiz, x, y }
  })

  return (
    <div className="board-fit mx-auto w-full" style={{ maxWidth: 'min(92vw, 30rem)' }}>
      <motion.div
        key={shakeKey}
        animate={shakeKey ? { x: [0, -7, 7, -4, 4, 0] } : {}}
        transition={{ duration: 0.32 }}
        className="relative mx-auto"
        style={{ width: 'min(100%, 100cqi)' }}
      >
        <div
          ref={gridRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          className="relative grid touch-none select-none overflow-hidden rounded-2xl border-2"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            aspectRatio: `${cols} / ${rows}`,
            borderColor: `${tint}88`,
            background: BOARD_BG,
          }}
          role="grid"
          aria-label={`${cols} by ${rows} Zip board`}
        >
          {Array.from({ length: rows }).flatMap((_, y) =>
            Array.from({ length: cols }).map((__, x) => {
              const k = key(x, y)
              const idx = pathIndex.get(k)
              const filled = idx != null
              const num = numberAt(level, x, y)
              const isStart = num === 1
              const isLast = last && last.x === x && last.y === y
              const isCursor = cursor.x === x && cursor.y === y
              // Spoken as "row 2, column 3, step 4 of the path" — position and
              // state, because colour alone tells a blind pupil nothing.
              const stateLabel = num != null
                ? `number ${num}`
                : filled
                  ? `step ${idx + 1} of the path`
                  : 'empty'
              return (
                <div
                  key={k}
                  role="gridcell"
                  ref={(el) => {
                    if (el) cellRefs.current.set(k, el)
                    else cellRefs.current.delete(k)
                  }}
                  tabIndex={isCursor ? 0 : -1}
                  onFocus={() => setCursor({ x, y })}
                  aria-label={`Row ${y + 1}, column ${x + 1}, ${stateLabel}`}
                  aria-selected={isCursor}
                  className="relative flex aspect-square items-center justify-center outline-none"
                  style={{
                    boxShadow: isCursor ? `inset 0 0 0 3px ${tint}` : undefined,
                    borderRight: x < cols - 1 ? `1px solid ${tint}1f` : undefined,
                    borderBottom: y < rows - 1 ? `1px solid ${tint}1f` : undefined,
                    background: filled ? `${tint}14` : 'transparent',
                  }}
                >
                  {num != null && (
                    <span
                      className="pointer-events-none z-20 flex items-center justify-center rounded-full font-game font-extrabold tabular-nums"
                      style={{
                        width: '62%',
                        height: '62%',
                        fontSize: 'clamp(0.7rem, 5cqi, 1.35rem)',
                        color: '#001621',
                        background: isStart ? '#34D399' : tint,
                        boxShadow: isLast ? `0 0 0 3px ${tint}55` : '0 1px 4px rgba(0,0,0,0.4)',
                      }}
                    >
                      {num}
                    </span>
                  )}
                  {filled && num == null && isLast && (
                    <span
                      className="pointer-events-none z-20 rounded-full"
                      style={{ width: '30%', height: '30%', background: tint }}
                    />
                  )}
                </div>
              )
            })
          )}

          {/* Path trail — behind the number badges, above the cell fills. */}
          <svg
            className="pointer-events-none absolute inset-0 z-10 h-full w-full"
            viewBox={`0 0 ${cols} ${rows}`}
            preserveAspectRatio="none"
          >
            {path.length > 1 && (
              <motion.polyline
                points={points}
                fill="none"
                stroke={tint}
                strokeWidth={0.34}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                style={{ strokeWidth: 'clamp(10px, 6cqi, 26px)' }}
                initial={false}
              />
            )}
          </svg>

          {/* Walls — thick error-tinted bars on the blocked edges. */}
          <div className="pointer-events-none absolute inset-0 z-30">
            {wallBars.map(({ i, horiz, x, y }) => (
              <span
                key={i}
                className="absolute rounded-full"
                style={
                  horiz
                    ? {
                        left: `calc(${(x / cols) * 100}% - 3px)`,
                        top: `${(y / rows) * 100}%`,
                        width: 6,
                        height: `${(1 / rows) * 100}%`,
                        background: '#FF5470',
                        boxShadow: '0 0 8px rgba(255,84,112,0.7)',
                      }
                    : {
                        left: `${(x / cols) * 100}%`,
                        top: `calc(${(y / rows) * 100}% - 3px)`,
                        width: `${(1 / cols) * 100}%`,
                        height: 6,
                        background: '#FF5470',
                        boxShadow: '0 0 8px rgba(255,84,112,0.7)',
                      }
                }
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
