import { describe, it, expect } from 'vitest'
import levels from '../../data/sudokuLevels'
import { isSolvedSolution, boxDims } from './engine'

/**
 * EVERY GENERATED SUDOKU MUST BE FAIR.
 *
 * The generator claims each puzzle has exactly one solution. This file does not
 * take its word for it — it re-derives the property here, with an independent
 * solver and the engine's own validator, because a generator bug produces
 * puzzles that look perfectly normal and are quietly unsolvable or ambiguous.
 *
 * An ambiguous puzzle is the worst failure this game can have: a child fills in
 * a grid that breaks no rule, and is told they are wrong. They have no way to
 * discover that the puzzle, not their reasoning, was at fault.
 */

/**
 * An independent solution counter — deliberately not the generator's.
 *
 * Note the destructure: the engine returns `{ rows, cols }`. Reading `{ br, bc }`
 * off it (as this first did) yields two undefineds, `Math.floor(r / undefined)`
 * is NaN, and the box loop never runs — producing a solver that checks rows and
 * columns but not boxes, and therefore reports perfectly fair puzzles as having
 * two or three "solutions". Every one of them broke the box rule.
 */
function countSolutions(grid, size, limit = 2) {
  const { rows: br, cols: bc } = boxDims(size)

  const canPlace = (g, r, c, v) => {
    for (let i = 0; i < size; i += 1) {
      if (g[r][i] === v || g[i][c] === v) return false
    }
    const r0 = Math.floor(r / br) * br
    const c0 = Math.floor(c / bc) * bc
    for (let i = r0; i < r0 + br; i += 1) {
      for (let j = c0; j < c0 + bc; j += 1) {
        if (g[i][j] === v) return false
      }
    }
    return true
  }

  const work = grid.map((row) => [...row])

  const solve = () => {
    let target = null
    let options = null
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (work[r][c] !== 0) continue
        const cand = []
        for (let v = 1; v <= size; v += 1) if (canPlace(work, r, c, v)) cand.push(v)
        if (cand.length === 0) return 0
        if (!target || cand.length < options.length) {
          target = { r, c }
          options = cand
        }
      }
    }
    if (!target) return 1

    let found = 0
    for (const v of options) {
      work[target.r][target.c] = v
      found += solve()
      work[target.r][target.c] = 0
      if (found >= limit) break
    }
    return found
  }

  return solve()
}

const TIER_PLAN = {
  0: { easy: 25, medium: 15, hard: 10 },
  1: { easy: 15, medium: 10, hard: 5 },
  2: { easy: 15, medium: 10, hard: 5 },
  3: { easy: 15, medium: 10, hard: 5 },
  4: { easy: 15, medium: 10, hard: 5 },
}

describe('generated sudoku levels', () => {
  it('has the level count the tier plan asks for', () => {
    const counts = {}
    for (const l of levels) {
      counts[l.tier] = counts[l.tier] || {}
      counts[l.tier][l.difficulty] = (counts[l.tier][l.difficulty] || 0) + 1
    }
    expect(counts).toEqual(TIER_PLAN)
    expect(levels).toHaveLength(170)
  })

  it('gives every level a unique id', () => {
    const ids = levels.map((l) => l.id)
    expect(new Set(ids).size, 'duplicate level ids').toBe(ids.length)
  })

  it('NEVER repeats a puzzle', () => {
    /**
     * The requirement that motivated generating these at all: no two levels
     * may be the same puzzle. Fingerprinted on the starting grid, since that
     * is what a pupil actually sees and solves.
     */
    const seen = new Map()
    for (const l of levels) {
      const fp = l.givens.map((r) => r.join('')).join('/')
      const clash = seen.get(fp)
      expect(
        clash,
        `level ${l.id} ("${l.name}") is the same puzzle as level ${clash}`
      ).toBeUndefined()
      seen.set(fp, l.id)
    }
  })

  it('has a valid, complete solution for every level', () => {
    for (const l of levels) {
      expect(isSolvedSolution(l.solution, l.size), `level ${l.id} solution invalid`).toBe(
        true
      )
    }
  })

  it('only ever shows cells that agree with the solution', () => {
    // A given that contradicts the solution makes the puzzle impossible while
    // looking entirely normal.
    for (const l of levels) {
      for (let r = 0; r < l.size; r += 1) {
        for (let c = 0; c < l.size; c += 1) {
          const g = l.givens[r][c]
          if (g === 0) continue
          expect(g, `level ${l.id} given at ${r},${c} contradicts its solution`).toBe(
            l.solution[r][c]
          )
        }
      }
    }
  })

  it('leaves something to solve', () => {
    // A puzzle with no blanks is not a puzzle.
    for (const l of levels) {
      const blanks = l.givens.flat().filter((v) => v === 0).length
      expect(blanks, `level ${l.id} has nothing to fill in`).toBeGreaterThan(0)
    }
  })

  it('has EXACTLY ONE solution for every level', () => {
    /**
     * The one that matters most, re-proved with the independent solver above.
     *
     * Two solutions means a child can solve the puzzle correctly and be marked
     * wrong. Zero means it cannot be solved at all.
     */
    const bad = []
    for (const l of levels) {
      const n = countSolutions(l.givens, l.size, 2)
      if (n !== 1) {
        bad.push(`level ${l.id} ("${l.name}", ${l.difficulty} t${l.tier}): ${n} solutions`)
      }
    }
    expect(bad, `unfair puzzles:\n${bad.join('\n')}`).toEqual([])
  }, 120_000)

  it('uses the grid size its difficulty promises', () => {
    const expected = { easy: 4, medium: 6, hard: 9 }
    for (const l of levels) {
      expect(l.size, `level ${l.id} wrong size for ${l.difficulty}`).toBe(
        expected[l.difficulty]
      )
    }
  })

  it('gets harder as the tiers climb, not just different', () => {
    /**
     * A later tier that were merely a reshuffle would be new levels with
     * nothing new to offer. Fewer givens is what makes a tier-4 easy puzzle a
     * genuine step up from a tier-0 one on the same size board.
     */
    for (const difficulty of ['easy', 'medium', 'hard']) {
      const avgGivens = (tier) => {
        const set = levels.filter((l) => l.difficulty === difficulty && l.tier === tier)
        return set.reduce((s, l) => s + l.givenCount, 0) / set.length
      }
      expect(
        avgGivens(4),
        `${difficulty}: tier 4 is no harder than tier 0`
      ).toBeLessThan(avgGivens(0))
    }
  })

  it('tightens the hint allowance as the tiers climb', () => {
    // Hints are training wheels. Carrying two of them into the last tier would
    // undo the difficulty the sparser grids are there to create.
    for (const l of levels) {
      expect(l.maxHints).toBeLessThanOrEqual(2)
      if (l.tier >= 3) {
        expect(l.maxHints, `level ${l.id} still offers hints at tier ${l.tier}`).toBe(0)
      }
    }
  })

  it('opens with a tier-0 level, so a new pupil can always start', () => {
    // The unlock chain opens index 0. If the list did not begin at tier 0, a
    // brand-new pupil would find the game locked from the first screen.
    expect(levels[0].tier).toBe(0)
    expect(levels.filter((l) => l.tier === 0).length).toBe(50)
  })
})
