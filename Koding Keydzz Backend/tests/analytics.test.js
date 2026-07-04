import { describe, it, expect } from 'vitest';
import {
  XP_BUCKETS,
  xpBucket,
  bucketizeXp,
  monthKey,
  lastNMonths,
  fillMonthlySeries,
} from '../src/utils/analytics.js';
import { countQuestionTypes } from '../src/services/quizService.js';

describe('analytics helpers', () => {
  describe('xpBucket', () => {
    it('maps values to the right bucket boundaries', () => {
      expect(xpBucket(0)).toBe('0-99');
      expect(xpBucket(99)).toBe('0-99');
      expect(xpBucket(100)).toBe('100-499');
      expect(xpBucket(499)).toBe('100-499');
      expect(xpBucket(500)).toBe('500-1999');
      expect(xpBucket(2000)).toBe('2000-4999');
      expect(xpBucket(5000)).toBe('5000-9999');
      expect(xpBucket(10000)).toBe('10000+');
      expect(xpBucket(999999)).toBe('10000+');
    });

    it('clamps negatives and bad input to the first bucket', () => {
      expect(xpBucket(-10)).toBe('0-99');
      expect(xpBucket(NaN)).toBe('0-99');
      expect(xpBucket(undefined)).toBe('0-99');
    });
  });

  describe('bucketizeXp', () => {
    it('returns every bucket in canonical order, zero-filled', () => {
      const result = bucketizeXp([]);
      expect(result.map((b) => b.bucket)).toEqual(XP_BUCKETS.map((b) => b.bucket));
      expect(result.every((b) => b.count === 0)).toBe(true);
    });

    it('counts values into the correct buckets', () => {
      const result = bucketizeXp([0, 50, 100, 250, 600, 12000, 12000]);
      const byBucket = Object.fromEntries(result.map((b) => [b.bucket, b.count]));
      expect(byBucket['0-99']).toBe(2);
      expect(byBucket['100-499']).toBe(2);
      expect(byBucket['500-1999']).toBe(1);
      expect(byBucket['10000+']).toBe(2);
      expect(byBucket['2000-4999']).toBe(0);
    });
  });

  describe('monthKey', () => {
    it('formats a date as YYYY-MM (UTC)', () => {
      expect(monthKey(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01');
      expect(monthKey(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12');
    });
  });

  describe('lastNMonths', () => {
    it('returns n month keys oldest-first ending at the ref month', () => {
      const months = lastNMonths(6, new Date('2026-06-16T00:00:00Z'));
      expect(months).toEqual([
        '2026-01',
        '2026-02',
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
      ]);
    });

    it('wraps across a year boundary', () => {
      const months = lastNMonths(3, new Date('2026-02-10T00:00:00Z'));
      expect(months).toEqual(['2025-12', '2026-01', '2026-02']);
    });
  });

  describe('fillMonthlySeries', () => {
    it('zero-fills missing months and preserves order', () => {
      const months = ['2026-01', '2026-02', '2026-03'];
      const rows = [
        { period: '2026-03', count: 5 },
        { period: '2026-01', count: 2 },
      ];
      expect(fillMonthlySeries(rows, months)).toEqual([
        { period: '2026-01', count: 2 },
        { period: '2026-02', count: 0 },
        { period: '2026-03', count: 5 },
      ]);
    });
  });
});

describe('countQuestionTypes', () => {
  it('counts questions grouped by type, defaulting missing type to mcq', () => {
    const counts = countQuestionTypes([
      { type: 'mcq' },
      { type: 'fillblank' },
      { type: 'fillblank' },
      { type: 'match' },
      {},
    ]);
    expect(counts).toEqual({ mcq: 2, fillblank: 2, match: 1 });
  });

  it('returns an empty object for no questions', () => {
    expect(countQuestionTypes([])).toEqual({});
  });
});
