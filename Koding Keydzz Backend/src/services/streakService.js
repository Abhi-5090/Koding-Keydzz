import { orgRepository } from '../repositories/orgRepository.js';
import { dayKey, nextStreak, streakBonusFor, STREAK_BONUS_XP } from '../utils/streak.js';

/**
 * Record that a pupil did some learning today, and keep their streak.
 *
 * WHERE THIS IS CALLED FROM
 * -------------------------
 * Every path that credits XP for finishing something: lessons and challenges
 * (progressService), quizzes (quizService), game levels (gameProgressService)
 * and the final test. There is no single choke point for XP in this codebase —
 * three services mutate `user.xp` directly — so this is called from each
 * rather than pretending a choke point exists.
 *
 * WHY IT MUTATES AND DOES NOT SAVE
 * --------------------------------
 * Each caller already has a loaded user document that it is about to save with
 * its own XP change. Saving here as well would mean two writes per lesson and,
 * worse, a window where the streak was recorded but the lesson was not. So this
 * mutates the document in place and lets the caller's existing save persist
 * both together.
 *
 * The bonus XP is ADDED TO THE DOCUMENT here, and the amount is returned so the
 * caller can tell the pupil about it. Level recomputation stays with the
 * caller, which is what already owns it.
 */
export async function recordLearningActivity(user, when = new Date()) {
  if (!user || user.role !== 'student') {
    return { changed: false, bonusXp: 0, current: 0, longest: 0 };
  }

  const timeZone = await timeZoneFor(user);
  const today = dayKey(when, timeZone);

  const state = nextStreak(user.streak, today);

  if (!state.changed) {
    // The common case: the pupil has already done something today. No write,
    // and crucially no second bonus.
    return {
      changed: false,
      bonusXp: 0,
      current: state.current,
      longest: state.longest,
      alreadyCountedToday: true,
    };
  }

  const bonusXp = streakBonusFor(state);

  user.streak = {
    current: state.current,
    longest: state.longest,
    lastActiveOn: state.lastActiveOn,
  };
  if (bonusXp > 0) {
    user.xp += bonusXp;
  }

  return {
    changed: true,
    extended: state.extended,
    reset: state.reset,
    bonusXp,
    current: state.current,
    longest: state.longest,
    alreadyCountedToday: false,
  };
}

/**
 * The timezone the pupil's days are measured in.
 *
 * Their organization's, falling back to the platform default. A pupil with no
 * organization (there should be none, but the schema permits it) gets the
 * default rather than an exception.
 */
async function timeZoneFor(user) {
  if (!user.org) return 'Asia/Kolkata';
  try {
    const org = await orgRepository.findById(user.org);
    return org?.timezone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

/** The streak, shaped for a client. Safe on a user who has never had one. */
export function streakSummary(user) {
  return {
    current: Math.max(0, Number(user?.streak?.current) || 0),
    longest: Math.max(0, Number(user?.streak?.longest) || 0),
    lastActiveOn: user?.streak?.lastActiveOn || null,
    bonusXp: STREAK_BONUS_XP,
  };
}

export default { recordLearningActivity, streakSummary };
