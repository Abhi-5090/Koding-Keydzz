import { describe, it, expect } from 'vitest'
import levels from '../../data/nqueensLevels'
import { findSolution, conflicts, isSolved, hasSolution } from './engine'

/**
 * EVERY N-QUEENS LEVEL MUST BE COMPLETABLE FROM ITS STARTING QUEENS.
 *
 * This game does NOT need a unique answer — `isSolved` accepts any arrangement
 * of n non-attacking queens, and demanding one would be wrong for the puzzle.
 * What it does need is that the pre-placed queens can actually be extended to a
 * full solution. A level whose given queens already conflict, or which paints
 * itself into a corner, looks completely normal and cannot be finished.
 *
 * So the check here is the one that matters: hand each level's `fixed` queens to
 * the ENGINE'S OWN solver and require a completion.
 */

const TIER_PLAN = {
  0: { easy: 25, medium: 15, hard: 10 },
  1: { easy: 15, medium: 10, hard: 5 },
  2: { easy: 15, medium: 10, hard: 5 },
  3: { easy: 15, medium: 10, hard: 5 },
  4: { easy: 15, medium: 10, hard: 5 },
}

const asQueens = (fixed) => (fixed || []).map(([r, c]) => ({ r, c }))

describe('generated n-queens levels', () => {
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
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('NEVER repeats a level', () => {
    /**
     * Fingerprinted on board size AND starting queens together.
     *
     * Both halves matter, and leaving either out is a real bug this generator
     * hit twice: sampling from a deterministic solver produced subsets of one
     * arrangement, and a tier with no starting queens collapsed to "one level
     * per board size".
     */
    const seen = new Map()
    for (const l of levels) {
      const fp = `${l.n}|${(l.fixed || [])
        .map(([r, c]) => `${r},${c}`)
        .sort()
        .join(';')}`
      const clash = seen.get(fp)
      expect(clash, `level ${l.id} duplicates level ${clash}`).toBeUndefined()
      seen.set(fp, l.id)
    }
  })

  it('can be COMPLETED from its starting queens, per the engine’s own solver', () => {
    // The property that decides whether a level is playable at all.
    const impossible = []
    for (const l of levels) {
      const solution = findSolution(l.n, asQueens(l.fixed))
      if (!solution) {
        impossible.push(`level ${l.id} (${l.n}x${l.n}, ${(l.fixed || []).length} given)`)
      }
    }
    expect(impossible, `unsolvable levels:\n${impossible.join('\n')}`).toEqual([])
  }, 60_000)

  it('produces a genuinely valid board when completed', () => {
    // Not just "the solver returned something" — the result must satisfy the
    // same isSolved the pupil's attempt is judged by.
    for (const l of levels) {
      const solution = findSolution(l.n, asQueens(l.fixed))
      expect(isSolved(solution, l.n), `level ${l.id} completion invalid`).toBe(true)
    }
  }, 60_000)

  it('never starts a level with queens that already attack each other', () => {
    // The most obvious way to ship an impossible level, and invisible on the
    // board until a child has tried for ten minutes.
    for (const l of levels) {
      const given = asQueens(l.fixed)
      expect(conflicts(given).length, `level ${l.id} starts in conflict`).toBe(0)
    }
  })

  it('keeps the starting queens on the board', () => {
    for (const l of levels) {
      for (const [r, c] of l.fixed || []) {
        expect(r, `level ${l.id} row out of range`).toBeGreaterThanOrEqual(0)
        expect(r).toBeLessThan(l.n)
        expect(c, `level ${l.id} col out of range`).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThan(l.n)
      }
    }
  })

  it('always leaves at least one queen for the pupil to place', () => {
    // A fully pre-placed board is a picture, not a puzzle.
    for (const l of levels) {
      expect((l.fixed || []).length, `level ${l.id} is already solved`).toBeLessThan(l.n)
    }
  })

  it('only uses board sizes that have a solution at all', () => {
    // 2x2 and 3x3 have none. Shipping one would be an unwinnable level.
    for (const l of levels) {
      expect(l.n).toBeGreaterThanOrEqual(4)
      expect(l.n).toBeLessThanOrEqual(12)
      expect(hasSolution(l.n), `${l.n}x${l.n} has no solution`).toBe(true)
    }
  })

  it('runs difficulty on BOTH dials — board size up, help down', () => {
    /**
     * The difficulty model, asserted because it is counter-intuitive: MORE
     * pre-placed queens makes a level EASIER, not harder. So hard levels must
     * be bigger boards AND give less away. Getting the second half backwards
     * would produce a "hard" tier that is easier than easy.
     */
    const avg = (d, f) => {
      const set = levels.filter((l) => l.difficulty === d)
      return set.reduce((s, l) => s + f(l), 0) / set.length
    }
    const boardOf = (l) => l.n
    const helpOf = (l) => (l.fixed || []).length / l.n

    expect(avg('hard', boardOf)).toBeGreaterThan(avg('easy', boardOf))
    expect(avg('hard', helpOf), 'hard levels give MORE help than easy').toBeLessThan(
      avg('easy', helpOf)
    )
  })

  it('gets harder as the tiers climb', () => {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      const helpAt = (tier) => {
        const set = levels.filter((l) => l.difficulty === difficulty && l.tier === tier)
        return set.reduce((s, l) => s + (l.fixed || []).length / l.n, 0) / set.length
      }
      // Later tiers hand over a smaller share of the board.
      expect(helpAt(4), `${difficulty}: tier 4 gives as much help as tier 0`).toBeLessThan(
        helpAt(0)
      )
    }
  })

  it('allows enough time for the queens actually left to place', () => {
    // A time limit set for an easy board would make a hard one unwinnable for
    // reasons that have nothing to do with the puzzle.
    for (const l of levels) {
      const toPlace = l.n - (l.fixed || []).length
      expect(l.timeLimit, `level ${l.id} too tight`).toBeGreaterThanOrEqual(toPlace * 10)
    }
  })

  it('tightens the hint allowance as the tiers climb', () => {
    for (const l of levels) {
      const expected = l.tier >= 3 ? 0 : l.tier >= 1 ? 1 : 2
      expect(l.maxHints, `level ${l.id} at tier ${l.tier}`).toBe(expected)
    }
  })

  it('opens with a tier-0 level', () => {
    expect(levels[0].tier).toBe(0)
    expect(levels.filter((l) => l.tier === 0)).toHaveLength(50)
  })
})
