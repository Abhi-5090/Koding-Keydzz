import { userRepository } from '../repositories/userRepository.js';
import { lessonRepository } from '../repositories/lessonRepository.js';
import { challengeRepository } from '../repositories/challengeRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { assertLessonOpen } from './progressionService.js';
import { computeLevel, XP_REWARDS } from '../utils/xp.js';
import { recordLearningActivity } from './streakService.js';
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

  /**
   * Keep the daily streak BEFORE the level is computed.
   *
   * The streak bonus is XP, so it has to land before `computeLevel` or a pupil
   * whose bonus takes them over a threshold would not be told they levelled up
   * until their next activity. Ordering, not decoration.
   */
  const streak = await recordLearningActivity(user);

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
  return { user, previousLevel, leveledUp, streak };
}

export async function completeLesson(userId, lessonId) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  /**
   * THE SEQUENCE IS ENFORCED HERE, NOT ONLY ON SCREEN.
   *
   * The world page greys out a locked topic, but lesson ids come from the map
   * and this endpoint takes one in the URL. Without this check a pupil could
   * post a completion for the last lesson of a world, then the one before it,
   * and unlock the next world without having read anything — the map only
   * counts completions, it does not ask how they were arrived at.
   *
   * `assertLessonOpen` allows re-completing a lesson already finished, so
   * revisiting a lesson is never met with an error; it awards nothing the
   * second time either way.
   */
  const gate = await assertLessonOpen(user, lessonId);
  if (!gate.ok) {
    if (gate.status === 404) throw ApiError.notFound(gate.message);
    throw ApiError.forbidden(gate.message);
  }

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

  const { leveledUp, streak } = await applyGain(user, { xp: xpEarned, coins: coinsEarned });

  return {
    xpEarned,
    totalXp: user.xp,
    level: user.level,
    leveledUp,
    coins: user.coins,
    alreadyCompleted: already,
    streak,
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
