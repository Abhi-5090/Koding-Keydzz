import { describe, it, expect } from 'vitest';
import {
  isBetterScore,
  comparePerLevel,
  comparePerGameAggregate,
  aggregatePerGame,
} from '../src/utils/leaderboard.js';

describe('isBetterScore (best-kept per-level result)', () => {
  it('prefers fewer moves', () => {
    expect(isBetterScore({ moves: 8, timeMs: 9000 }, { moves: 10, timeMs: 1000 })).toBe(true);
    expect(isBetterScore({ moves: 12, timeMs: 100 }, { moves: 10, timeMs: 9000 })).toBe(false);
  });

  it('tie-breaks equal moves by lower time', () => {
    expect(isBetterScore({ moves: 10, timeMs: 3000 }, { moves: 10, timeMs: 5000 })).toBe(true);
    expect(isBetterScore({ moves: 10, timeMs: 5000 }, { moves: 10, timeMs: 3000 })).toBe(false);
  });

  it('returns false when moves and time are exactly equal', () => {
    expect(isBetterScore({ moves: 10, timeMs: 3000 }, { moves: 10, timeMs: 3000 })).toBe(false);
  });

  it('a run with moves beats a stored best that has none', () => {
    expect(isBetterScore({ moves: 20, timeMs: null }, { moves: null, timeMs: null })).toBe(true);
    expect(isBetterScore({ moves: 20, timeMs: 500 }, { moves: null, timeMs: 999 })).toBe(true);
  });

  it('a run without moves is never better', () => {
    expect(isBetterScore({ moves: null, timeMs: 10 }, { moves: 50, timeMs: 9000 })).toBe(false);
    expect(isBetterScore({ moves: null, timeMs: null }, { moves: null, timeMs: null })).toBe(false);
  });

  it('treats missing time as worst on a moves tie', () => {
    expect(isBetterScore({ moves: 10, timeMs: 500 }, { moves: 10, timeMs: null })).toBe(true);
    expect(isBetterScore({ moves: 10, timeMs: null }, { moves: 10, timeMs: 500 })).toBe(false);
  });

  it('tolerates null score arguments', () => {
    expect(isBetterScore({ moves: 5, timeMs: 1 }, null)).toBe(true);
    expect(isBetterScore(null, { moves: 5, timeMs: 1 })).toBe(false);
  });
});

describe('comparePerLevel (moves asc, then timeMs asc)', () => {
  it('sorts by fewer moves first, then faster time', () => {
    const rows = [
      { user: 'a', moves: 10, timeMs: 1000 },
      { user: 'b', moves: 8, timeMs: 9000 },
      { user: 'c', moves: 10, timeMs: 500 },
      { user: 'd', moves: 8, timeMs: 3000 },
    ];
    const order = [...rows].sort(comparePerLevel).map((r) => r.user);
    expect(order).toEqual(['d', 'b', 'c', 'a']);
  });

  it('places rows without moves last', () => {
    const rows = [
      { user: 'noMoves', moves: null, timeMs: 5 },
      { user: 'has', moves: 3, timeMs: 9000 },
    ];
    const order = [...rows].sort(comparePerLevel).map((r) => r.user);
    expect(order).toEqual(['has', 'noMoves']);
  });
});

describe('comparePerGameAggregate (levels desc, stars desc, time asc)', () => {
  it('ranks more levels completed first', () => {
    const a = { levelsCompleted: 5, totalStars: 1, totalTimeMs: 9999 };
    const b = { levelsCompleted: 3, totalStars: 99, totalTimeMs: 1 };
    expect(comparePerGameAggregate(a, b)).toBeLessThan(0);
  });

  it('breaks level ties by more stars', () => {
    const a = { levelsCompleted: 3, totalStars: 9, totalTimeMs: 9999 };
    const b = { levelsCompleted: 3, totalStars: 6, totalTimeMs: 1 };
    expect(comparePerGameAggregate(a, b)).toBeLessThan(0);
  });

  it('breaks level+star ties by faster total time', () => {
    const a = { levelsCompleted: 3, totalStars: 6, totalTimeMs: 1000 };
    const b = { levelsCompleted: 3, totalStars: 6, totalTimeMs: 2000 };
    expect(comparePerGameAggregate(a, b)).toBeLessThan(0);
    expect(comparePerGameAggregate(b, a)).toBeGreaterThan(0);
  });
});

describe('aggregatePerGame (per-user reducer + ranking)', () => {
  const scores = [
    // user u1: 2 levels, 5 stars, 18 moves, 3000ms
    { user: 'u1', levelId: '1', moves: 10, timeMs: 2000, stars: 3, name: 'Ann', avatar: 'a1' },
    { user: 'u1', levelId: '2', moves: 8, timeMs: 1000, stars: 2, name: 'Ann', avatar: 'a1' },
    // user u2: 3 levels, 6 stars, 21 moves, 6000ms
    { user: 'u2', levelId: '1', moves: 7, timeMs: 1000, stars: 2, name: 'Bob', avatar: 'a2' },
    { user: 'u2', levelId: '2', moves: 6, timeMs: 2000, stars: 2, name: 'Bob', avatar: 'a2' },
    { user: 'u2', levelId: '3', moves: 8, timeMs: 3000, stars: 2, name: 'Bob', avatar: 'a2' },
    // user u3: 2 levels, 5 stars, moves partially null, 1000ms
    { user: 'u3', levelId: '1', moves: null, timeMs: null, stars: 3, name: 'Cy', avatar: 'a3' },
    { user: 'u3', levelId: '2', moves: 5, timeMs: 1000, stars: 2, name: 'Cy', avatar: 'a3' },
  ];

  it('computes correct per-user aggregates', () => {
    const ranked = aggregatePerGame(scores);
    const byId = Object.fromEntries(ranked.map((r) => [r.userId, r]));

    expect(byId.u1).toMatchObject({
      levelsCompleted: 2,
      totalStars: 5,
      totalMoves: 18,
      totalTimeMs: 3000,
      name: 'Ann',
      avatar: 'a1',
    });
    expect(byId.u2).toMatchObject({
      levelsCompleted: 3,
      totalStars: 6,
      totalMoves: 21,
      totalTimeMs: 6000,
    });
    // u3 has one null-move level: it counts toward levels/stars but not move/time sums.
    expect(byId.u3).toMatchObject({
      levelsCompleted: 2,
      totalStars: 5,
      totalMoves: 5,
      totalTimeMs: 1000,
    });
  });

  it('ranks by levelsCompleted desc, then stars desc, then time asc', () => {
    const ranked = aggregatePerGame(scores);
    // u2 (3 levels) first; u1 & u3 both 2 levels + 5 stars -> u3 faster total time wins.
    expect(ranked.map((r) => r.userId)).toEqual(['u2', 'u3', 'u1']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('counts distinct levels only (ignores duplicate level rows)', () => {
    const dup = [
      { user: 'x', levelId: '1', moves: 5, timeMs: 100, stars: 1 },
      { user: 'x', levelId: '1', moves: 3, timeMs: 50, stars: 2 },
    ];
    const ranked = aggregatePerGame(dup);
    expect(ranked[0].levelsCompleted).toBe(1);
  });

  it('returns an empty array for no scores', () => {
    expect(aggregatePerGame([])).toEqual([]);
  });
});
