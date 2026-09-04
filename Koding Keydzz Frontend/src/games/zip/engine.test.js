import { describe, it, expect } from 'vitest'
import {
  key,
  cellCount,
  isAdjacent,
  hasWall,
  numberAt,
  numberCount,
  validatePath,
  isSolved,
  nextHintCell,
  matchedPrefixLength,
} from './engine'
import zipLevels from '../../data/zipLevels'

// A tiny hand-made 3x3 level for focused unit tests.
//   numbers: 1 @ (0,0), 2 @ (2,0), 3 @ (2,2)
//   a wall between (0,0) and (1,0)
//   solution snakes through all 9 cells.
const mini = {
  id: 0,
  name: 'Mini',
  difficulty: 'easy',
  cols: 3,
  rows: 3,
  maxHints: 2,
  numbers: { '0,0': 1, '2,0': 2, '2,2': 3 },
  walls: [['0,0', '1,0']],
  solution: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
  ],
}

describe('helpers', () => {
  it('key formats a cell', () => {
    expect(key(2, 3)).toBe('2,3')
  })
  it('cellCount multiplies cols x rows', () => {
    expect(cellCount(mini)).toBe(9)
  })
  it('isAdjacent is true only for orthogonal neighbours', () => {
    expect(isAdjacent({ x: 1, y: 1 }, { x: 1, y: 2 })).toBe(true)
    expect(isAdjacent({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe(true)
    expect(isAdjacent({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(false) // diagonal
    expect(isAdjacent({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(false) // same
    expect(isAdjacent({ x: 1, y: 1 }, { x: 1, y: 3 })).toBe(false) // far
  })
  it('hasWall checks both edge orientations', () => {
    expect(hasWall(mini, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true)
    expect(hasWall(mini, { x: 1, y: 0 }, { x: 0, y: 0 })).toBe(true)
    expect(hasWall(mini, { x: 0, y: 0 }, { x: 0, y: 1 })).toBe(false)
  })
  it('numberAt returns the checkpoint number or null', () => {
    expect(numberAt(mini, 0, 0)).toBe(1)
    expect(numberAt(mini, 2, 2)).toBe(3)
    expect(numberAt(mini, 1, 1)).toBe(null)
  })
  it('numberCount counts the checkpoints', () => {
    expect(numberCount(mini)).toBe(3)
  })
})

describe('validatePath', () => {
  it('an empty path is a valid (incomplete) prefix', () => {
    expect(validatePath(mini, [])).toEqual({ ok: true, complete: false, reason: null })
  })

  it('accepts a partial valid path as ok-but-not-complete', () => {
    const partial = mini.solution.slice(0, 4)
    const res = validatePath(mini, partial)
    expect(res.ok).toBe(true)
    expect(res.complete).toBe(false)
  })

  it('requires adjacency between consecutive cells', () => {
    const res = validatePath(mini, [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
    ])
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/next door/)
  })

  it('rejects crossing a wall', () => {
    const res = validatePath(mini, [
      { x: 0, y: 0 },
      { x: 1, y: 0 }, // blocked edge
    ])
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('crosses a wall')
  })

  it('rejects revisiting a cell', () => {
    const res = validatePath(mini, [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ])
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('already visited')
  })

  it('rejects going off the grid', () => {
    const res = validatePath(mini, [{ x: -1, y: 0 }])
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('goes off the grid')
  })

  it('rejects numbers reached out of order', () => {
    // Start on 1, then reach 3's cell before 2 -> out of order.
    // Path 0,0 -> 0,1 -> 0,2 -> 1,2 -> 2,2 (that cell is number 3, visited 2nd)
    const res = validatePath(mini, [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ])
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('numbers out of order')
  })

  it('rejects starting on a number other than 1', () => {
    const res = validatePath(mini, [{ x: 2, y: 0 }]) // number 2 first
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('numbers out of order')
  })

  it('marks the authored solution complete', () => {
    const res = validatePath(mini, mini.solution)
    expect(res).toEqual({ ok: true, complete: true, reason: null })
  })

  it('a full-cover path that ends on the wrong number is not accepted', () => {
    // Reverse solution: would start on number 3 -> out of order.
    const res = validatePath(mini, mini.solution.slice().reverse())
    expect(res.ok).toBe(false)
  })
})

describe('isSolved', () => {
  it('true for the mini solution, false for a partial', () => {
    expect(isSolved(mini, mini.solution)).toBe(true)
    expect(isSolved(mini, mini.solution.slice(0, 5))).toBe(false)
  })
})

describe('nextHintCell / matchedPrefixLength', () => {
  it('from empty, points at the start (number 1) cell', () => {
    expect(nextHintCell(mini, [])).toEqual(mini.solution[0])
    expect(matchedPrefixLength(mini, [])).toBe(0)
  })

  it('extends a correct prefix by exactly one adjacent cell', () => {
    const prefix = mini.solution.slice(0, 3)
    const next = nextHintCell(mini, prefix)
    expect(next).toEqual(mini.solution[3])
    expect(isAdjacent(prefix[prefix.length - 1], next)).toBe(true)
    expect(matchedPrefixLength(mini, prefix)).toBe(3)
  })

  it('after diverging, points back onto the solution route', () => {
    // Correct first two cells, then a wrong 3rd cell.
    const diverged = [mini.solution[0], mini.solution[1], { x: 1, y: 1 }]
    expect(matchedPrefixLength(mini, diverged)).toBe(2)
    expect(nextHintCell(mini, diverged)).toEqual(mini.solution[2])
  })

  it('returns null once the whole solution is matched', () => {
    expect(nextHintCell(mini, mini.solution)).toBe(null)
  })
})

describe('authored levels', () => {
  /**
   * The level set is now GENERATED and tiered — 170 puzzles across five unlock
   * tiers, rather than the original 12. Exact counts, the tier plan and
   * single-solution fairness are asserted in levels.test.js. What remains here
   * is the shape contract the engine depends on, independent of how many
   * levels exist.
   */
  it('has unique, ascending ids', () => {
    const ids = zipLevels.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    zipLevels.forEach((l, i) => expect(l.id).toBe(i + 1))
  })

  it('keeps each difficulty within its own board-size band', () => {
    // Generated levels grow the board as the tiers climb, so exact per-size
    // counts are no longer fixed. The bands still are, and must not overlap.
    const cells = (d) => zipLevels.filter((l) => l.difficulty === d).map((l) => l.cols * l.rows)
    const easy = cells('easy')
    const medium = cells('medium')
    const hard = cells('hard')
    expect(easy.length).toBeGreaterThan(0)
    expect(Math.max(...easy)).toBeLessThanOrEqual(Math.max(...medium))
    expect(Math.max(...medium)).toBeLessThanOrEqual(Math.max(...hard))
  })

  it('ramps hints down by TIER rather than by level id', () => {
    // Hints used to taper across a fixed 12-level list. With tiers the taper
    // belongs to the tier, so a newly-unlocked level is not handed the same
    // crutches as a beginner's first puzzle.
    for (const l of zipLevels) {
      const expected = l.tier >= 3 ? 0 : l.tier >= 1 ? 1 : 2
      expect(l.maxHints, `level ${l.id} at tier ${l.tier}`).toBe(expected)
    }
  })

  it('every level numbers are contiguous 1..k and start-consistent', () => {
    for (const l of zipLevels) {
      const vals = Object.values(l.numbers).sort((a, b) => a - b)
      expect(vals[0]).toBe(1)
      vals.forEach((v, i) => expect(v).toBe(i + 1))
    }
  })

  it("every level's solution covers all cells exactly once, in order, and isSolved", () => {
    for (const l of zipLevels) {
      // covers all cells exactly once
      expect(l.solution).toHaveLength(cellCount(l))
      const seen = new Set(l.solution.map((c) => key(c.x, c.y)))
      expect(seen.size).toBe(cellCount(l))
      // every cell in bounds
      for (const c of l.solution) {
        expect(c.x).toBeGreaterThanOrEqual(0)
        expect(c.y).toBeGreaterThanOrEqual(0)
        expect(c.x).toBeLessThan(l.cols)
        expect(c.y).toBeLessThan(l.rows)
      }
      // consecutive cells adjacent and not wall-separated
      for (let i = 1; i < l.solution.length; i++) {
        expect(isAdjacent(l.solution[i - 1], l.solution[i])).toBe(true)
        expect(hasWall(l, l.solution[i - 1], l.solution[i])).toBe(false)
      }
      // fully solved
      expect(isSolved(l, l.solution)).toBe(true)
    }
  })

  it('walls never block the authored solution and reference real edges', () => {
    for (const l of zipLevels) {
      const pathEdges = new Set()
      for (let i = 1; i < l.solution.length; i++) {
        const a = l.solution[i - 1]
        const b = l.solution[i]
        const ka = key(a.x, a.y)
        const kb = key(b.x, b.y)
        pathEdges.add(ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`)
      }
      for (const [w1, w2] of l.walls) {
        const [x1, y1] = w1.split(',').map(Number)
        const [x2, y2] = w2.split(',').map(Number)
        // a wall is between two orthogonally adjacent, in-bounds cells
        expect(isAdjacent({ x: x1, y: y1 }, { x: x2, y: y2 })).toBe(true)
        // and never lies on the solution path
        const ew = w1 < w2 ? `${w1}|${w2}` : `${w2}|${w1}`
        expect(pathEdges.has(ew)).toBe(false)
      }
    }
  })

  it('the number placement matches the solution order (checkpoint i on the i-th number cell reached)', () => {
    for (const l of zipLevels) {
      let count = 0
      for (const c of l.solution) {
        const n = numberAt(l, c.x, c.y)
        if (n != null) {
          count += 1
          expect(n).toBe(count)
        }
      }
      expect(count).toBe(numberCount(l))
    }
  })
})
