import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Arrow-key navigation for a 2D game board.
 *
 * WHY: the board cells are already real <button> elements with aria-labels, so
 * they could be focused with Tab and activated with Enter/Space. But tabbing
 * through 81 Sudoku cells to reach one square is not a usable way to play, so
 * in practice the boards were pointer-only — which excludes students with
 * motor disabilities and fails the WCAG 2.1 keyboard requirement that public
 * schools ask about during procurement.
 *
 * This implements the standard **roving tabindex** pattern:
 *   • exactly ONE cell is in the tab order at a time (tabIndex 0), the rest
 *     are -1, so Tab moves past the whole board in one step;
 *   • arrow keys move focus within the board;
 *   • Home/End jump to the start/end of a row, Ctrl+Home/End to the board;
 *   • Enter/Space activate, which the native <button> already handles.
 *
 * Usage:
 *   const grid = useGridKeyboardNav({ rows: size, cols: size })
 *   <div {...grid.containerProps}>
 *     {cells.map((_, i) => <button key={i} {...grid.cellProps(r, c)} … />)}
 *   </div>
 *
 * @param {object} opts
 * @param {number} opts.rows
 * @param {number} opts.cols
 * @param {boolean} [opts.wrap]  wrap around edges (default false — clamping is
 *   less disorienting on a puzzle grid)
 * @param {(r:number,c:number)=>boolean} [opts.isFocusable] skip cells that
 *   cannot be interacted with (e.g. Sudoku givens)
 */
export default function useGridKeyboardNav({
  rows,
  cols,
  wrap = false,
  isFocusable,
} = {}) {
  const [active, setActive] = useState({ r: 0, c: 0 })
  const cellRefs = useRef(new Map())

  // Keep the active cell inside the grid if the board size changes (e.g. a new
  // Sudoku level with a different size).
  useEffect(() => {
    setActive((prev) => ({
      r: Math.min(prev.r, Math.max(0, rows - 1)),
      c: Math.min(prev.c, Math.max(0, cols - 1)),
    }))
  }, [rows, cols])

  const key = (r, c) => `${r},${c}`

  const canFocus = useCallback(
    (r, c) => {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return false
      if (typeof isFocusable === 'function') return isFocusable(r, c) !== false
      return true
    },
    [rows, cols, isFocusable]
  )

  /** Move focus to (r, c), scanning past unfocusable cells along `step`. */
  const focusCell = useCallback(
    (r, c, step = { dr: 0, dc: 0 }) => {
      let tr = r
      let tc = c

      if (wrap) {
        tr = ((tr % rows) + rows) % rows
        tc = ((tc % cols) + cols) % cols
      } else {
        tr = Math.max(0, Math.min(rows - 1, tr))
        tc = Math.max(0, Math.min(cols - 1, tc))
      }

      // If the target can't take focus, keep stepping in the same direction.
      // Bounded by the grid size so this can never loop forever.
      let guard = rows * cols
      while (!canFocus(tr, tc) && guard > 0 && (step.dr || step.dc)) {
        tr += step.dr
        tc += step.dc
        if (tr < 0 || tc < 0 || tr >= rows || tc >= cols) return // nothing focusable that way
        guard -= 1
      }
      if (!canFocus(tr, tc)) return

      setActive({ r: tr, c: tc })
      const el = cellRefs.current.get(key(tr, tc))
      if (el && typeof el.focus === 'function') el.focus()
    },
    [rows, cols, wrap, canFocus]
  )

  const onKeyDown = useCallback(
    (e) => {
      const { r, c } = active
      let handled = true

      switch (e.key) {
        case 'ArrowUp':
          focusCell(r - 1, c, { dr: -1, dc: 0 })
          break
        case 'ArrowDown':
          focusCell(r + 1, c, { dr: 1, dc: 0 })
          break
        case 'ArrowLeft':
          focusCell(r, c - 1, { dr: 0, dc: -1 })
          break
        case 'ArrowRight':
          focusCell(r, c + 1, { dr: 0, dc: 1 })
          break
        case 'Home':
          if (e.ctrlKey) focusCell(0, 0, { dr: 0, dc: 1 })
          else focusCell(r, 0, { dr: 0, dc: 1 })
          break
        case 'End':
          if (e.ctrlKey) focusCell(rows - 1, cols - 1, { dr: 0, dc: -1 })
          else focusCell(r, cols - 1, { dr: 0, dc: -1 })
          break
        default:
          handled = false
      }

      if (handled) {
        // Stop the page from scrolling under the board on every arrow press.
        e.preventDefault()
        e.stopPropagation()
      }
    },
    [active, focusCell, rows, cols]
  )

  /** Spread onto the grid container. */
  const containerProps = {
    onKeyDown,
  }

  /**
   * Spread onto each cell button. Supplies the roving tabIndex, a ref for
   * programmatic focus, and a click handler that keeps `active` in sync so
   * arrow keys continue from wherever the player last tapped.
   */
  const cellProps = useCallback(
    (r, c) => ({
      ref: (el) => {
        if (el) cellRefs.current.set(key(r, c), el)
        else cellRefs.current.delete(key(r, c))
      },
      tabIndex: active.r === r && active.c === c ? 0 : -1,
      onFocus: () => setActive({ r, c }),
    }),
    [active]
  )

  return { active, setActive, focusCell, containerProps, cellProps }
}
