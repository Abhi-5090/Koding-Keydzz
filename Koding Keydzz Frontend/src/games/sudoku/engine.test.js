import { describe, it, expect } from 'vitest'
import {
  boxDims,
  conflicts,
  isComplete,
  isValidPlacement,
  isSolvedSolution,
} from './engine'
import sudokuLevels from '../../data/sudokuLevels'

describe('boxDims', () => {
  it('returns the right sub-box shape per size', () => {
    expect(boxDims(4)).toEqual({ rows: 2, cols: 2 })
    expect(boxDims(6)).toEqual({ rows: 2, cols: 3 })
    expect(boxDims(9)).toEqual({ rows: 3, cols: 3 })
  })
})

describe('conflicts', () => {
  it('detects a duplicate in a row', () => {
    const grid = [
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    const bad = conflicts(grid, 4)
    expect(bad).toHaveLength(2)
    expect(bad).toContainEqual({ r: 0, c: 0 })
    expect(bad).toContainEqual({ r: 0, c: 1 })
  })

  it('detects a duplicate in a column', () => {
    const grid = [
      [3, 0, 0, 0],
      [3, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    const bad = conflicts(grid, 4)
    expect(bad).toContainEqual({ r: 0, c: 0 })
    expect(bad).toContainEqual({ r: 1, c: 0 })
  })

  it('detects a duplicate inside a box (not same row/col)', () => {
    const grid = [
      [2, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    const bad = conflicts(grid, 4)
    expect(bad).toContainEqual({ r: 0, c: 0 })
    expect(bad).toContainEqual({ r: 1, c: 1 })
  })

  it('reports no conflicts for blanks and clean grids', () => {
    const blank = Array.from({ length: 4 }, () => Array(4).fill(0))
    expect(conflicts(blank, 4)).toHaveLength(0)
    const clean = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ]
    expect(conflicts(clean, 4)).toHaveLength(0)
  })
})

describe('isValidPlacement', () => {
  const grid = [
    [1, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]
  it('rejects a value already in the row/col/box', () => {
    expect(isValidPlacement(grid, 4, 0, 2, 1)).toBe(false) // row
    expect(isValidPlacement(grid, 4, 2, 0, 1)).toBe(false) // column
    expect(isValidPlacement(grid, 4, 1, 1, 1)).toBe(false) // box
  })
  it('accepts a non-conflicting value and clearing', () => {
    expect(isValidPlacement(grid, 4, 0, 2, 2)).toBe(true)
    expect(isValidPlacement(grid, 4, 0, 0, 0)).toBe(true) // clear
  })
})

describe('isComplete', () => {
  it('is true only when filled and conflict-free', () => {
    const solved = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ]
    expect(isComplete(solved)).toBe(true)

    const withBlank = solved.map((r) => r.slice())
    withBlank[0][0] = 0
    expect(isComplete(withBlank)).toBe(false)

    const withDup = solved.map((r) => r.slice())
    withDup[0][1] = 1
    expect(isComplete(withDup)).toBe(false)
  })
})

describe('isSolvedSolution', () => {
  it('accepts a valid full solution', () => {
    const solved = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ]
    expect(isSolvedSolution(solved, 4)).toBe(true)
  })
  it('rejects out-of-range, wrong-shape, or duplicate grids', () => {
    expect(isSolvedSolution([[1, 2], [2, 1]], 4)).toBe(false)
    expect(
      isSolvedSolution(
        [
          [1, 2, 3, 5], // 5 out of range for size 4
          [3, 4, 1, 2],
          [2, 1, 4, 3],
          [4, 3, 2, 1],
        ],
        4
      )
    ).toBe(false)
  })
})

describe('authored sudoku levels', () => {
  it('has the expected counts and shape', () => {
    expect(sudokuLevels).toHaveLength(14)
    const easy = sudokuLevels.filter((l) => l.difficulty === 'easy')
    const medium = sudokuLevels.filter((l) => l.difficulty === 'medium')
    const hard = sudokuLevels.filter((l) => l.difficulty === 'hard')
    expect(easy).toHaveLength(6)
    expect(medium).toHaveLength(5)
    expect(hard).toHaveLength(3)
    expect(easy.every((l) => l.size === 4)).toBe(true)
    expect(medium.every((l) => l.size === 6)).toBe(true)
    expect(hard.every((l) => l.size === 9)).toBe(true)
  })

  it('every solution passes isSolvedSolution', () => {
    for (const level of sudokuLevels) {
      expect(
        isSolvedSolution(level.solution, level.size),
        `level ${level.id} (${level.name}) solution invalid`
      ).toBe(true)
    }
  })

  it('every givens cell is 0 or matches the solution', () => {
    for (const level of sudokuLevels) {
      const { size, givens, solution } = level
      expect(givens).toHaveLength(size)
      for (let r = 0; r < size; r++) {
        expect(givens[r]).toHaveLength(size)
        for (let c = 0; c < size; c++) {
          const g = givens[r][c]
          if (g !== 0) {
            expect(
              g,
              `level ${level.id} givens[${r}][${c}] should match solution`
            ).toBe(solution[r][c])
          }
        }
      }
      // The givens, on their own, should not contain conflicts.
      expect(conflicts(givens, size)).toHaveLength(0)
    }
  })
})
