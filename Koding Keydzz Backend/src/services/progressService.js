import { userRepository } from '../repositories/userRepository.js';
import { lessonRepository } from '../repositories/lessonRepository.js';
import { challengeRepository } from '../repositories/challengeRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { computeLevel, XP_REWARDS } from '../utils/xp.js';
import { createNotification } from './notificationService.js';
import { checkAndUnlockAchievements } from './achievementService.js';

/**
 * Apply an XP/coin gain to a user, recompute level, persist, fire level-up
 * notifications, and run achievement checks. `coins` also accrues to the
 * lifetime totalCoinsEarned counter. Returns the mutated, persisted user
 * document plus level-change metadata.
 */
async function applyGain(user, { xp = 0, coins = 0 }) {
  const previousLevel = user.level;
  user.xp += xp;
  user.coins += coins;
  user.totalCoinsEarned += coins;
  user.level = computeLevel(user.xp);
  await user.save();

  const leveledUp = user.level > previousLevel;
  if (leveledUp) {
    await createNotification(user._id, {
      type: 'levelup',
      title: 'Level Up!',
      body: `Congratulations! You reached level ${user.level}.`,
      meta: { level: user.level },
    });
  }

  await checkAndUnlockAchievements(user);
  return { user, previousLevel, leveledUp };
}

export async function completeLesson(userId, lessonId) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const lesson = await lessonRepository.findById(lessonId);
  if (!lesson) throw ApiError.notFound('Lesson not found');

  const already = user.completedLessons.some(
    (c) => String(c.lesson) === String(lessonId)
  );

  const xpEarned = already ? 0 : lesson.xpReward || XP_REWARDS.lesson;
  const coinsEarned = already ? 0 : 10;

  if (!already) {
    user.completedLessons.push({
      lesson: lesson._id,
      world: lesson.world,
      xpEarned,
    });
    user.lessonsCompleted += 1;
  }

  const { leveledUp } = await applyGain(user, { xp: xpEarned, coins: coinsEarned });

  return {
    xpEarned,
    totalXp: user.xp,
    level: user.level,
    leveledUp,
    coins: user.coins,
    alreadyCompleted: already,
  };
}

export async function completeChallenge(userId, challengeId) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const challenge = await challengeRepository.findById(challengeId);
  if (!challenge) throw ApiError.notFound('Challenge not found');

  const already = user.completedChallenges.some(
    (c) => String(c) === String(challengeId)
  );

  const xpEarned = already ? 0 : challenge.xpReward || XP_REWARDS.challenge;
  const coinsEarned = already ? 0 : challenge.coinReward || 0;

  if (!already) {
    user.completedChallenges.push(challenge._id);
    if (challenge.daily) {
      user.dailyChallengesCompleted += 1;
    }
  }

  await applyGain(user, { xp: xpEarned, coins: coinsEarned });

  return {
    xpEarned,
    coins: user.coins,
    coinsEarned,
    totalXp: user.xp,
    level: user.level,
    alreadyCompleted: already,
  };
}

export default { completeLesson, completeChallenge };
