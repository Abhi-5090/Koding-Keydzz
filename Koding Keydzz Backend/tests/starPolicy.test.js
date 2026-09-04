import { describe, it, expect } from 'vitest';
import {
  validateCompletion,
  factsFor,
  gameKeys,
  GAME_CATALOG,
} from '../src/config/gameCatalog.js';
import {
  gradeStars,
  GAME_SCORING,
  STARS_WITHOUT_SIGNALS,
  hanoiMinMoves,
} from '../src/config/starPolicy.js';

/**
 * STARS ARE GRADED BY THE SERVER.
 *
 * `POST /games/complete` used to take `stars` from the request body, and three
 * stars is what pays PERFECT_BONUS — so the browser set part of its own payout,
 * and hint counts were unchecked against what the level actually grants.
 *
 * These cases pin the behaviour that replaced it: the body's `stars` is
 * discarded, each game's own published rule is applied to the reported
 * counters, and counters a level makes impossible are refused.
 */

describe('the request cannot name its own star count', () => {
  it('ignores a claimed 3 stars on a run that reports mistakes', () => {
    const out = validateCompletion({
      gameKey: 'sudoku',
      levelId: '1',
      stars: 3, // the lie
      timeMs: 60_000,
      performance: { hintsUsed: 0, mistakes: 5 },
    });
    expect(out.stars).toBe(2); // mistakes <= 3 fails, hints <= 1 passes
    expect(out.starsGraded).toBe(true);
  });

  it('ignores a claimed 3 stars on a run that used hints AND slipped', () => {
    const out = validateCompletion({
      gameKey: 'sudoku',
      levelId: '1',
      stars: 3,
      timeMs: 60_000,
      performance: { hintsUsed: 2, mistakes: 9 },
    });
    expect(out.stars).toBe(1);
  });

  it('grants 3 stars to a genuinely clean run', () => {
    const out = validateCompletion({
      gameKey: 'sudoku',
      levelId: '1',
      stars: 0, // even a client that under-claims gets the truth
      timeMs: 60_000,
      performance: { hintsUsed: 0, mistakes: 0 },
    });
    expect(out.stars).toBe(3);
  });

  it('caps a run that reports NOTHING below the perfect bonus', () => {
    // An old client, or a forged body that just omits the counters, must still
    // be able to finish a level — but not reach the bonus by saying nothing.
    const out = validateCompletion({
      gameKey: 'sudoku',
      levelId: '1',
      stars: 3,
      timeMs: 60_000,
    });
    expect(out.stars).toBe(STARS_WITHOUT_SIGNALS);
    expect(out.stars).toBeLessThan(3);
    expect(out.starsGraded).toBe(false);
  });
});

describe("a level's own hint allowance is the ceiling", () => {
  it('rejects more hints than the level grants', () => {
    // Sudoku level 1 allows 2.
    expect(factsFor('sudoku', '1').maxHints).toBe(2);
    expect(() =>
      validateCompletion({
        gameKey: 'sudoku',
        levelId: '1',
        timeMs: 60_000,
        performance: { hintsUsed: 99, mistakes: 0 },
      })
    ).toThrow(/at most 2/);
  });

  it('accepts exactly the allowance, and 2 hints costs the perfect star', () => {
    const out = validateCompletion({
      gameKey: 'sudoku',
      levelId: '1',
      timeMs: 60_000,
      performance: { hintsUsed: 2, mistakes: 0 },
    });
    // The board's rule is "3 stars needs no hints AND no mistakes; 2 stars
    // needs at most 1 hint OR at most 3 mistakes" — a clean-but-hinted solve
    // keeps 2 on the mistakes clause. Not 3: the perfect bonus is gone.
    expect(out.stars).toBe(2);
  });

  it('rejects hints on a game that has no hint button at all', () => {
    // The question games have no hint mechanic, so a reported hint describes
    // something that cannot have happened. Accepting the number and quietly
    // ignoring it is the kind of tolerated nonsense that makes the check next
    // to it hard to trust.
    expect(factsFor('bug-fix', '1')).toBeUndefined();
    expect(() =>
      validateCompletion({
        gameKey: 'bug-fix',
        levelId: '1',
        timeMs: 40_000,
        performance: { hintsUsed: 1, mistakes: 0 },
      })
    ).toThrow(/offers none/);

    // ...while a clean run on the same level is still worth three stars.
    const clean = validateCompletion({
      gameKey: 'bug-fix',
      levelId: '1',
      timeMs: 40_000,
      performance: { hintsUsed: 0, mistakes: 0 },
    });
    expect(clean.stars).toBe(3);
  });

  it('rejects a hint on a level whose allowance is zero', () => {
    /**
     * Hint allowance is now driven by a level's TIER, not its position in the
     * list: tier 0 is generous, tiers 3 and 4 are solo. (It used to taper by
     * level id, which is why this test named sudoku 14 — that is now a
     * tier-0 level with two hints.)
     *
     * So the level is FOUND rather than hardcoded: any assertion that names a
     * specific id will break again the next time the levels are regenerated.
     */
    const zeroHint = Object.keys(GAME_CATALOG.sudoku.levels).find(
      (id) => factsFor('sudoku', id)?.maxHints === 0
    );
    expect(zeroHint, 'no sudoku level offers zero hints').toBeTruthy();

    expect(() =>
      validateCompletion({
        gameKey: 'sudoku',
        levelId: zeroHint,
        timeMs: 90_000,
        performance: { hintsUsed: 1, mistakes: 0 },
      })
    ).toThrow(/offers none/);
  });

  it('every level of a HINTED game declares its allowance', () => {
    // The play screens fall back to `level.maxHints ?? 2`, so a new level
    // added without one would let a child spend two hints that the server then
    // rejects with a 400 — the level would refuse to complete, for the players
    // who used the feature as offered. Fail here instead.
    const HINTED = ['sudoku', 'zip', 'patches', 'n-queens', 'towers-of-hanoi'];
    for (const gameKey of HINTED) {
      for (const levelId of Object.keys(GAME_CATALOG[gameKey].levels)) {
        const maxHints = factsFor(gameKey, levelId)?.maxHints;
        expect(
          Number.isFinite(Number(maxHints)),
          `${gameKey} level ${levelId} has no maxHints — re-run npm run generate:catalog, ` +
            'or add maxHints to the level data'
        ).toBe(true);
      }
    }
  });

  it('rejects a negative or absurd counter outright', () => {
    for (const bad of [-1, 1e9, Number.NaN, 'lots']) {
      expect(() =>
        gradeStars({
          gameKey: 'sudoku',
          performance: { hintsUsed: bad, mistakes: 0 },
          moves: null,
          facts: undefined,
        })
      ).toThrow(/Implausible/);
    }
  });
});

describe('Towers of Hanoi is graded EXACTLY — the server knows the optimum', () => {
  it('2^n - 1 is the three-star bar', () => {
    expect(hanoiMinMoves(3)).toBe(7);
    expect(hanoiMinMoves(7)).toBe(127);
  });

  it('awards 3 stars only for an optimal, hint-free solve', () => {
    const disks = factsFor('towers-of-hanoi', '1').disks;
    expect(disks).toBe(3);
    const out = validateCompletion({
      gameKey: 'towers-of-hanoi',
      levelId: '1',
      timeMs: 60_000,
      moves: hanoiMinMoves(disks), // 7
      performance: { hintsUsed: 0, mistakes: 0 },
    });
    expect(out.stars).toBe(3);
  });

  it('refuses 3 stars for a solve one move over the optimum', () => {
    const out = validateCompletion({
      gameKey: 'towers-of-hanoi',
      levelId: '1',
      timeMs: 60_000,
      moves: hanoiMinMoves(3) + 1,
      performance: { hintsUsed: 0, mistakes: 0 },
    });
    expect(out.stars).toBe(2);
  });

  it('a claimed 3 stars on a sloppy solve does not survive', () => {
    const out = validateCompletion({
      gameKey: 'towers-of-hanoi',
      levelId: '1',
      stars: 3,
      timeMs: 60_000,
      moves: 500, // far over optimum
      performance: { hintsUsed: 2, mistakes: 0 },
    });
    expect(out.stars).toBe(1);
  });
});

describe('Tic-Tac-Toe: the server decides whether a draw was perfect play', () => {
  it('a win is always 3 stars', () => {
    const out = validateCompletion({
      gameKey: 'tic-tac-toe',
      levelId: '1',
      timeMs: 30_000,
      moves: 5,
      performance: { outcome: 'win' },
    });
    expect(out.stars).toBe(3);
  });

  it('a draw against the UNBEATABLE bot is 3 stars', () => {
    // Levels 19-20 are skill 1.0 — a draw is the best result available.
    const perfect = Object.entries(
      JSON.parse(JSON.stringify(factsFor('tic-tac-toe', '20')))
    );
    expect(Object.fromEntries(perfect).skill).toBe(1);

    const out = validateCompletion({
      gameKey: 'tic-tac-toe',
      levelId: '20',
      timeMs: 30_000,
      moves: 5,
      performance: { outcome: 'draw' },
    });
    expect(out.stars).toBe(3);
  });

  it('a draw against a BEATABLE bot is only 2 stars', () => {
    expect(factsFor('tic-tac-toe', '1').skill).toBeLessThan(1);
    const out = validateCompletion({
      gameKey: 'tic-tac-toe',
      levelId: '1',
      timeMs: 30_000,
      moves: 5,
      performance: { outcome: 'draw' },
    });
    expect(out.stars).toBe(2);
  });

  it('a loss earns no stars, whatever the body claims', () => {
    const out = validateCompletion({
      gameKey: 'tic-tac-toe',
      levelId: '1',
      stars: 3,
      timeMs: 30_000,
      moves: 5,
      performance: { outcome: 'loss' },
    });
    expect(out.stars).toBe(0);
  });

  it('rejects an invented outcome', () => {
    expect(() =>
      gradeStars({
        gameKey: 'tic-tac-toe',
        performance: { outcome: 'flawless-victory' },
        moves: 5,
        facts: { skill: 1 },
      })
    ).toThrow(/Unknown outcome/);
  });
});

describe('the programming games are bounded to a real 3', () => {
  it('finishing alone is 1 star', () => {
    const out = validateCompletion({
      gameKey: 'maze-coding',
      levelId: '1',
      timeMs: 20_000,
      moves: 9,
      performance: { optimalPath: false, cleanCode: false },
    });
    expect(out.stars).toBe(1);
  });

  it('shortest path plus a loop is 3 stars', () => {
    const out = validateCompletion({
      gameKey: 'maze-coding',
      levelId: '1',
      timeMs: 20_000,
      moves: 2,
      performance: { optimalPath: true, cleanCode: true },
    });
    expect(out.stars).toBe(3);
  });

  it('cannot exceed 3 however the bits are forged', () => {
    const out = validateCompletion({
      gameKey: 'maze-coding',
      levelId: '1',
      stars: 3,
      timeMs: 20_000,
      moves: 2,
      performance: {
        optimalPath: true,
        cleanCode: true,
        hintsUsed: 0,
        mistakes: 0,
      },
    });
    expect(out.stars).toBeLessThanOrEqual(3);
  });
});

describe('the question games grade on first-try answers', () => {
  it.each([
    [0, 3],
    [1, 2],
    [2, 2],
    [3, 1],
    [50, 1],
  ])('%i wrong answers -> %i stars', (mistakes, expected) => {
    const out = validateCompletion({
      gameKey: 'treasure-hunt',
      levelId: '1',
      timeMs: 40_000,
      performance: { hintsUsed: 0, mistakes },
    });
    expect(out.stars).toBe(expected);
  });
});

describe('every catalogue game has a scoring model', () => {
  // Without this, adding a game silently caps its players at two stars — they
  // could never earn a perfect bonus and nobody would know why.
  it.each(gameKeys())('%s is graded', (gameKey) => {
    expect(GAME_SCORING[gameKey], `no scoring model for "${gameKey}"`).toBeTruthy();
  });

  it('has no scoring models for games that do not exist', () => {
    const known = new Set(gameKeys());
    for (const key of Object.keys(GAME_SCORING)) {
      expect(known.has(key), `scoring model for unknown game "${key}"`).toBe(true);
    }
  });

  it('fails closed for an unknown game rather than crediting a perfect run', () => {
    const { stars, graded } = gradeStars({
      gameKey: 'not-a-game',
      performance: { hintsUsed: 0, mistakes: 0 },
      moves: null,
      facts: undefined,
    });
    expect(stars).toBeLessThan(3);
    expect(graded).toBe(false);
  });
});
