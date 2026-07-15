import { useCallback, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { MoveHorizontal, MoveVertical, Plus } from 'lucide-react'
import { key } from '../../../games/patches/engine'

/**
 * PatchesBoard — the interactive ORIENTED-clue Patches grid (LinkedIn mechanic).
 *
 * The board sizes itself to its CONTAINER (the `.board-fit` wrapper sets a
 * container-query context) using a `cqi`-based square, so it never overflows on
 * phone / tablet / ultrawide. Cells sit on a CSS grid; committed rectangles are
 * painted as soft per-box tinted overlays, and each clue cell shows its NUMBER
 * plus an ORIENTATION ICON telling the player what shape is allowed:
 *   'h'    → ─  (MoveHorizontal): a single ROW,    drag left/right.
 *   'v'    → │  (MoveVertical):   a single COLUMN, drag up/down.
 *   'plus' → ＋ (Plus):           ANY rectangle,   drag any direction.
 *
 * Interaction uses pointer events for a unified mouse/touch experience. The
 * faithful flow is DRAG-FROM-CLUE with the orientation lock:
 *   - pointer-down on a CLUE anchors the drag at that clue; the live preview is
 *     constrained by the clue's type ('h' locks to its row, 'v' to its column,
 *     'plus' is a free 2D rectangle) and always contains the clue,
 *   - pointer-down on a non-clue cell starts a free `plus`-style rectangle,
 *   - dragging grows the preview (snapped to whole cells); it turns valid-green
 *     when it exactly matches (right shape + area + contains one clue + no
 *     overlap with a placed box),
 *   - release attempts to place it (parent validates + commits),
 *   - a plain tap on an already-placed rectangle removes it.
 *
 * Props:
 *   level        the Patches level ({ size, clues, ... })
 *   rects        Array<{x,y,w,h}> committed rectangles
 *   colorFor(r)  -> css color string for a committed rectangle
 *   onDraw(rect) request to place `rect` (parent validates/commits)
 *   onRemoveAt(x,y)  request to remove the committed rect covering (x,y)
 *   tint         accent colour
 *   shakeKey     bump to replay the reject shake
 */
export default function PatchesBoard({
  level,
  rects,
  colorFor,
  onDraw,
  onRemoveAt,
  tint = '#8B7CF6',
  shakeKey = 0,
}) {
  const size = level.size
  const gridRef = useRef(null)
  const draggingRef = useRef(false)
  const anchorRef = useRef(null) // { x, y } drag origin cell
  const anchorClueRef = useRef(null) // the typed clue we're drawing from, or null
  const [preview, setPreview] = useState(null) // { x, y, w, h } live rectangle

  // Which committed rectangle (index) covers each cell.
  const coverIndex = useMemo(() => {
    const m = new Map()
    rects.forEach((r, i) => {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) m.set(key(x, y), i)
      }
    })
    return m
  }, [rects])

  const clueAt = useCallback(
    (x, y) => level.clues?.[key(x, y)] ?? null,
    [level]
  )

  // Map a pointer event to the grid cell under it (clamped to the grid).
  const cellFromEvent = useCallback(
    (e) => {
      const el = gridRef.current
      if (!el) return null
      const rect = el.getBoundingClientRect()
      let x = Math.floor(((e.clientX - rect.left) / rect.width) * size)
      let y = Math.floor(((e.clientY - rect.top) / rect.height) * size)
      x = Math.max(0, Math.min(size - 1, x))
      y = Math.max(0, Math.min(size - 1, y))
      return { x, y }
    },
    [size]
  )

  // Build the live preview from the anchor + current pointer cell, honouring the
  // anchor clue's orientation lock.
  const rectFromDrag = useCallback((anchor, clue, cur) => {
    if (clue?.type === 'h') {
      // Locked to the anchor row; grow left/right, always spanning the clue.
      const x = Math.min(anchor.x, cur.x)
      const w = Math.abs(anchor.x - cur.x) + 1
      return { x, y: anchor.y, w, h: 1 }
    }
    if (clue?.type === 'v') {
      // Locked to the anchor column; grow up/down, always spanning the clue.
      const y = Math.min(anchor.y, cur.y)
      const h = Math.abs(anchor.y - cur.y) + 1
      return { x: anchor.x, y, w: 1, h }
    }
    // 'plus' or free draw: full 2D rectangle from anchor to pointer.
    const x = Math.min(anchor.x, cur.x)
    const y = Math.min(anchor.y, cur.y)
    const w = Math.abs(anchor.x - cur.x) + 1
    const h = Math.abs(anchor.y - cur.y) + 1
    return { x, y, w, h }
  }, [])

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault()
      const cell = cellFromEvent(e)
      if (!cell) return
      draggingRef.current = true
      anchorRef.current = cell
      anchorClueRef.current = clueAt(cell.x, cell.y)
      setPreview({ x: cell.x, y: cell.y, w: 1, h: 1 })
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* capture unsupported — taps still work */
      }
    },
    [cellFromEvent, clueAt]
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!draggingRef.current || !anchorRef.current) return
      const cell = cellFromEvent(e)
      if (!cell) return
      setPreview(rectFromDrag(anchorRef.current, anchorClueRef.current, cell))
    },
    [cellFromEvent, rectFromDrag]
  )

  const endDrag = useCallback(
    (e) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* nothing to release */
      }
      if (!draggingRef.current) return
      draggingRef.current = false
      const rect = preview
      anchorRef.current = null
      anchorClueRef.current = null
      setPreview(null)
      if (!rect) return

      // A single-cell "tap" on an existing rectangle removes it.
      if (rect.w === 1 && rect.h === 1) {
        const idx = coverIndex.get(key(rect.x, rect.y))
        if (idx != null) {
          onRemoveAt(rect.x, rect.y)
          return
        }
      }
      onDraw(rect)
    },
    [preview, coverIndex, onRemoveAt, onDraw]
  )

  // Preview validity hint: green when it wraps exactly one clue, matches that
  // clue's area AND orientation, and doesn't cover a committed cell.
  const previewState = useMemo(() => {
    if (!preview) return null
    let clueCount = 0
    let clue = null
    let onCommitted = false
    for (let y = preview.y; y < preview.y + preview.h; y++) {
      for (let x = preview.x; x < preview.x + preview.w; x++) {
        const c = clueAt(x, y)
        if (c != null) {
          clueCount += 1
          clue = c
        }
        if (coverIndex.has(key(x, y))) onCommitted = true
      }
    }
    const area = preview.w * preview.h
    let good = !onCommitted && clueCount === 1 && clue != null && clue.n === area
    if (good && clue.type === 'h') good = preview.h === 1
    if (good && clue.type === 'v') good = preview.w === 1
    return { good }
  }, [preview, clueAt, coverIndex])

  return (
    <div className="board-fit mx-auto w-full max-w-[26rem]">
      <motion.div
        key={shakeKey}
        animate={shakeKey ? { x: [0, -7, 7, -4, 4, 0] } : {}}
        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
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
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            aspectRatio: '1 / 1',
            borderColor: `${tint}88`,
            background: '#001621',
          }}
          role="grid"
          aria-label={`${size} by ${size} Patches board`}
        >
          {Array.from({ length: size }).flatMap((_, y) =>
            Array.from({ length: size }).map((__, x) => {
              const k = key(x, y)
              const idx = coverIndex.get(k)
              const filled = idx != null
              const clue = clueAt(x, y)
              const fill = filled ? colorFor(rects[idx]) : 'transparent'
              return (
                <div
                  key={k}
                  role="gridcell"
                  className="relative flex aspect-square items-center justify-center"
                  style={{
                    borderRight: x < size - 1 ? `1px solid ${tint}22` : undefined,
                    borderBottom: y < size - 1 ? `1px solid ${tint}22` : undefined,
                    background: fill,
                  }}
                >
                  {clue != null && (
                    <ClueChip clue={clue} filled={filled} tint={tint} />
                  )}
                </div>
              )
            })
          )}

          {/* Committed rectangle outlines — crisp borders over the soft fills. */}
          <div className="pointer-events-none absolute inset-0 z-10">
            {rects.map((r, i) => (
              <span
                key={`r-${i}`}
                className="absolute rounded-lg"
                style={{
                  left: `${(r.x / size) * 100}%`,
                  top: `${(r.y / size) * 100}%`,
                  width: `${(r.w / size) * 100}%`,
                  height: `${(r.h / size) * 100}%`,
                  border: `2px solid ${colorFor(r)}`,
                  boxShadow: `inset 0 0 0 1px ${colorFor(r)}55`,
                }}
              />
            ))}
          </div>

          {/* Live drag preview. */}
          {preview && (
            <span
              className="pointer-events-none absolute z-30 rounded-lg"
              style={{
                left: `${(preview.x / size) * 100}%`,
                top: `${(preview.y / size) * 100}%`,
                width: `${(preview.w / size) * 100}%`,
                height: `${(preview.h / size) * 100}%`,
                border: `3px solid ${previewState?.good ? '#34D399' : tint}`,
                background: previewState?.good ? '#34D39926' : `${tint}22`,
                boxShadow: `0 0 12px ${previewState?.good ? '#34D39988' : `${tint}88`}`,
              }}
            />
          )}
        </div>
      </motion.div>
    </div>
  )
}

/**
 * ClueChip — a clue's NUMBER (prominent) with its ORIENTATION ICON behind/next
 * to it. The icon shows the allowed shape so the player knows how to drag.
 */
function ClueChip({ clue, filled, tint }) {
  const Icon = clue.type === 'h' ? MoveHorizontal : clue.type === 'v' ? MoveVertical : Plus
  const label =
    clue.type === 'h'
      ? `${clue.n}, a sideways row`
      : clue.type === 'v'
        ? `${clue.n}, an upright column`
        : `${clue.n}, any shape`
  return (
    <span
      className="pointer-events-none relative z-20 flex items-center justify-center rounded-lg font-game font-extrabold tabular-nums"
      role="img"
      aria-label={label}
      style={{
        width: '78%',
        height: '78%',
        color: '#001621',
        background: filled ? '#FFFFFF' : tint,
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      }}
    >
      {/* orientation icon — faint, behind the number */}
      <Icon
        className="pointer-events-none absolute"
        style={{
          width: '58%',
          height: '58%',
          color: '#001621',
          opacity: 0.24,
        }}
        strokeWidth={3}
        aria-hidden="true"
      />
      <span
        className="relative"
        style={{ fontSize: 'clamp(0.6rem, 5cqi, 1.25rem)', lineHeight: 1 }}
      >
        {clue.n}
      </span>
    </span>
  )
}
