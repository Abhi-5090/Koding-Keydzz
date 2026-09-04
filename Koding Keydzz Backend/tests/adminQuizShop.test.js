import { describe, it, expect } from 'vitest';
import {
  normalizeQuizQuestion,
  normalizeQuizQuestions,
  aggregateGameProgress,
} from '../src/services/adminService.js';

describe('normalizeQuizQuestion', () => {
  it('maps `answer` onto correctAnswer and fills defaults', () => {
    const q = normalizeQuizQuestion({ type: 'mcq', prompt: 'Pick one', options: ['a', 'b'], answer: 1 });
    expect(q).toEqual({
      type: 'mcq',
      prompt: 'Pick one',
      options: ['a', 'b'],
      correctAnswer: 1,
      explanation: '',
      points: 10,
    });
  });

  it('accepts `correctAnswer` as an alias for answer', () => {
    const q = normalizeQuizQuestion({ prompt: 'x', correctAnswer: 'cat' });
    expect(q.correctAnswer).toBe('cat');
  });

  it('defaults unknown/missing type to mcq and coerces options to strings', () => {
    const q = normalizeQuizQuestion({ prompt: 'x', type: 'nope', options: [1, 2] });
    expect(q.type).toBe('mcq');
    expect(q.options).toEqual(['1', '2']);
  });

  it('keeps a valid custom type and positive points', () => {
    const q = normalizeQuizQuestion({ prompt: 'x', type: 'fillblank', points: 25 });
    expect(q.type).toBe('fillblank');
    expect(q.points).toBe(25);
  });

  it('falls back to 10 points for non-positive / invalid points', () => {
    expect(normalizeQuizQuestion({ prompt: 'x', points: 0 }).points).toBe(10);
    expect(normalizeQuizQuestion({ prompt: 'x', points: 'abc' }).points).toBe(10);
  });

  it('preserves array / map answers (dragdrop, match)', () => {
    expect(normalizeQuizQuestion({ prompt: 'x', type: 'dragdrop', answer: ['1', '2'] }).correctAnswer)
      .toEqual(['1', '2']);
    expect(normalizeQuizQuestion({ prompt: 'x', type: 'match', answer: { a: 'b' } }).correctAnswer)
      .toEqual({ a: 'b' });
  });
});

describe('normalizeQuizQuestions', () => {
  it('normalizes a list', () => {
    const out = normalizeQuizQuestions([{ prompt: 'a', answer: 1 }, { prompt: 'b', answer: 'x' }]);
    expect(out).toHaveLength(2);
    expect(out[0].correctAnswer).toBe(1);
  });

  it('returns [] for non-array / missing input', () => {
    expect(normalizeQuizQuestions()).toEqual([]);
    expect(normalizeQuizQuestions(null)).toEqual([]);
    expect(normalizeQuizQuestions('nope')).toEqual([]);
  });
});

describe('aggregateGameProgress', () => {
  it('groups per game, counting levels and summing stars', () => {
    const rows = [
      { gameKey: 'maze', levelId: '1', stars: 3 },
      { gameKey: 'maze', levelId: '2', stars: 2 },
      { gameKey: 'snake', levelId: '1', stars: 1 },
    ];
    expect(aggregateGameProgress(rows)).toEqual([
      { gameKey: 'maze', levelsCompleted: 2, totalStars: 5 },
      { gameKey: 'snake', levelsCompleted: 1, totalStars: 1 },
    ]);
  });

  it('sorts by gameKey and tolerates missing stars', () => {
    const rows = [
      { gameKey: 'zebra', levelId: '1' },
      { gameKey: 'apple', levelId: '1', stars: 2 },
    ];
    const out = aggregateGameProgress(rows);
    expect(out.map((r) => r.gameKey)).toEqual(['apple', 'zebra']);
    expect(out[1].totalStars).toBe(0);
  });

  it('skips rows without a gameKey and handles empty / non-array input', () => {
    expect(aggregateGameProgress([{ levelId: '1', stars: 3 }])).toEqual([]);
    expect(aggregateGameProgress()).toEqual([]);
    expect(aggregateGameProgress(null)).toEqual([]);
  });
});
