import { useCallback } from 'react'
import { useCompleteLevelMutation } from '../features/games/gamesApi'

/**
 * useLevelReward — single entry point every mini-game uses to persist a win to
 * the player's account. Calls POST /games/complete and returns the backend
 * result (the source of truth). Because the mutation invalidates the Dashboard
 * tag, the topbar XP/level/coins refresh automatically after a successful award.
 *
 * Usage:
 *   const { award, isLoading } = useLevelReward()
 *   const result = await award({ gameKey, levelId, difficulty, stars, moves, timeMs })
 *   // result.awarded.xp / result.awarded.coins / result.alreadyCompleted ...
 *   // result.best / result.levelRank  (leaderboard metrics)
 *
 * `moves` and `timeMs` are optional run metrics forwarded to the leaderboards;
 * they are only sent when finite (backward compatible).
 *
 * `award` never throws — on a network/server failure it resolves to a safe
 * zero-reward shape so the win celebration still renders.
 */
export default function useLevelReward() {
  const [completeLevel, state] = useCompleteLevelMutation()

  const award = useCallback(
    async ({ gameKey, levelId, difficulty = 'easy', stars = 3, moves, timeMs }) => {
      try {
        const result = await completeLevel({
          gameKey,
          levelId,
          difficulty,
          stars: Math.max(0, Math.min(3, Math.round(stars))),
          ...(Number.isFinite(moves) ? { moves } : {}),
          ...(Number.isFinite(timeMs) ? { timeMs } : {}),
        }).unwrap()
        return result
      } catch {
        // Don't block the celebration if the network hiccups; show no reward.
        return {
          awarded: { xp: 0, coins: 0 },
          alreadyCompleted: false,
          bestStars: stars,
          levelRank: null,
          error: true,
        }
      }
    },
    [completeLevel]
  )

  return {
    award,
    isLoading: state.isLoading,
    isError: state.isError,
    reset: state.reset,
  }
}
