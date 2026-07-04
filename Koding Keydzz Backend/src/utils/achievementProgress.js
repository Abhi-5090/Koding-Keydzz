// Pure achievement-progress computation (no DB). Given a user-stats snapshot and
// an achievement's criteria, compute current progress toward its target.

/**
 * Resolve the current raw value for a criteria type from a stats snapshot.
 *
 * Supported criteria.type values:
 *  - levelsCompleted   -> stats.gameLevelsCompleted
 *  - perfectLevels     -> stats.perfectLevels
 *  - quizzesPassed     -> stats.quizzesPassed
 *  - lessonsCompleted  -> stats.lessonsCompleted
 *  - totalXp           -> stats.xp
 *  - reachLevel        -> stats.level
 *  - coinsEarned       -> stats.totalCoinsEarned
 *  - worldsUnlocked    -> stats.worldsUnlocked
 *  - dailyChallenge    -> stats.dailyChallengesCompleted (target defaults to 1)
 *
 * @param {object} stats
 * @param {object} criteria  `{ type, target }`
 * @returns {number}
 */
export function currentValueFor(stats = {}, criteria = {}) {
  switch (criteria.type) {
    case 'levelsCompleted':
      return Number(stats.gameLevelsCompleted) || 0;
    case 'perfectLevels':
      return Number(stats.perfectLevels) || 0;
    case 'quizzesPassed':
      return Number(stats.quizzesPassed) || 0;
    case 'lessonsCompleted':
      return Number(stats.lessonsCompleted) || 0;
    case 'totalXp':
      return Number(stats.xp) || 0;
    case 'reachLevel':
      return Number(stats.level) || 0;
    case 'coinsEarned':
      return Number(stats.totalCoinsEarned) || 0;
    case 'worldsUnlocked':
      return Number(stats.worldsUnlocked) || 0;
    case 'dailyChallenge':
      return Number(stats.dailyChallengesCompleted) || 0;
    default:
      return 0;
  }
}

/**
 * Compute per-user progress for a single achievement. Pure.
 *
 * @param {object} achievement `{ key, title, description, icon, criteria:{type,target} }`
 * @param {object} stats user-stats snapshot.
 * @returns {{ key, title, description, icon, type, progress, target, percent, unlocked }}
 */
export function computeAchievementProgress(achievement, stats = {}) {
  const criteria = achievement.criteria || {};
  const target = Math.max(1, Number(criteria.target) || 1);
  const raw = currentValueFor(stats, criteria);
  const progress = Math.max(0, Math.min(target, raw));
  const percent = Math.min(100, Math.round((progress / target) * 100));
  const unlocked = raw >= target;

  return {
    key: achievement.key,
    title: achievement.title,
    description: achievement.description || '',
    icon: achievement.icon || '',
    type: criteria.type || '',
    progress,
    target,
    percent,
    unlocked,
  };
}

/**
 * Compute progress for a list of achievements. Pure.
 */
export function computeAllAchievementProgress(achievements = [], stats = {}) {
  return achievements.map((a) => computeAchievementProgress(a, stats));
}

export default {
  currentValueFor,
  computeAchievementProgress,
  computeAllAchievementProgress,
};
