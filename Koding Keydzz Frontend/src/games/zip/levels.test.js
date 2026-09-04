import { describe, it, expect } from 'vitest'
import levels from '../../data/zipLevels'
import { isSolved, validatePath, cellCount, hasWall, isAdjacent, key } from './engine'

/**
 * EVERY GENERATED ZIP PUZZLE MUST BE SOLVABLE, AND SOLVABLE ONE WAY.
 *
 * Two failures to guard against, and for this game the first is the likelier:
 *
 *   • UNSOLVABLE. Checkpoints placed on a grid that admits no Hamiltonian path
 *     through them in order gives a puzzle a child can work at forever. The
 *     generator avoids it by building each puzzle FROM a real path — and this
 *     file re-checks that the stored path is genuinely valid, using the game's
 *     own validator rather than the generator's.
 *
 *   • AMBIGUOUS. Two valid paths means a pupil can solve it correctly and be
 *     rejected. Re-counted below with an independent search.
 */

const TIER_PLAN = {
  0: { easy: 25, medium: 15, hard: 10 },
  1: { easy: 15, medium: 10, hard: 5 },
  2: { easy: 15, medium: 10, hard: 5 },
  3: { easy: 15, medium: 10, hard: 5 },
  4: { easy: 15, medium: 10, hard: 5 },
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/** An independent path counter — deliberately not the generator's. */
function countPaths(level, limit = 2) {
  const { cols, rows, numbers } = level
  const total = cols * rows
  const checkpoints = new Map(Object.entries(numbers))
  const highest = Math.max(...checkpoints.values())

  const startKey = [...checkpoints.entries()].find(([, n]) => n === 1)?.[0]
  if (!startKey) return 0
  const [sx, sy] = startKey.split(',').map(Number)

  const visited = new Set()
  const inside = (x, y) => x >= 0 && x < cols && y >= 0 && y < rows

  // Wall checks go through the ENGINE's hasWall, so the counter cannot
  // disagree with the game about what is blocked.
  const blockedBetween = (a, b) => hasWall(level, a, b)

  const stillConnected = (from) => {
    const seen = new Set([key(from.x, from.y)])
    const queue = [from]
    let reached = 0
    while (queue.length) {
      const cur = queue.pop()
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx
        const ny = cur.y + dy
        const k = key(nx, ny)
        if (!inside(nx, ny) || visited.has(k) || seen.has(k)) continue
        if (blockedBetween(cur, { x: nx, y: ny })) continue
        seen.add(k)
        reached += 1
        queue.push({ x: nx, y: ny })
      }
    }
    return reached === total - visited.size
  }

  let found = 0

  const walk = (cur, due) => {
    if (found >= limit) return
    const ck = key(cur.x, cur.y)
    const here = checkpoints.get(ck)
    let next = due
    if (here != null) {
      if (here !== next) return
      next = here + 1
    }

    visited.add(ck)
    if (visited.size === total) {
      if (next > highest) found += 1
      visited.delete(ck)
      return
    }

    if (stillConnected(cur)) {
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx
        const ny = cur.y + dy
        if (!inside(nx, ny) || visited.has(key(nx, ny))) continue
        if (blockedBetween(cur, { x: nx, y: ny })) continue
        walk({ x: nx, y: ny }, next)
        if (found >= limit) break
      }
    }
    visited.delete(ck)
  }

  walk({ x: sx, y: sy }, 1)
  return found
}

describe('generated zip levels', () => {
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

  it('NEVER repeats a puzzle', () => {
    // Fingerprinted on grid, checkpoints and walls — everything a pupil sees.
    const seen = new Map()
    for (const l of levels) {
      const fp = `${l.cols}x${l.rows}|${Object.entries(l.numbers)
        .map(([k, n]) => `${k}:${n}`)
        .sort()
        .join(',')}|${(l.walls || [])
        .map(([a, b]) => [a, b].sort().join('-'))
        .sort()
        .join(',')}`
      const clash = seen.get(fp)
      expect(clash, `level ${l.id} duplicates level ${clash}`).toBeUndefined()
      seen.set(fp, l.id)
    }
  })

  it('is accepted by the GAME’S OWN validator', () => {
    /**
     * The verdict that counts: this is the code that will judge a pupil.
     * A generator that agrees only with itself proves nothing.
     */
    for (const l of levels) {
      expect(isSolved(l, l.solution), `engine rejects level ${l.id}`).toBe(true)
      const v = validatePath(l, l.solution)
      expect(v.complete, `level ${l.id} incomplete`).toBe(true)
    }
  })

  it('fills every cell exactly once', () => {
    for (const l of levels) {
      expect(l.solution).toHaveLength(cellCount(l))
      const seen = new Set(l.solution.map((c) => key(c.x, c.y)))
      expect(seen.size, `level ${l.id} revisits a cell`).toBe(cellCount(l))
    }
  })

  it('moves only between adjacent cells, and never through a wall', () => {
    for (const l of levels) {
      for (let i = 0; i + 1 < l.solution.length; i += 1) {
        const a = l.solution[i]
        const b = l.solution[i + 1]
        expect(isAdjacent(a, b), `level ${l.id} jumps at step ${i}`).toBe(true)
        expect(hasWall(l, a, b), `level ${l.id} crosses a wall at step ${i}`).toBe(false)
      }
    }
  })

  it('collects the checkpoints in ascending order', () => {
    for (const l of levels) {
      const order = []
      for (const c of l.solution) {
        const n = l.numbers[key(c.x, c.y)]
        if (n != null) order.push(n)
      }
      const expected = Array.from({ length: order.length }, (_, i) => i + 1)
      expect(order, `level ${l.id} checkpoint order`).toEqual(expected)
      // Every checkpoint must actually be on the path.
      expect(order).toHaveLength(Object.keys(l.numbers).length)
    }
  })

  it('starts on checkpoint 1', () => {
    // A path cannot reach checkpoint 1 later and come back, so it must begin
    // there. A level numbered otherwise is unsolvable.
    for (const l of levels) {
      const first = l.solution[0]
      expect(l.numbers[key(first.x, first.y)], `level ${l.id} start`).toBe(1)
    }
  })

  it('has EXACTLY ONE solution for every level', () => {
    // Re-proved with the independent counter above.
    const bad = []
    for (const l of levels) {
      const n = countPaths(l, 2)
      if (n !== 1) bad.push(`level ${l.id} (${l.difficulty} t${l.tier}): ${n} paths`)
    }
    expect(bad, `unfair puzzles:\n${bad.join('\n')}`).toEqual([])
  }, 180_000)

  it('never walls off an edge its own solution needs', () => {
    /**
     * The property the whole generation strategy rests on: walls are drawn
     * only from edges the intended path does not cross, so a wall can remove
     * rival paths but never the real one. Checked directly, because getting it
     * wrong produces an unsolvable level that still looks plausible.
     */
    for (const l of levels) {
      const used = new Set()
      for (let i = 0; i + 1 < l.solution.length; i += 1) {
        const a = key(l.solution[i].x, l.solution[i].y)
        const b = key(l.solution[i + 1].x, l.solution[i + 1].y)
        used.add([a, b].sort().join('|'))
      }
      for (const [a, b] of l.walls || []) {
        expect(
          used.has([a, b].sort().join('|')),
          `level ${l.id} walls off an edge its solution uses`
        ).toBe(false)
      }
    }
  })

  it('keeps checkpoints sparse enough to leave a puzzle', () => {
    /**
     * The generator stops at the FEWEST checkpoints that force a unique
     * answer. If it ever started over-numbering, the puzzles would still be
     * "correct" and completely trivial — a colouring exercise where the path
     * is already drawn. So the ratio is asserted.
     */
    for (const l of levels) {
      const ratio = Object.keys(l.numbers).length / cellCount(l)
      expect(ratio, `level ${l.id} is ${Math.round(ratio * 100)}% checkpoints`).toBeLessThan(
        0.5
      )
    }
  })

  it('grows the board as the tiers climb', () => {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      const avgCells = (tier) => {
        const set = levels.filter((l) => l.difficulty === difficulty && l.tier === tier)
        return set.reduce((s, l) => s + cellCount(l), 0) / set.length
      }
      expect(avgCells(4), `${difficulty}: tier 4 is no bigger`).toBeGreaterThan(avgCells(0))
    }
  })

  it('opens with a tier-0 level', () => {
    expect(levels[0].tier).toBe(0)
    expect(levels.filter((l) => l.tier === 0)).toHaveLength(50)
  })
})
