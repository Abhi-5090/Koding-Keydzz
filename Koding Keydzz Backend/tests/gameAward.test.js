import { describe, it, expect } from 'vitest';
import {
  computeGameAward,
  GAME_DIFFICULTY_AWARDS,
  PERFECT_BONUS,
} from '../src/utils/economy.js';

describe('computeGameAward (game-level completion logic)', () => {
  describe('first completion awards by difficulty', () => {
    it('awards easy base on first completion', () => {
      const r = computeGameAward({ existing: null, difficulty: 'easy', stars: 1 });
      expect(r.awarded).toEqual(GAME_DIFFICULTY_AWARDS.easy);
      expect(r.alreadyCompleted).toBe(false);
      expect(r.isFirstCompletion).toBe(true);
      expect(r.bestStars).toBe(1);
    });

    it('awards medium base on first completion', () => {
      const r = computeGameAward({ existing: null, difficulty: 'medium', stars: 2 });
      expect(r.awarded).toEqual(GAME_DIFFICULTY_AWARDS.medium);
    });

    it('awards hard base on first completion', () => {
      const r = computeGameAward({ existing: null, difficulty: 'hard', stars: 2 });
      expect(r.awarded).toEqual(GAME_DIFFICULTY_AWARDS.hard);
    });

    it('falls back to easy for an unknown difficulty', () => {
      const r = computeGameAward({ existing: null, difficulty: 'extreme', stars: 0 });
      expect(r.awarded).toEqual(GAME_DIFFICULTY_AWARDS.easy);
    });
  });

  describe('3-star bonus (one-time)', () => {
    it('adds the perfect bonus when first completion is already 3 stars', () => {
      const r = computeGameAward({ existing: null, difficulty: 'easy', stars: 3 });
      expect(r.newlyPerfect).toBe(true);
      expect(r.awarded.xp).toBe(GAME_DIFFICULTY_AWARDS.easy.xp + PERFECT_BONUS.xp);
      expect(r.awarded.coins).toBe(GAME_DIFFICULTY_AWARDS.easy.coins + PERFECT_BONUS.coins);
    });

    it('grants the perfect bonus once when improving to 3 stars later', () => {
      const r = computeGameAward({ existing: { stars: 2 }, difficulty: 'medium', stars: 3 });
      expect(r.isFirstCompletion).toBe(false);
      expect(r.newlyPerfect).toBe(true);
      expect(r.improved).toBe(true);
      expect(r.bestStars).toBe(3);
      // Only the bonus, no base (not a first completion).
      expect(r.awarded).toEqual(PERFECT_BONUS);
    });

    it('does not re-grant the perfect bonus on a 3-star replay', () => {
      const r = computeGameAward({ existing: { stars: 3 }, difficulty: 'hard', stars: 3 });
      expect(r.newlyPerfect).toBe(false);
      expect(r.improved).toBe(false);
      expect(r.awarded).toEqual({ xp: 0, coins: 0 });
    });
  });

  describe('idempotency / replays', () => {
    it('awards nothing for a replay that does not improve stars', () => {
      const r = computeGameAward({ existing: { stars: 2 }, difficulty: 'hard', stars: 1 });
      expect(r.alreadyCompleted).toBe(true);
      expect(r.improved).toBe(false);
      expect(r.bestStars).toBe(2); // best kept
      expect(r.awarded).toEqual({ xp: 0, coins: 0 });
    });

    it('keeps the best stars and awards nothing for an equal replay (below 3)', () => {
      const r = computeGameAward({ existing: { stars: 2 }, difficulty: 'medium', stars: 2 });
      expect(r.bestStars).toBe(2);
      expect(r.awarded).toEqual({ xp: 0, coins: 0 });
    });

    it('updates bestStars when improving (no bonus below 3)', () => {
      const r = computeGameAward({ existing: { stars: 1 }, difficulty: 'easy', stars: 2 });
      expect(r.improved).toBe(true);
      expect(r.bestStars).toBe(2);
      expect(r.newlyPerfect).toBe(false);
      expect(r.awarded).toEqual({ xp: 0, coins: 0 });
    });
  });

  it('clamps out-of-range star values into 0..3', () => {
    const r = computeGameAward({ existing: null, difficulty: 'easy', stars: 9 });
    expect(r.bestStars).toBe(3);
    expect(r.newlyPerfect).toBe(true);
  });
});
