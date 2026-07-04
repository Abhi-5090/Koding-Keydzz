import { describe, it, expect } from 'vitest';
import {
  LESSON_AWARD,
  QUIZ_AWARD,
  CHALLENGE_AWARD,
  GAME_DIFFICULTY_AWARDS,
  PERFECT_BONUS,
} from '../src/utils/economy.js';

describe('economy award amounts', () => {
  it('per-event awards match the tuned economy', () => {
    expect(LESSON_AWARD).toEqual({ xp: 100, coins: 10 });
    expect(QUIZ_AWARD).toEqual({ xp: 50, coins: 15 });
    expect(CHALLENGE_AWARD).toEqual({ xp: 150, coins: 25 });
  });

  it('game-level base awards scale by difficulty', () => {
    expect(GAME_DIFFICULTY_AWARDS.easy).toEqual({ xp: 20, coins: 5 });
    expect(GAME_DIFFICULTY_AWARDS.medium).toEqual({ xp: 35, coins: 10 });
    expect(GAME_DIFFICULTY_AWARDS.hard).toEqual({ xp: 60, coins: 20 });
  });

  it('the one-time 3-star bonus is +15 XP / +5 coins', () => {
    expect(PERFECT_BONUS).toEqual({ xp: 15, coins: 5 });
  });

  it('coin awards stay modest so 5000 coins is a long-term goal', () => {
    // Even grinding 100 hard levels at full 3 stars only yields 2500 coins.
    const perHardPerfect = GAME_DIFFICULTY_AWARDS.hard.coins + PERFECT_BONUS.coins;
    expect(perHardPerfect).toBe(25);
    expect(perHardPerfect * 100).toBeLessThan(5000);
  });
});
