import { describe, it, expect } from 'vitest';
import {
  xpForLevel,
  computeLevel,
  nextLevelXp,
  levelProgress,
  MAX_LEVEL,
} from '../src/utils/xp.js';

describe('xp utils', () => {
  describe('xpForLevel', () => {
    it('returns 0 for level 1 (and below)', () => {
      expect(xpForLevel(1)).toBe(0);
      expect(xpForLevel(0)).toBe(0);
    });

    it('follows the cumulative curve 100 * (n-1) * n / 2', () => {
      expect(xpForLevel(2)).toBe(100); // 100 * 1 * 2 / 2
      expect(xpForLevel(3)).toBe(300); // 100 * 2 * 3 / 2
      expect(xpForLevel(4)).toBe(600); // 100 * 3 * 4 / 2
    });
  });

  describe('computeLevel', () => {
    it('starts at level 1 with no xp', () => {
      expect(computeLevel(0)).toBe(1);
      expect(computeLevel(99)).toBe(1);
    });

    it('levels up exactly at the threshold', () => {
      expect(computeLevel(100)).toBe(2);
      expect(computeLevel(299)).toBe(2);
      expect(computeLevel(300)).toBe(3);
    });

    it('clamps negatives and bad input to level 1', () => {
      expect(computeLevel(-50)).toBe(1);
      expect(computeLevel(NaN)).toBe(1);
    });

    it('never exceeds MAX_LEVEL', () => {
      expect(computeLevel(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL);
    });
  });

  describe('nextLevelXp', () => {
    it('returns the threshold for the next level', () => {
      expect(nextLevelXp(0)).toBe(100); // level 1 -> next is level 2
      expect(nextLevelXp(100)).toBe(300); // level 2 -> next is level 3
    });

    it('returns the max threshold at max level', () => {
      expect(nextLevelXp(Number.MAX_SAFE_INTEGER)).toBe(xpForLevel(MAX_LEVEL));
    });
  });

  describe('levelProgress', () => {
    it('reports progress into the current level', () => {
      const p = levelProgress(150); // level 2, threshold 100, next 300
      expect(p.level).toBe(2);
      expect(p.currentLevelXp).toBe(100);
      expect(p.nextLevelXp).toBe(300);
      expect(p.xpIntoLevel).toBe(50);
      expect(p.xpToNextLevel).toBe(150);
      expect(p.percent).toBe(25);
    });
  });
});
