// Centralized economy: XP/coin awards per event. Tuned so coins (the shop
// currency, priced 50..5000) are achievable-but-hard — a dedicated grinder can
// reach the top of the shop over time, but not trivially.

// Per-event coin/XP awards.
export const LESSON_AWARD = { xp: 100, coins: 10 };
export const QUIZ_AWARD = { xp: 50, coins: 15 };
export const CHALLENGE_AWARD = { xp: 150, coins: 25 };
// Winning a live coding battle. Kept here (rather than inline in the socket
// handler) so every payout in the product is tuned from one place.
export const BATTLE_AWARD = { xp: 100, coins: 25 };

// Game-level completion base awards by difficulty (first completion only).
export const GAME_DIFFICULTY_AWARDS = {
  easy: { xp: 20, coins: 5 },
  medium: { xp: 35, coins: 10 },
  hard: { xp: 60, coins: 20 },
};

// One-time bonus the first time a level reaches 3 stars.
export const PERFECT_BONUS = { xp: 15, coins: 5 };

/**
 * Pure award/idempotency logic for a game-level completion.
 *
 * @param {object} args
 * @param {object|null} args.existing  prior completion `{ stars }` or null/undefined.
 * @param {('easy'|'medium'|'hard')} args.difficulty
 * @param {number} args.stars  0..3 stars earned this attempt.
 * @returns {{
 *   awarded: { xp:number, coins:number },
 *   alreadyCompleted: boolean,
 *   bestStars: number,
 *   improved: boolean,
 *   newlyPerfect: boolean,
 *   isFirstCompletion: boolean,
 * }}
 */
export function computeGameAward({ existing, difficulty, stars }) {
  const base = GAME_DIFFICULTY_AWARDS[difficulty] || GAME_DIFFICULTY_AWARDS.easy;
  const incomingStars = Math.max(0, Math.min(3, Number(stars) || 0));
  const prevStars = existing ? Math.max(0, Math.min(3, Number(existing.stars) || 0)) : 0;
  const isFirstCompletion = !existing;

  const bestStars = Math.max(prevStars, incomingStars);
  const improved = incomingStars > prevStars;

  // 3-star bonus is granted once, the first time the level reaches 3 stars.
  const newlyPerfect = bestStars >= 3 && prevStars < 3;

  let xp = 0;
  let coins = 0;

  if (isFirstCompletion) {
    xp += base.xp;
    coins += base.coins;
  }
  if (newlyPerfect) {
    xp += PERFECT_BONUS.xp;
    coins += PERFECT_BONUS.coins;
  }

  // Replays that don't improve stars and aren't first completion award nothing.
  return {
    awarded: { xp, coins },
    alreadyCompleted: !isFirstCompletion,
    bestStars,
    improved,
    newlyPerfect,
    isFirstCompletion,
  };
}

export default {
  LESSON_AWARD,
  QUIZ_AWARD,
  CHALLENGE_AWARD,
  BATTLE_AWARD,
  GAME_DIFFICULTY_AWARDS,
  PERFECT_BONUS,
  computeGameAward,
};
