import { describe, it, expect } from 'vitest'
import { attacks, conflicts, isSolved, hasSolution, findSolution } from './engine'
import nqueensLevels from '../../data/nqueensLevels'

describe('attacks', () => {
  it('is true for same row, column, and diagonal', () => {
    expect(attacks({ r: 2, c: 1 }, { r: 2, c: 5 })).toBe(true) // row
    expect(attacks({ r: 1, c: 3 }, { r: 6, c: 3 })).toBe(true) // column
    expect(attacks({ r: 0, c: 0 }, { r: 3, c: 3 })).toBe(true) // main diag
    expect(attacks({ r: 0, c: 4 }, { r: 4, c: 0 })).toBe(true) // anti diag
  })
  it('is false for non-attacking and identical squares', () => {
    expect(attacks({ r: 0, c: 0 }, { r: 1, c: 2 })).toBe(false)
    expect(attacks({ r: 2, c: 2 }, { r: 2, c: 2 })).toBe(false)
  })
})

describe('conflicts', () => {
  it('returns the attacking queens, de-duplicated', () => {
    const queens = [
      { r: 0, c: 0 },
      { r: 1, c: 1 }, // diagonal attack with (0,0)
      { r: 2, c: 3 }, // safe from both
    ]
    const bad = conflicts(queens, 4)
    expect(bad).toHaveLength(2)
    expect(bad).toContainEqual({ r: 0, c: 0 })
    expect(bad).toContainEqual({ r: 1, c: 1 })
  })
  it('is empty for a non-attacking set', () => {
    const queens = [
      { r: 1, c: 0 },
      { r: 3, c: 1 },
      { r: 0, c: 2 },
      { r: 2, c: 3 },
    ]
    expect(conflicts(queens, 4)).toHaveLength(0)
  })
})

describe('isSolved', () => {
  it('is true for a valid 4-queens arrangement', () => {
    const queens = [
      { r: 1, c: 0 },
      { r: 3, c: 1 },
      { r: 0, c: 2 },
      { r: 2, c: 3 },
    ]
    expect(isSolved(queens, 4)).toBe(true)
  })
  it('is false with wrong count, duplicates, or attacks', () => {
    expect(isSolved([{ r: 0, c: 0 }], 4)).toBe(false) // too few
    expect(
      isSolved(
        [
          { r: 0, c: 0 },
          { r: 0, c: 0 },
          { r: 1, c: 1 },
          { r: 2, c: 2 },
        ],
        4
      )
    ).toBe(false) // dup square
    expect(
      isSolved(
        [
          { r: 0, c: 0 },
          { r: 0, c: 1 },
          { r: 2, c: 2 },
          { r: 3, c: 3 },
        ],
        4
      )
    ).toBe(false) // same row attack
  })
})

describe('hasSolution', () => {
  it('matches the known solvability of N-Queens', () => {
    expect(hasSolution(1)).toBe(true)
    expect(hasSolution(2)).toBe(false)
    expect(hasSolution(3)).toBe(false)
    for (let n = 4; n <= 10; n++) expect(hasSolution(n)).toBe(true)
  })
})

describe('findSolution', () => {
  it('returns a valid full solution for n = 4..8', () => {
    for (let n = 4; n <= 8; n++) {
      const sol = findSolution(n)
      expect(sol, `no solution found for n=${n}`).not.toBeNull()
      expect(isSolved(sol, n)).toBe(true)
    }
  })
  it('returns null for n = 2 and n = 3', () => {
    expect(findSolution(2)).toBeNull()
    expect(findSolution(3)).toBeNull()
  })
  it('respects fixed (pre-placed) queens', () => {
    const fixed = [{ r: 1, c: 0 }]
    const sol = findSolution(6, fixed)
    expect(sol).not.toBeNull()
    expect(isSolved(sol, 6)).toBe(true)
    // The fixed queen must be present in the returned solution.
    expect(sol).toContainEqual({ r: 1, c: 0 })
  })
})

describe('authored n-queens levels', () => {
  it('has the expected counts', () => {
    expect(nqueensLevels).toHaveLength(10)
    expect(nqueensLevels.filter((l) => l.difficulty === 'easy')).toHaveLength(3)
    expect(nqueensLevels.filter((l) => l.difficulty === 'medium')).toHaveLength(4)
    expect(nqueensLevels.filter((l) => l.difficulty === 'hard')).toHaveLength(3)
  })

  it('every level is solvable (incl. fixed-queen variants)', () => {
    for (const level of nqueensLevels) {
      expect(hasSolution(level.n)).toBe(true)
      const fixed = (level.fixed || []).map(([r, c]) => ({ r, c }))
      const sol = findSolution(level.n, fixed)
      expect(sol, `level ${level.id} (${level.name}) unsolvable`).not.toBeNull()
      expect(isSolved(sol, level.n)).toBe(true)
      for (const f of fixed) expect(sol).toContainEqual(f)
    }
  })
})
