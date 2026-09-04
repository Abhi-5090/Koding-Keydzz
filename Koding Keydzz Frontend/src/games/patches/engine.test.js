import { describe, it, expect } from 'vitest'
import {
  key,
  rectCells,
  rectArea,
  rectContains,
  overlaps,
  deriveType,
  cluesInRect,
  validateRect,
  validatePartition,
  isSolved,
  solve,
  hasUniqueSolution,
  nextHintRect,
} from './engine'
import patchesLevels from '../../data/patchesLevels'

// A tiny hand-made 3×3 level for focused unit tests.
//   clues: 3 @ (1,0), type 'h'    -> the top row 3×1 box (a single row)
//          6 @ (2,1), type 'plus' -> the bottom 3×2 box (any rectangle)
const mini = {
  id: 0,
  name: 'Mini',
  difficulty: 'easy',
  size: 3,
  maxHints: 2,
  clues: { '1,0': { n: 3, type: 'h' }, '2,1': { n: 6, type: 'plus' } },
  solution: [
    { x: 0, y: 0, w: 3, h: 1 },
    { x: 0, y: 1, w: 3, h: 2 },
  ],
}

/** Which orientation a solution box's shape implies. */
function shapeMatchesType(r, type) {
  if (type === 'h') return r.h === 1
  if (type === 'v') return r.w === 1
  return true // 'plus' → any
}

describe('geometry helpers', () => {
  it('key formats a cell', () => {
    expect(key(2, 3)).toBe('2,3')
  })
  it('rectCells lists every covered cell, row-major', () => {
    expect(rectCells({ x: 1, y: 1, w: 2, h: 2 })).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ])
  })
  it('rectArea multiplies w × h', () => {
    expect(rectArea({ x: 0, y: 0, w: 2, h: 3 })).toBe(6)
  })
  it('rectContains checks membership', () => {
    const r = { x: 1, y: 1, w: 2, h: 2 }
    expect(rectContains(r, 1, 1)).toBe(true)
    expect(rectContains(r, 2, 2)).toBe(true)
    expect(rectContains(r, 3, 2)).toBe(false)
    expect(rectContains(r, 0, 1)).toBe(false)
  })
  it('overlaps is true only when boxes share a cell', () => {
    expect(overlaps({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 })).toBe(true)
    expect(overlaps({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 })).toBe(false)
    expect(overlaps({ x: 0, y: 0, w: 2, h: 2 }, { x: 0, y: 2, w: 2, h: 2 })).toBe(false)
  })
  it('cluesInRect returns the enclosed typed clues', () => {
    expect(cluesInRect(mini, { x: 0, y: 0, w: 3, h: 1 })).toEqual([{ n: 3, type: 'h' }])
    const both = cluesInRect(mini, { x: 0, y: 0, w: 3, h: 3 })
    expect(both).toHaveLength(2)
    expect(both.map((c) => c.n).sort()).toEqual([3, 6])
    expect(cluesInRect(mini, { x: 0, y: 2, w: 1, h: 1 })).toEqual([])
  })
})

describe('deriveType', () => {
  it('reads orientation from a rectangle shape', () => {
    expect(deriveType({ x: 0, y: 0, w: 4, h: 1 })).toBe('h') // wide single row
    expect(deriveType({ x: 0, y: 0, w: 1, h: 4 })).toBe('v') // tall single column
    expect(deriveType({ x: 0, y: 0, w: 2, h: 3 })).toBe('plus') // 2D block
    expect(deriveType({ x: 0, y: 0, w: 1, h: 1 })).toBe('plus') // lone square
  })
})

describe('validateRect', () => {
  it('accepts a correct single-clue box whose area + orientation match', () => {
    expect(validateRect(mini, { x: 0, y: 0, w: 3, h: 1 })).toEqual({ ok: true, reason: null })
    expect(validateRect(mini, { x: 0, y: 1, w: 3, h: 2 })).toEqual({ ok: true, reason: null })
  })
  it('rejects a box with no clue', () => {
    const v = validateRect(mini, { x: 0, y: 2, w: 1, h: 1 })
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/no number/)
  })
  it('rejects a box with two clues', () => {
    const v = validateRect(mini, { x: 0, y: 0, w: 3, h: 3 })
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/two numbers/)
  })
  it('rejects a box whose area ≠ its clue', () => {
    // 3 @ (1,0) alone inside a 2×1 = area 2 box.
    const v = validateRect(mini, { x: 0, y: 0, w: 2, h: 1 })
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/exactly that many cells/)
  })
  it('rejects an out-of-bounds box', () => {
    const v = validateRect(mini, { x: 2, y: 2, w: 3, h: 1 })
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/off the grid/)
  })

  it('rejects an h-clue box that is not a single row (right area, wrong shape)', () => {
    // 3 @ (1,0) is type 'h'. A 1×3 column has the right area but height 3.
    const v = validateRect(mini, { x: 1, y: 0, w: 1, h: 3 })
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/single row/)
  })
  it('accepts an h-clue box that IS a single row', () => {
    expect(validateRect(mini, { x: 0, y: 0, w: 3, h: 1 }).ok).toBe(true)
  })

  it('rejects a v-clue box that is not a single column (right area, wrong shape)', () => {
    const vLevel = { size: 3, clues: { '1,1': { n: 3, type: 'v' } } }
    // area 3, contains the clue, but width 3 → not a column.
    const bad = validateRect(vLevel, { x: 0, y: 1, w: 3, h: 1 })
    expect(bad.ok).toBe(false)
    expect(bad.reason).toMatch(/single column/)
    // correct: a 1×3 column.
    expect(validateRect(vLevel, { x: 1, y: 0, w: 1, h: 3 }).ok).toBe(true)
  })

  it('a plus-clue box may be any rectangle of the right area', () => {
    const pLevel = { size: 3, clues: { '1,1': { n: 6, type: 'plus' } } }
    expect(validateRect(pLevel, { x: 0, y: 0, w: 3, h: 2 }).ok).toBe(true) // wide
    expect(validateRect(pLevel, { x: 1, y: 0, w: 2, h: 3 }).ok).toBe(true) // tall
    expect(validateRect(pLevel, { x: 0, y: 0, w: 3, h: 2 }).reason).toBe(null)
  })
})

describe('validatePartition', () => {
  it('accepts the authored full partition', () => {
    const v = validatePartition(mini, mini.solution)
    expect(v).toEqual({ ok: true, complete: true, reason: null })
  })
  it('a single valid box is ok but not complete', () => {
    const v = validatePartition(mini, [{ x: 0, y: 0, w: 3, h: 1 }])
    expect(v.ok).toBe(true)
    expect(v.complete).toBe(false)
  })
  it('rejects overlapping boxes', () => {
    const v = validatePartition(mini, [
      { x: 0, y: 0, w: 3, h: 1 },
      { x: 0, y: 0, w: 3, h: 2 }, // would overlap the first (and be invalid too)
    ])
    expect(v.ok).toBe(false)
  })
  it('flags an incomplete cover', () => {
    const v = validatePartition(mini, [{ x: 0, y: 0, w: 3, h: 1 }])
    expect(v.complete).toBe(false)
  })
})

describe('isSolved', () => {
  it('true for the mini solution, false for a partial', () => {
    expect(isSolved(mini, mini.solution)).toBe(true)
    expect(isSolved(mini, mini.solution.slice(0, 1))).toBe(false)
  })
})

describe('solve', () => {
  it('finds the unique tiling of the mini level', () => {
    const sols = solve(mini, { limit: 2 })
    expect(sols).toHaveLength(1)
    expect(isSolved(mini, sols[0])).toBe(true)
  })
  it('hasUniqueSolution is true for the mini level', () => {
    expect(hasUniqueSolution(mini)).toBe(true)
  })
  it('respects clue orientation when enumerating (a v-typed row-clue kills the tiling)', () => {
    // Flip the top-row clue from 'h' to 'v': a width-3 strip can no longer be a
    // single column, so no tiling exists under the orientation rules.
    const flipped = {
      ...mini,
      clues: { '1,0': { n: 3, type: 'v' }, '2,1': { n: 6, type: 'plus' } },
    }
    expect(solve(flipped, { limit: 2 })).toHaveLength(0)
  })
})

describe('nextHintRect', () => {
  it('returns the first not-yet-placed solution box', () => {
    expect(nextHintRect(mini, [])).toEqual(mini.solution[0])
    expect(nextHintRect(mini, [mini.solution[0]])).toEqual(mini.solution[1])
  })
  it('returns null once every box is placed', () => {
    expect(nextHintRect(mini, mini.solution)).toBe(null)
  })
})

describe('authored levels', () => {
  /**
   * The level set is now GENERATED and tiered — 170 puzzles across five unlock
   * tiers, rather than the original 20 hand-authored ones. Exact counts, the
   * per-tier distribution and single-solution fairness are asserted in
   * levels.test.js. What remains here is the shape contract the engine relies
   * on, which is independent of how many levels exist.
   */
  it('has unique, ascending ids', () => {
    const ids = patchesLevels.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    patchesLevels.forEach((l, i) => expect(l.id).toBe(i + 1))
  })

  it('keeps each difficulty within its own grid-size band', () => {
    // Generated levels widen the grid as the tiers climb, so exact per-size
    // counts are no longer fixed. The band each difficulty occupies still is:
    // easy stays small, hard stays large, and they must not overlap.
    const range = (d) => {
      const sizes = patchesLevels.filter((l) => l.difficulty === d).map((l) => l.size)
      return { min: Math.min(...sizes), max: Math.max(...sizes) }
    }
    const easy = range('easy')
    const medium = range('medium')
    const hard = range('hard')

    expect(easy.min).toBeGreaterThanOrEqual(3)
    expect(easy.max).toBeLessThanOrEqual(medium.max)
    expect(medium.max).toBeLessThanOrEqual(hard.max)
    expect(hard.max).toBeLessThanOrEqual(9)
  })

  it('ramps hints down by TIER, not by level id', () => {
    // Hints used to taper across a fixed 20-level list. With five tiers the
    // taper belongs to the tier: the base tier is generous, later tiers are
    // solo, so a newly-unlocked level is not handed the same crutches.
    for (const l of patchesLevels) {
      expect(l.maxHints).toBeLessThanOrEqual(2)
      expect(l.maxHints).toBeGreaterThanOrEqual(0)
      if (l.tier >= 3) expect(l.maxHints, `level ${l.id}`).toBe(0)
      if (l.tier === 0) expect(l.maxHints, `level ${l.id}`).toBe(2)
    }
  })

  it('every clue carries a valid orientation type', () => {
    for (const l of patchesLevels) {
      for (const clue of Object.values(l.clues)) {
        expect(['h', 'v', 'plus']).toContain(clue.type)
        expect(Number.isInteger(clue.n)).toBe(true)
        expect(clue.n).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('uses a MIX of clue types — several levels have more than one distinct type', () => {
    const multi = patchesLevels.filter(
      (l) => new Set(Object.values(l.clues).map((c) => c.type)).size > 1
    )
    expect(multi.length).toBeGreaterThanOrEqual(2)
    // all three types appear somewhere across the set
    const all = new Set(patchesLevels.flatMap((l) => Object.values(l.clues).map((c) => c.type)))
    expect(all).toEqual(new Set(['h', 'v', 'plus']))
  })

  it('every solution fully tiles the grid (each cell covered exactly once)', () => {
    for (const l of patchesLevels) {
      const seen = new Set()
      let covered = 0
      for (const r of l.solution) {
        for (const c of rectCells(r)) {
          const k = key(c.x, c.y)
          expect(seen.has(k)).toBe(false) // no overlap
          expect(c.x).toBeGreaterThanOrEqual(0)
          expect(c.y).toBeGreaterThanOrEqual(0)
          expect(c.x).toBeLessThan(l.size)
          expect(c.y).toBeLessThan(l.size)
          seen.add(k)
          covered += 1
        }
      }
      expect(covered).toBe(l.size * l.size) // full cover
      expect(seen.size).toBe(l.size * l.size)
    }
  })

  it('every solution box holds exactly one clue whose area AND shape match its type', () => {
    for (const l of patchesLevels) {
      for (const r of l.solution) {
        const inside = cluesInRect(l, r)
        expect(inside).toHaveLength(1)
        expect(inside[0].n).toBe(rectArea(r))
        expect(shapeMatchesType(r, inside[0].type)).toBe(true)
      }
      // clue count equals box count (every clue is used exactly once)
      expect(Object.keys(l.clues)).toHaveLength(l.solution.length)
      // the authored solution actually solves the level
      expect(isSolved(l, l.solution)).toBe(true)
    }
  })

  it('every level is UNIQUELY solvable under the orientation rules', () => {
    for (const l of patchesLevels) {
      const sols = solve(l, { limit: 2 })
      expect(sols).toHaveLength(1)
      expect(isSolved(l, sols[0])).toBe(true)
    }
  })
})
