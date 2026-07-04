import { useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { key, numberAt } from '../../../games/zip/engine'

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
          className="relative grid touch-none select-none overflow-hidden rounded-2xl border-2"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            aspectRatio: `${cols} / ${rows}`,
            borderColor: `${tint}88`,
            background: '#001621',
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
              return (
                <div
                  key={k}
                  role="gridcell"
                  className="relative flex aspect-square items-center justify-center"
                  style={{
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
