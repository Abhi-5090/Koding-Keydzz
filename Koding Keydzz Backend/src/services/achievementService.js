import { achievementRepository } from '../repositories/achievementRepository.js';
import { worldRepository } from '../repositories/worldRepository.js';
import {
  computeAchievementProgress,
  computeAllAchievementProgress,
} from '../utils/achievementProgress.js';
import { createNotification } from './notificationService.js';

/** Raw achievement catalog (no per-user progress). */
export function listAchievements() {
  return achievementRepository.findAll();
}

/**
 * Build a flat stats snapshot from a user doc, resolving derived counters
 * (worldsUnlocked is computed from the worlds the user's level can access).
 */
export async function buildUserStats(user) {
  const worlds = await worldRepository.findAllOrdered();
  const worldsUnlocked = worlds.filter(
    (w) => (w.requiredLevel || 1) <= user.level
  ).length;

  return {
    xp: user.xp || 0,
    level: user.level || 1,
    coins: user.coins || 0,
    totalCoinsEarned: user.totalCoinsEarned || 0,
    quizzesPassed: user.quizzesPassed || 0,
    gameLevelsCompleted: user.gameLevelsCompleted || 0,
    perfectLevels: user.perfectLevels || 0,
    lessonsCompleted: user.lessonsCompleted || 0,
    dailyChallengesCompleted: user.dailyChallengesCompleted || 0,
    worldsUnlocked,
  };
}

/**
 * Per-user achievement list with progress:
 * `{ key, title, description, icon, progress, target, percent, unlocked }`.
 */
export async function listAchievementsForUser(user) {
  const [achievements, stats] = await Promise.all([
    achievementRepository.findAll(),
    buildUserStats(user),
  ]);
  return computeAllAchievementProgress(achievements, stats);
}

/**
 * Evaluate all achievements against a (mutated, already-persisted) user during
 * an award path. Newly-unlocked achievements are pushed onto user.achievements
 * (deduped) and a notification is emitted. Saves the user if anything changed.
 *
 * Returns the list of newly-unlocked achievement docs.
 */
export async function checkAndUnlockAchievements(user) {
  const [achievements, stats] = await Promise.all([
    achievementRepository.findAll(),
    buildUserStats(user),
  ]);

  const ownedIds = new Set((user.achievements || []).map((a) => String(a)));
  const newlyUnlocked = [];

  for (const achievement of achievements) {
    const result = computeAchievementProgress(achievement, stats);
    if (result.unlocked && !ownedIds.has(String(achievement._id))) {
      user.achievements.push(achievement._id);
      ownedIds.add(String(achievement._id));
      newlyUnlocked.push(achievement);
    }
  }

  if (newlyUnlocked.length) {
    await user.save();
    for (const a of newlyUnlocked) {
      await createNotification(user._id, {
        type: 'achievement',
        title: 'Achievement Unlocked!',
        body: `You unlocked "${a.title}".`,
        meta: { key: a.key, achievementId: a._id },
      });
    }
  }

  return newlyUnlocked;
}

export default {
  listAchievements,
  buildUserStats,
  listAchievementsForUser,
  checkAndUnlockAchievements,
};
