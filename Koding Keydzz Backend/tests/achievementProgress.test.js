import { describe, it, expect } from 'vitest';
import {
  currentValueFor,
  computeAchievementProgress,
  computeAllAchievementProgress,
} from '../src/utils/achievementProgress.js';

const stats = {
  xp: 1200,
  level: 11,
  coins: 80,
  totalCoinsEarned: 600,
  quizzesPassed: 5,
  gameLevelsCompleted: 20,
  perfectLevels: 8,
  lessonsCompleted: 4,
  dailyChallengesCompleted: 2,
  worldsUnlocked: 7,
};

describe('currentValueFor (criteria -> stat mapping)', () => {
  it('maps each supported criteria type', () => {
    expect(currentValueFor(stats, { type: 'levelsCompleted' })).toBe(20);
    expect(currentValueFor(stats, { type: 'perfectLevels' })).toBe(8);
    expect(currentValueFor(stats, { type: 'quizzesPassed' })).toBe(5);
    expect(currentValueFor(stats, { type: 'lessonsCompleted' })).toBe(4);
    expect(currentValueFor(stats, { type: 'totalXp' })).toBe(1200);
    expect(currentValueFor(stats, { type: 'reachLevel' })).toBe(11);
    expect(currentValueFor(stats, { type: 'coinsEarned' })).toBe(600);
    expect(currentValueFor(stats, { type: 'worldsUnlocked' })).toBe(7);
    expect(currentValueFor(stats, { type: 'dailyChallenge' })).toBe(2);
  });

  it('returns 0 for unknown criteria or missing stat', () => {
    expect(currentValueFor(stats, { type: 'mystery' })).toBe(0);
    expect(currentValueFor({}, { type: 'totalXp' })).toBe(0);
  });
});

describe('computeAchievementProgress', () => {
  it('unlocks when progress reaches the target', () => {
    const a = { key: 'rising-star', title: 'Rising Star', criteria: { type: 'reachLevel', target: 10 } };
    const r = computeAchievementProgress(a, stats);
    expect(r.progress).toBe(10);
    expect(r.target).toBe(10);
    expect(r.percent).toBe(100);
    expect(r.unlocked).toBe(true);
  });

  it('clamps progress to the target and reports partial percent', () => {
    const a = { key: 'maze-runner', title: 'Maze Runner', criteria: { type: 'levelsCompleted', target: 40 } };
    const r = computeAchievementProgress(a, stats); // 20 of 40
    expect(r.progress).toBe(20);
    expect(r.target).toBe(40);
    expect(r.percent).toBe(50);
    expect(r.unlocked).toBe(false);
  });

  it('over-target raw values clamp progress but remain unlocked', () => {
    const a = { key: 'first-code', title: 'First Code', criteria: { type: 'levelsCompleted', target: 1 } };
    const r = computeAchievementProgress(a, stats); // 20 raw, target 1
    expect(r.progress).toBe(1); // clamped
    expect(r.percent).toBe(100);
    expect(r.unlocked).toBe(true);
  });

  it('returns 0% / locked for an unmet achievement', () => {
    const a = { key: 'treasure-hoarder', title: 'Treasure Hoarder', criteria: { type: 'coinsEarned', target: 2500 } };
    const r = computeAchievementProgress(a, stats); // 600 of 2500
    expect(r.progress).toBe(600);
    expect(r.percent).toBe(24);
    expect(r.unlocked).toBe(false);
  });

  it('defaults a missing target to 1', () => {
    const a = { key: 'x', title: 'X', criteria: { type: 'dailyChallenge' } };
    const r = computeAchievementProgress(a, stats);
    expect(r.target).toBe(1);
    expect(r.unlocked).toBe(true);
  });

  it('exposes title/description/icon/type passthrough', () => {
    const a = { key: 'k', title: 'T', description: 'D', icon: 'star', criteria: { type: 'totalXp', target: 1000 } };
    const r = computeAchievementProgress(a, stats);
    expect(r).toMatchObject({ key: 'k', title: 'T', description: 'D', icon: 'star', type: 'totalXp' });
  });
});

describe('computeAllAchievementProgress', () => {
  it('computes a list', () => {
    const list = [
      { key: 'a', title: 'A', criteria: { type: 'quizzesPassed', target: 5 } },
      { key: 'b', title: 'B', criteria: { type: 'quizzesPassed', target: 15 } },
    ];
    const out = computeAllAchievementProgress(list, stats);
    expect(out).toHaveLength(2);
    expect(out[0].unlocked).toBe(true); // 5/5
    expect(out[1].unlocked).toBe(false); // 5/15
    expect(out[1].percent).toBe(33);
  });
});
