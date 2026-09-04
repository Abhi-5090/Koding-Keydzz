import { describe, it, expect } from 'vitest'
import levels from '../../data/patchesLevels'
import { isSolved, validatePartition, rectArea, deriveType } from './engine'

/**
 * EVERY GENERATED PATCHES PUZZLE MUST BE FAIR AND SOLVABLE.
 *
 * The generator builds each puzzle backwards from a real partition, then solves
 * it to confirm the answer is unique. This file re-checks both properties
 * against the GAME'S OWN engine, which is the thing that will actually judge a
 * pupil's attempt — a generator that agrees only with itself proves nothing.
 *
 * The failure that matters: a puzzle with two valid cuttings. A child finds one
 * of them, the game rejects it, and there is no way for them to discover that
 * the puzzle was at fault rather than their reasoning.
 */

const TIER_PLAN = {
  0: { easy: 25, medium: 15, hard: 10 },
  1: { easy: 15, medium: 10, hard: 5 },
  2: { easy: 15, medium: 10, hard: 5 },
  3: { easy: 15, medium: 10, hard: 5 },
  4: { easy: 15, medium: 10, hard: 5 },
}

/** Independent solution counter — enumerates rectangles per clue. */
function countSolutions(level, limit = 2) {
  const { size, clues } = level
  const clueList = Object.entries(clues).map(([k, v]) => {
    const [x, y] = k.split(',').map(Number)
    return { x, y, n: v.n, type: v.type }
  })

  const placementsFor = (clue) => {
    const out = []
    for (let w = 1; w <= size; w += 1) {
      if (clue.n % w !== 0) continue
      const h = clue.n / w
      if (h > size) continue
      if (clue.type === 'h' && h !== 1) continue
      if (clue.type === 'v' && w !== 1) continue
      /**
       * 'plus' means ANY factor pair — including strips.
       *
       * This first excluded 1xn and nx1 from 'plus', which made the counter
       * blind to a real ambiguity: a `6` marked 'plus' can be satisfied by
       * 2x3, 3x2, 1x6 OR 6x1, so a puzzle can have several valid cuttings that
       * a stricter counter reports as unique. The engine's own rule is the
       * authority here, and it allows all of them.
       */
      // (no shape restriction for 'plus')

      for (let x = Math.max(0, clue.x - w + 1); x <= clue.x; x += 1) {
        for (let y = Math.max(0, clue.y - h + 1); y <= clue.y; y += 1) {
          if (x + w > size || y + h > size) continue
          const holdsAnother = clueList.some(
            (o) => o !== clue && o.x >= x && o.x < x + w && o.y >= y && o.y < y + h
          )
          if (holdsAnother) continue
          out.push({ x, y, w, h })
        }
      }
    }
    return out
  }

  const ordered = clueList
    .map((clue) => ({ clue, options: placementsFor(clue) }))
    .sort((a, b) => a.options.length - b.options.length)

  if (ordered.some((c) => c.options.length === 0)) return 0

  const grid = Array.from({ length: size }, () => Array(size).fill(false))
  let found = 0

  const place = (idx) => {
    if (found >= limit) return
    if (idx === ordered.length) {
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) if (!grid[y][x]) return
      }
      found += 1
      return
    }
    for (const r of ordered[idx].options) {
      let clash = false
      for (let j = r.y; j < r.y + r.h && !clash; j += 1) {
        for (let i = r.x; i < r.x + r.w; i += 1) {
          if (grid[j][i]) {
            clash = true
            break
          }
        }
      }
      if (clash) continue
      for (let j = r.y; j < r.y + r.h; j += 1) {
        for (let i = r.x; i < r.x + r.w; i += 1) grid[j][i] = true
      }
      place(idx + 1)
      for (let j = r.y; j < r.y + r.h; j += 1) {
        for (let i = r.x; i < r.x + r.w; i += 1) grid[j][i] = false
      }
      if (found >= limit) return
    }
  }

  place(0)
  return found
}

describe('generated patches levels', () => {
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
    // Fingerprinted on the clues, which is all a pupil is given to work from.
    const seen = new Map()
    for (const l of levels) {
      const fp = `${l.size}|${Object.entries(l.clues)
        .map(([k, v]) => `${k}:${v.n}${v.type}`)
        .sort()
        .join(',')}`
      const clash = seen.get(fp)
      expect(clash, `level ${l.id} duplicates level ${clash}`).toBeUndefined()
      seen.set(fp, l.id)
    }
  })

  it('is accepted by the GAME’S OWN solver check', () => {
    /**
     * The engine is what will judge a pupil's attempt, so its verdict on the
     * stored solution is the one that counts. A generator that only agrees
     * with itself proves nothing.
     */
    for (const l of levels) {
      expect(isSolved(l, l.solution), `engine rejects level ${l.id}`).toBe(true)
      expect(validatePartition(l, l.solution).ok, `bad partition on level ${l.id}`).toBe(
        true
      )
    }
  })

  it('covers the whole grid exactly once', () => {
    for (const l of levels) {
      const covered = Array.from({ length: l.size }, () => Array(l.size).fill(0))
      for (const r of l.solution) {
        for (let j = r.y; j < r.y + r.h; j += 1) {
          for (let i = r.x; i < r.x + r.w; i += 1) covered[j][i] += 1
        }
      }
      for (let y = 0; y < l.size; y += 1) {
        for (let x = 0; x < l.size; x += 1) {
          expect(covered[y][x], `level ${l.id} cell ${x},${y} covered ${covered[y][x]}x`).toBe(
            1
          )
        }
      }
    }
  })

  it('gives every rectangle exactly one clue, matching its area and shape', () => {
    for (const l of levels) {
      expect(Object.keys(l.clues).length, `level ${l.id} clue count`).toBe(
        l.solution.length
      )
      for (const r of l.solution) {
        const inside = Object.entries(l.clues).filter(([k]) => {
          const [x, y] = k.split(',').map(Number)
          return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
        })
        expect(inside.length, `level ${l.id} rect has ${inside.length} clues`).toBe(1)
        const [, clue] = inside[0]
        expect(clue.n, `level ${l.id} clue area mismatch`).toBe(rectArea(r))
        expect(clue.type, `level ${l.id} clue shape mismatch`).toBe(deriveType(r))
      }
    }
  })

  it('has EXACTLY ONE solution for every level', () => {
    // The fairness property, re-proved independently of the generator.
    const bad = []
    for (const l of levels) {
      const n = countSolutions(l, 2)
      if (n !== 1) bad.push(`level ${l.id} (${l.difficulty} t${l.tier}): ${n} solutions`)
    }
    expect(bad, `ambiguous puzzles:\n${bad.join('\n')}`).toEqual([])
  }, 120_000)

  it('needs more than one patch, so there is something to work out', () => {
    for (const l of levels) {
      expect(l.solution.length, `level ${l.id} is a single rectangle`).toBeGreaterThan(1)
    }
  })

  it('gets bigger as the tiers climb', () => {
    // A later tier that were merely a reshuffle would add nothing.
    for (const difficulty of ['easy', 'medium', 'hard']) {
      const avgSize = (tier) => {
        const set = levels.filter((l) => l.difficulty === difficulty && l.tier === tier)
        return set.reduce((s, l) => s + l.size, 0) / set.length
      }
      expect(avgSize(4), `${difficulty}: tier 4 is no bigger than tier 0`).toBeGreaterThan(
        avgSize(0)
      )
    }
  })

  it('does not hand out the answer in reading order', () => {
    /**
     * The solution rectangles are shuffled on purpose. Emitted in the
     * generator's own top-left-first order they would read as a step-by-step
     * answer key to anyone who opened the data file.
     */
    const inOrder = levels.filter((l) => {
      const sorted = [...l.solution].sort((a, b) => a.y - b.y || a.x - b.x)
      return sorted.every((r, i) => r === l.solution[i])
    })
    // A few short solutions will coincidentally be in order; most must not be.
    expect(inOrder.length).toBeLessThan(levels.length / 2)
  })

  it('opens with a tier-0 level', () => {
    expect(levels[0].tier).toBe(0)
    expect(levels.filter((l) => l.tier === 0)).toHaveLength(50)
  })
})
