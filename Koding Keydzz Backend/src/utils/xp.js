// XP rewards per activity type.
export const XP_REWARDS = {
  lesson: 100,
  quiz: 50,
  challenge: 150,
  project: 300,
};

export const MAX_LEVEL = 100;

/**
 * Cumulative XP required to *reach* level n (i.e. total XP at the start of level n).
 * Curve: xpForLevel(n) = 100 * n * (n + 1) / 2
 * Level 1 starts at 0 XP by convention (xpForLevel(1) is used as a threshold base).
 */
export function xpForLevel(n) {
  if (n <= 1) return 0;
  // Total XP needed to have completed levels up to (n-1) and enter level n.
  return (100 * (n - 1) * n) / 2;
}

/**
 * Given a total XP amount, compute the current level (1..MAX_LEVEL).
 */
export function computeLevel(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  let level = 1;
  for (let n = 2; n <= MAX_LEVEL; n += 1) {
    if (xp >= xpForLevel(n)) {
      level = n;
    } else {
      break;
    }
  }
  return level;
}

/**
 * XP threshold required to reach the next level from the current total XP.
 * Returns the cumulative XP needed for (currentLevel + 1). At max level returns
 * the current level threshold.
 */
export function nextLevelXp(totalXp) {
  const level = computeLevel(totalXp);
  if (level >= MAX_LEVEL) {
    return xpForLevel(MAX_LEVEL);
  }
  return xpForLevel(level + 1);
}

/**
 * Convenience: progress info toward the next level.
 */
export function levelProgress(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  const level = computeLevel(xp);
  const currentThreshold = xpForLevel(level);
  const next = nextLevelXp(xp);
  const span = Math.max(1, next - currentThreshold);
  const into = xp - currentThreshold;
  return {
    level,
    totalXp: xp,
    currentLevelXp: currentThreshold,
    nextLevelXp: next,
    xpIntoLevel: into,
    xpToNextLevel: Math.max(0, next - xp),
    percent: Math.min(100, Math.round((into / span) * 100)),
  };
}

export default {
  XP_REWARDS,
  MAX_LEVEL,
  xpForLevel,
  computeLevel,
  nextLevelXp,
  levelProgress,
};
