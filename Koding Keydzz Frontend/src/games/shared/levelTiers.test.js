import { describe, it, expect } from 'vitest'
import {
  tierOf,
  unlockedLevels,
  lockedTierSummary,
  nextTierCount,
  isTiered,
} from './levelTiers'

/**
 * PROGRESSIVE LEVEL UNLOCKING.
 *
 * A tier opens when a pupil passes a course, so this logic decides how much of
 * a game a child can see. Two ways it can go wrong, in opposite directions:
 *
 *   • TOO LITTLE. Filter wrongly and a brand-new pupil is shown nothing —
 *     the game looks broken rather than locked, because the unlock chain opens
 *     index 0 of whatever list it is given, and an empty list has no index 0.
 *
 *   • TOO MUCH. Show a locked tier and the levels pay XP, coins and
 *     leaderboard places that were meant to be earned by finishing a course.
 *
 * The older games' levels carry no `tier` field at all, and must keep working
 * untouched — absence has to mean "always available", never "locked forever".
 */

const L = (id, tier) => ({ id, tier })

describe('tierOf', () => {
  it('treats a level with no tier as tier 0', () => {
    // The compatibility rule. Every hand-authored level in maze-coding,
    // robot-navigation and the rest has no tier; if absence meant "locked"
    // those games would go dark for every pupil.
    expect(tierOf({ id: 1 })).toBe(0)
    expect(tierOf({ id: 1, tier: undefined })).toBe(0)
    expect(tierOf(undefined)).toBe(0)
  })

  it('reads a real tier', () => {
    expect(tierOf({ id: 1, tier: 3 })).toBe(3)
    expect(tierOf({ id: 1, tier: 0 })).toBe(0)
  })
})

describe('unlockedLevels', () => {
  const levels = [L(1, 0), L(2, 0), L(3, 1), L(4, 1), L(5, 2), L(6, 4)]

  it('shows only the base tier to a pupil who has passed nothing', () => {
    expect(unlockedLevels(levels, 0).map((l) => l.id)).toEqual([1, 2])
  })

  it('adds a tier for each course passed', () => {
    expect(unlockedLevels(levels, 1).map((l) => l.id)).toEqual([1, 2, 3, 4])
    expect(unlockedLevels(levels, 2).map((l) => l.id)).toEqual([1, 2, 3, 4, 5])
  })

  it('shows everything once every course is passed', () => {
    expect(unlockedLevels(levels, 4)).toHaveLength(6)
  })

  it('never shows a locked tier', () => {
    // The levels pay real rewards, so this is the security-shaped half.
    for (const tier of [0, 1, 2, 3]) {
      const shown = unlockedLevels(levels, tier)
      expect(shown.every((l) => tierOf(l) <= tier), `tier ${tier} leaked a level`).toBe(true)
    }
  })

  it('PRESERVES ORDER, because the unlock chain depends on it', () => {
    /**
     * `useGameLevels` opens index 0 and unlocks level N+1 when N is beaten.
     * Re-sorting here would reshuffle that chain and could leave a pupil's
     * finished levels sitting behind a locked one.
     */
    const shown = unlockedLevels(levels, 2)
    expect(shown.map((l) => l.id)).toEqual([1, 2, 3, 4, 5])
    // Newly-unlocked levels land at the END — where a returning pupil finds
    // them after everything they have already beaten.
    expect(shown[shown.length - 1].tier).toBe(2)
  })

  it('leaves an untiered level set completely alone', () => {
    const plain = [{ id: 1 }, { id: 2 }, { id: 3 }]
    expect(unlockedLevels(plain, 0)).toHaveLength(3)
    expect(unlockedLevels(plain, 4)).toHaveLength(3)
  })

  it('never returns an empty list to a pupil at tier 0', () => {
    // The failure that would look like a broken game rather than a locked one.
    const shown = unlockedLevels(levels, 0)
    expect(shown.length).toBeGreaterThan(0)
  })

  it('survives being called with nothing', () => {
    expect(unlockedLevels()).toEqual([])
    expect(unlockedLevels(undefined, 3)).toEqual([])
  })
})

describe('lockedTierSummary', () => {
  const levels = [L(1, 0), L(2, 1), L(3, 1), L(4, 2), L(5, 4)]

  it('groups what is still to come by the tier that opens it', () => {
    expect(lockedTierSummary(levels, 0)).toEqual([
      { tier: 1, count: 2 },
      { tier: 2, count: 1 },
      { tier: 4, count: 1 },
    ])
  })

  it('shrinks as tiers are unlocked', () => {
    expect(lockedTierSummary(levels, 1)).toEqual([
      { tier: 2, count: 1 },
      { tier: 4, count: 1 },
    ])
    expect(lockedTierSummary(levels, 4)).toEqual([])
  })

  it('returns tiers in ascending order', () => {
    // The UI shows the next one, so the first entry must be the nearest.
    const summary = lockedTierSummary([L(1, 3), L(2, 1), L(3, 2)], 0)
    expect(summary.map((s) => s.tier)).toEqual([1, 2, 3])
  })
})

describe('nextTierCount', () => {
  it('counts what the very next course completion unlocks', () => {
    const levels = [L(1, 0), L(2, 1), L(3, 1), L(4, 2)]
    expect(nextTierCount(levels, 0)).toBe(2)
    expect(nextTierCount(levels, 1)).toBe(1)
  })

  it('is zero when everything is already unlocked', () => {
    expect(nextTierCount([L(1, 0), L(2, 1)], 1)).toBe(0)
  })

  it('is zero when the next tier has no levels, rather than skipping ahead', () => {
    /**
     * A capped game (Towers of Hanoi, n-queens) runs out of honest tiers
     * before the ladder runs out of courses. Promising "3 more levels when you
     * pass the next course" and then delivering nothing would be worse than
     * saying nothing at all.
     */
    const capped = [L(1, 0), L(2, 1), L(3, 4)]
    expect(nextTierCount(capped, 1)).toBe(0)
  })
})

describe('isTiered', () => {
  it('is true for a game with later tiers', () => {
    expect(isTiered([L(1, 0), L(2, 1)])).toBe(true)
  })

  it('is false for the older, untiered games', () => {
    // Those games must not display "more levels coming", because none are.
    expect(isTiered([{ id: 1 }, { id: 2 }])).toBe(false)
    expect(isTiered([L(1, 0), L(2, 0)])).toBe(false)
    expect(isTiered([])).toBe(false)
  })
})
