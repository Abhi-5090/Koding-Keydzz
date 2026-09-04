import { describe, it, expect } from 'vitest';
import { publicDisplayName, isSameUser, escapeRegex } from '../src/utils/privacy.js';
import {
  MAX_SESSIONS,
  IDLE_TIMEOUT_MS,
  isSessionActive,
  pruneSessions,
  addSession,
  rotateSession,
} from '../src/utils/sessions.js';
import { pct, summarizeAttempts, needsAttention } from '../src/services/reportService.js';
import {
  isKnownGame,
  isKnownLevel,
  difficultyFor,
  validateCompletion,
  gameKeys,
  levelCount,
  MIN_LEVEL_TIME_MS,
} from '../src/config/gameCatalog.js';

describe('publicDisplayName — limits what a leaderboard reveals about a child', () => {
  it('reduces a surname to an initial', () => {
    expect(publicDisplayName('Bart Simpson')).toBe('Bart S.');
    expect(publicDisplayName('Bart J Simpson')).toBe('Bart S.');
  });

  it('leaves a single name alone', () => {
    expect(publicDisplayName('Bart')).toBe('Bart');
  });

  it('never returns an empty string', () => {
    expect(publicDisplayName('')).toBe('Student');
    expect(publicDisplayName('   ')).toBe('Student');
    expect(publicDisplayName(null)).toBe('Student');
    expect(publicDisplayName(undefined)).toBe('Student');
  });

  it('collapses extra whitespace', () => {
    expect(publicDisplayName('  Ada   Lovelace  ')).toBe('Ada L.');
  });
});

describe('isSameUser', () => {
  it('compares ObjectId-ish values as strings', () => {
    expect(isSameUser('abc', 'abc')).toBe(true);
    expect(isSameUser({ toString: () => 'abc' }, 'abc')).toBe(true);
    expect(isSameUser('abc', 'def')).toBe(false);
  });

  it('is false for nullish input rather than matching', () => {
    expect(isSameUser(null, null)).toBe(false);
    expect(isSameUser(undefined, 'abc')).toBe(false);
  });
});

describe('escapeRegex — a teacher typing "(" must not 500 the search', () => {
  it.each(['(', '[', '*', '+', '?', '{99}', '(a+)+$', 'O\'Brien (Jr)', '.*.*b'])(
    'produces a valid regular expression for %s',
    (input) => {
      expect(() => new RegExp(escapeRegex(input))).not.toThrow();
    }
  );

  it('still matches the literal text', () => {
    const re = new RegExp(escapeRegex('O\'Brien (Jr)'), 'i');
    expect(re.test("o'brien (jr)")).toBe(true);
  });

  it('does not treat metacharacters as wildcards', () => {
    const re = new RegExp(escapeRegex('a.c'));
    expect(re.test('a.c')).toBe(true);
    expect(re.test('abc')).toBe(false);
  });

  it('caps the pattern length', () => {
    expect(escapeRegex('x'.repeat(500)).length).toBeLessThanOrEqual(200);
  });
});

describe('session policy', () => {
  const now = Date.UTC(2026, 0, 15);
  const session = (mins) => ({
    hash: `h${mins}`,
    createdAt: new Date(now - mins * 60_000),
    lastUsedAt: new Date(now - mins * 60_000),
  });

  it('treats a recently used session as active', () => {
    expect(isSessionActive(session(5), now)).toBe(true);
  });

  it('expires a session idle past the timeout', () => {
    const stale = { hash: 'x', lastUsedAt: new Date(now - IDLE_TIMEOUT_MS - 1000) };
    expect(isSessionActive(stale, now)).toBe(false);
  });

  it('rejects a malformed session row', () => {
    expect(isSessionActive(null, now)).toBe(false);
    expect(isSessionActive({}, now)).toBe(false);
    expect(isSessionActive({ hash: 'x' }, now)).toBe(false);
  });

  it('prunes only the stale rows', () => {
    const rows = [session(1), { hash: 'old', lastUsedAt: new Date(now - IDLE_TIMEOUT_MS - 1) }];
    expect(pruneSessions(rows, now)).toHaveLength(1);
  });

  it('keeps multiple devices signed in', () => {
    let rows = [];
    rows = addSession(rows, { hash: 'a' }, { now });
    rows = addSession(rows, { hash: 'b' }, { now });
    expect(rows.map((r) => r.hash)).toEqual(['a', 'b']);
  });

  it('evicts the least-recently-used device past the cap', () => {
    let rows = [];
    for (let i = 0; i < MAX_SESSIONS; i += 1) {
      rows = addSession(rows, { hash: `h${i}` }, { now: now + i * 1000 });
    }
    expect(rows).toHaveLength(MAX_SESSIONS);

    rows = addSession(rows, { hash: 'newest' }, { now: now + 99_000 });
    expect(rows).toHaveLength(MAX_SESSIONS);
    // The oldest is gone, the newest is present.
    expect(rows.map((r) => r.hash)).not.toContain('h0');
    expect(rows.map((r) => r.hash)).toContain('newest');
  });

  it('replaces exactly one row on rotation, preserving the others', () => {
    let rows = [];
    rows = addSession(rows, { hash: 'a' }, { now });
    rows = addSession(rows, { hash: 'b' }, { now });

    const rotated = rotateSession(rows, 0, { hash: 'a2' }, { now });
    expect(rotated.map((r) => r.hash).sort()).toEqual(['a2', 'b']);
    // The consumed hash is gone — this is what makes replay fail.
    expect(rotated.map((r) => r.hash)).not.toContain('a');
  });

  it('is a no-op for an out-of-range rotation index', () => {
    const rows = addSession([], { hash: 'a' }, { now });
    expect(rotateSession(rows, 9, { hash: 'z' }, { now })).toHaveLength(1);
    expect(rotateSession(rows, -1, { hash: 'z' }, { now })[0].hash).toBe('a');
  });
});

describe('game catalogue — the reward allowlist', () => {
  it('knows the real games', () => {
    expect(isKnownGame('maze-coding')).toBe(true);
    expect(isKnownGame('sudoku')).toBe(true);
    expect(isKnownGame('totally-fake-game')).toBe(false);
  });

  it('covers every game with at least one level', () => {
    expect(gameKeys().length).toBeGreaterThanOrEqual(13);
    expect(levelCount()).toBeGreaterThan(200);
  });

  it('knows the real levels', () => {
    expect(isKnownLevel('maze-coding', '1')).toBe(true);
    expect(isKnownLevel('maze-coding', 1)).toBe(true);
    expect(isKnownLevel('maze-coding', '9999')).toBe(false);
    expect(isKnownLevel('nope', '1')).toBe(false);
  });

  it('resolves difficulty from the catalogue, not the caller', () => {
    expect(difficultyFor('maze-coding', '1')).toBe('easy');
    expect(difficultyFor('nope', '1')).toBeNull();
  });

  it('overrides a client-claimed difficulty', () => {
    const out = validateCompletion({
      gameKey: 'maze-coding',
      levelId: '1',
      difficulty: 'hard', // the lie
      stars: 3,
    });
    expect(out.difficulty).toBe('easy');
  });

  it('rejects fabricated games and levels', () => {
    expect(() =>
      validateCompletion({ gameKey: 'invented', levelId: '1', stars: 3 })
    ).toThrow(/unknown game/i);
    expect(() =>
      validateCompletion({ gameKey: 'maze-coding', levelId: '99999', stars: 3 })
    ).toThrow(/unknown level/i);
  });

  it('rejects implausible leaderboard metrics', () => {
    expect(() =>
      validateCompletion({ gameKey: 'maze-coding', levelId: '1', stars: 3, timeMs: 1 })
    ).toThrow(/implausible completion time/i);
    expect(() =>
      validateCompletion({ gameKey: 'maze-coding', levelId: '1', stars: 3, moves: 0 })
    ).toThrow(/implausible move count/i);
  });

  it('accepts a realistic run, and GRADES the stars rather than taking them', () => {
    const out = validateCompletion({
      gameKey: 'maze-coding',
      levelId: '1',
      stars: 3, // claimed, and discarded
      moves: 12,
      timeMs: MIN_LEVEL_TIME_MS + 5000,
      performance: { optimalPath: true, cleanCode: true },
    });
    expect(out).toMatchObject({ stars: 3, moves: 12, starsGraded: true });

    // The same request WITHOUT the reported run is capped below the perfect
    // bonus — the claim on its own buys nothing. See src/config/starPolicy.js.
    const unreported = validateCompletion({
      gameKey: 'maze-coding',
      levelId: '1',
      stars: 3,
      moves: 12,
      timeMs: MIN_LEVEL_TIME_MS + 5000,
    });
    expect(unreported.stars).toBeLessThan(3);
    expect(unreported.starsGraded).toBe(false);
  });
});

describe('report helpers', () => {
  it('computes percentages without dividing by zero', () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(0, 0)).toBe(0);
    expect(pct(5, 0)).toBe(0);
  });

  it('summarizes on the BEST attempt per quiz, so retries help rather than hurt', () => {
    const attempts = [
      { quiz: 'q1', score: 10, total: 50, passed: false },
      { quiz: 'q1', score: 50, total: 50, passed: true },
      { quiz: 'q2', score: 40, total: 50, passed: true },
    ];
    const s = summarizeAttempts(attempts);
    expect(s.quizzesAttempted).toBe(2);
    expect(s.quizzesPassed).toBe(2);
    expect(s.averageScore).toBe(90); // (50+40) / (50+50)
    expect(s.totalAttempts).toBe(3);
    expect(s.retryRate).toBe(1.5);
  });

  it('returns a zeroed summary for no attempts', () => {
    expect(summarizeAttempts([])).toMatchObject({
      quizzesAttempted: 0,
      quizzesPassed: 0,
      averageScore: 0,
    });
  });

  it('flags a student who has not started', () => {
    const reasons = needsAttention(
      { quizzesAttempted: 0, quizzesPassed: 0, averageScore: 0, retryRate: 0 },
      { totalQuizzes: 10 }
    );
    expect(reasons).toContain('Not started');
  });

  it('flags a low scorer and heavy retrier', () => {
    const reasons = needsAttention(
      { quizzesAttempted: 8, quizzesPassed: 0, averageScore: 30, retryRate: 4 },
      { totalQuizzes: 10 }
    );
    expect(reasons).toContain('Low average score');
    expect(reasons).toContain('No quiz passed yet');
    expect(reasons).toContain('Many retries');
  });

  it('leaves a healthy student unflagged', () => {
    const reasons = needsAttention(
      { quizzesAttempted: 9, quizzesPassed: 8, averageScore: 85, retryRate: 1.1 },
      { totalQuizzes: 10 }
    );
    expect(reasons).toEqual([]);
  });
});
