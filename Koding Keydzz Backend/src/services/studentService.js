import { userRepository } from '../repositories/userRepository.js';
import { worldRepository } from '../repositories/worldRepository.js';
import { lessonRepository } from '../repositories/lessonRepository.js';
import { challengeRepository } from '../repositories/challengeRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { nextLevelXp, levelProgress } from '../utils/xp.js';
import { listAchievementsForUser } from './achievementService.js';

export async function getDashboard(userId) {
  const user = await userRepository.findById(userId, null, {});
  if (!user) throw ApiError.notFound('User not found');

  const [worlds, dailyChallenges, totalLessons, achievements] = await Promise.all([
    worldRepository.findAllOrdered(),
    challengeRepository.findDaily(),
    lessonRepository.count(),
    listAchievementsForUser(user),
  ]);

  const completedLessonIds = new Set(
    user.completedLessons.map((c) => String(c.lesson))
  );

  // Per-world progress
  const lessonsByWorld = await Promise.all(
    worlds.map(async (w) => {
      const lessons = await lessonRepository.findByWorld(w._id);
      const total = lessons.length;
      const completed = lessons.filter((l) =>
        completedLessonIds.has(String(l._id))
      ).length;
      return {
        worldId: w._id,
        world: w.name,
        slug: w.slug,
        order: w.order,
        total,
        completed,
        percent: total ? Math.round((completed / total) * 100) : 0,
        locked: user.level < w.requiredLevel,
      };
    })
  );

  const progress = {
    worlds: lessonsByWorld,
    totalLessons,
    completedLessons: completedLessonIds.size,
    overallPercent: totalLessons
      ? Math.round((completedLessonIds.size / totalLessons) * 100)
      : 0,
    level: levelProgress(user.xp),
  };

  return {
    xp: user.xp,
    level: user.level,
    coins: user.coins,
    achievements,
    dailyChallenges,
    progress,
    nextLevelXp: nextLevelXp(user.xp),
  };
}

export default { getDashboard };
