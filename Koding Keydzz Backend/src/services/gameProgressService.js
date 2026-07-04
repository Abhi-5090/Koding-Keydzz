import { userRepository } from '../repositories/userRepository.js';
import { gameScoreRepository } from '../repositories/gameScoreRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { computeLevel } from '../utils/xp.js';
import { computeGameAward } from '../utils/economy.js';
import { isBetterScore } from '../utils/leaderboard.js';
import { createNotification } from './notificationService.js';
import { checkAndUnlockAchievements } from './achievementService.js';

/** Find a user's existing best completion for a (gameKey, levelId). */
function findCompletion(user, gameKey, levelId) {
  const lid = String(levelId);
  return (user.gameProgress || []).find(
    (g) => g.gameKey === gameKey && String(g.levelId) === lid
  );
}

/**
 * Upsert the player's GameScore for (user, gameKey, levelId), keeping the best
 * result (fewer moves; tie-break lower time) and the max stars seen. Returns the
 * stored best `{ moves, timeMs, stars }` and the player's 1-based `levelRank`
 * (by moves asc, timeMs asc) or null when no moves have been recorded.
 */
async function recordGameScore(user, { gameKey, levelId, stars, moves, timeMs }) {
  const lid = String(levelId);
  const incoming = {
    moves: moves == null ? null : Number(moves),
    timeMs: timeMs == null ? null : Number(timeMs),
    stars: Math.max(0, Math.min(3, Number(stars) || 0)),
  };

  const existing = await gameScoreRepository.findByUserGameLevel(user._id, gameKey, lid);

  let best;
  if (!existing) {
    const created = await gameScoreRepository.create({
      user: user._id,
      org: user.org ?? null,
      gameKey,
      levelId: lid,
      moves: incoming.moves,
      timeMs: incoming.timeMs,
      stars: incoming.stars,
    });
    best = { moves: created.moves, timeMs: created.timeMs, stars: created.stars };
  } else {
    // Replace moves/time only when the new run is genuinely better.
    if (isBetterScore(incoming, existing)) {
      existing.moves = incoming.moves;
      existing.timeMs = incoming.timeMs;
    }
    existing.stars = Math.max(existing.stars || 0, incoming.stars);
    if (user.org != null) existing.org = user.org;
    await existing.save();
    best = { moves: existing.moves, timeMs: existing.timeMs, stars: existing.stars };
  }

  const levelRank = await gameScoreRepository.levelRankForResult(
    gameKey,
    lid,
    best.moves,
    best.timeMs
  );

  return { best, levelRank };
}

/**
 * Record a finished game level on the user's account (idempotent), award XP/coins
 * by difficulty on first completion, grant a one-time 3-star bonus, recompute
 * level, update cumulative counters, run achievement checks, and notify.
 */
export async function completeGameLevel(
  userId,
  { gameKey, levelId, difficulty, stars, moves, timeMs }
) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const existing = findCompletion(user, gameKey, levelId);
  const result = computeGameAward({ existing, difficulty, stars });
  const { awarded, alreadyCompleted, bestStars, improved, newlyPerfect, isFirstCompletion } =
    result;

  // Persist the per-level best (create or upgrade stars).
  if (isFirstCompletion) {
    user.gameProgress.push({
      gameKey,
      levelId: String(levelId),
      stars: bestStars,
      completedAt: new Date(),
    });
  } else if (improved) {
    existing.stars = bestStars;
    existing.completedAt = new Date();
  }

  // Cumulative counters.
  if (isFirstCompletion) {
    user.gameLevelsCompleted += 1;
  }
  if (newlyPerfect) {
    user.perfectLevels += 1;
  }

  const previousLevel = user.level;
  if (awarded.xp || awarded.coins) {
    user.xp += awarded.xp;
    user.coins += awarded.coins;
    user.totalCoinsEarned += awarded.coins;
    user.level = computeLevel(user.xp);
  }

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

  // Achievement checks (saves user again if anything unlocks).
  await checkAndUnlockAchievements(user);

  // Record move/time best for leaderboards (independent of XP/coin idempotency).
  const { best, levelRank } = await recordGameScore(user, {
    gameKey,
    levelId,
    stars,
    moves,
    timeMs,
  });

  return {
    awarded,
    alreadyCompleted,
    bestStars,
    totalXp: user.xp,
    level: user.level,
    coins: user.coins,
    leveledUp,
    best,
    levelRank,
  };
}

export default { completeGameLevel };
