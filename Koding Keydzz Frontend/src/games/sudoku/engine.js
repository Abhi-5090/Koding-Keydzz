/**
 * Sudoku engine — pure, framework-free logic shared by the UI and the tests.
 *
 * Grids are square arrays of arrays of numbers. A blank cell is 0 (or any
 * falsy value). Supported sizes: 4 (2x2 boxes), 6 (2x3 boxes), 9 (3x3 boxes).
 *
 * The "box" of a cell is the sub-rectangle that, together with its row and
 * column, must contain each number 1..size exactly once.
 */

/**
 * boxDims(size) -> { rows, cols }
 * The height (rows) and width (cols) of one sub-box for the given grid size.
 *   4 -> 2x2,  6 -> 2x3 (2 tall, 3 wide),  9 -> 3x3
 */
export function boxDims(size) {
  switch (size) {
    case 4:
      return { rows: 2, cols: 2 }
    case 6:
      return { rows: 2, cols: 3 }
    case 9:
      return { rows: 3, cols: 3 }
    default: {
      // Fallback: nearest-square-ish box for arbitrary perfect sizes.
      const r = Math.floor(Math.sqrt(size))
      return { rows: r, cols: size / r }
    }
  }
}

const key = (r, c) => `${r},${c}`

/**
 * conflicts(grid, size) -> Array<{ r, c }>
 * Every filled cell that duplicates another filled cell in the same row,
 * column, or box. Blank cells (0) never conflict. The list is de-duplicated.
 */
export function conflicts(grid, size) {
  const bad = new Set()
  const add = (cells) => {
    // cells: [{ r, c, v }] for a single unit (row / col / box)
    const seen = new Map() // value -> [{r,c}]
    for (const cell of cells) {
      if (!cell.v) continue
      if (!seen.has(cell.v)) seen.set(cell.v, [])
      seen.get(cell.v).push(cell)
    }
    for (const group of seen.values()) {
      if (group.length > 1) {
        for (const cell of group) bad.add(key(cell.r, cell.c))
      }
    }
  }

  // Rows
  for (let r = 0; r < size; r++) {
    const cells = []
    for (let c = 0; c < size; c++) cells.push({ r, c, v: grid[r][c] })
    add(cells)
  }
  // Columns
  for (let c = 0; c < size; c++) {
    const cells = []
    for (let r = 0; r < size; r++) cells.push({ r, c, v: grid[r][c] })
    add(cells)
  }
  // Boxes
  const { rows: bRows, cols: bCols } = boxDims(size)
  for (let br = 0; br < size; br += bRows) {
    for (let bc = 0; bc < size; bc += bCols) {
      const cells = []
      for (let r = br; r < br + bRows; r++) {
        for (let c = bc; c < bc + bCols; c++) {
          cells.push({ r, c, v: grid[r][c] })
        }
      }
      add(cells)
    }
  }

  return [...bad].map((k) => {
    const [r, c] = k.split(',').map(Number)
    return { r, c }
  })
}

/**
 * isValidPlacement(grid, size, r, c, val) -> boolean
 * Would placing `val` at (r, c) keep the row, column, and box free of
 * duplicates? Ignores the cell itself so re-asserting a value is valid.
 * A val of 0 (clearing) is always valid.
 */
export function isValidPlacement(grid, size, r, c, val) {
  if (!val) return true
  for (let i = 0; i < size; i++) {
    if (i !== c && grid[r][i] === val) return false
    if (i !== r && grid[i][c] === val) return false
  }
  const { rows: bRows, cols: bCols } = boxDims(size)
  const br = Math.floor(r / bRows) * bRows
  const bc = Math.floor(c / bCols) * bCols
  for (let rr = br; rr < br + bRows; rr++) {
    for (let cc = bc; cc < bc + bCols; cc++) {
      if ((rr !== r || cc !== c) && grid[rr][cc] === val) return false
    }
  }
  return true
}

/**
 * isComplete(grid) -> boolean
 * Every cell filled (no zeros) and zero conflicts. Infers size from the grid.
 */
export function isComplete(grid) {
  if (!Array.isArray(grid) || grid.length === 0) return false
  const size = grid.length
  for (let r = 0; r < size; r++) {
    if (!Array.isArray(grid[r]) || grid[r].length !== size) return false
    for (let c = 0; c < size; c++) {
      if (!grid[r][c]) return false
    }
  }
  return conflicts(grid, size).length === 0
}

/**
 * isSolvedSolution(solution, size) -> boolean
 * Validates that a fully-filled grid obeys all Sudoku rules: correct shape,
 * every value in 1..size, and each row / column / box a permutation of
 * 1..size (no blanks, no duplicates).
 */
export function isSolvedSolution(solution, size) {
  if (!Array.isArray(solution) || solution.length !== size) return false
  for (let r = 0; r < size; r++) {
    if (!Array.isArray(solution[r]) || solution[r].length !== size) return false
    for (let c = 0; c < size; c++) {
      const v = solution[r][c]
      if (!Number.isInteger(v) || v < 1 || v > size) return false
    }
  }

  const full = (vals) => {
    const set = new Set(vals)
    if (set.size !== size) return false
    for (let v = 1; v <= size; v++) if (!set.has(v)) return false
    return true
  }

  for (let r = 0; r < size; r++) {
    if (!full(solution[r])) return false
  }
  for (let c = 0; c < size; c++) {
    const col = []
    for (let r = 0; r < size; r++) col.push(solution[r][c])
    if (!full(col)) return false
  }
  const { rows: bRows, cols: bCols } = boxDims(size)
  for (let br = 0; br < size; br += bRows) {
    for (let bc = 0; bc < size; bc += bCols) {
      const box = []
      for (let r = br; r < br + bRows; r++) {
        for (let c = bc; c < bc + bCols; c++) box.push(solution[r][c])
      }
      if (!full(box)) return false
    }
  }
  return true
}

/** Deep-clone a grid so callers can mutate freely. */
export function cloneGrid(grid) {
  return grid.map((row) => row.slice())
}
