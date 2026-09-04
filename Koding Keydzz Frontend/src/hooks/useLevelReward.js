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
 *   const result = await award({ gameKey, levelId, difficulty, moves, timeMs,
 *                                performance: { hintsUsed, mistakes } })
 *   // result.awarded.xp / result.awarded.coins / result.alreadyCompleted ...
 *   // result.best / result.levelRank  (leaderboard metrics)
 *
 * `moves` and `timeMs` are optional run metrics forwarded to the leaderboards;
 * they are only sent when finite (backward compatible).
 *
 * `performance` is HOW THE RUN WENT — `{ hintsUsed, mistakes }`, plus
 * `outcome` for Tic-Tac-Toe and `{ optimalPath, cleanCode }` for the
 * programming games. The SERVER turns those counters into a star count; the
 * `stars` a game passes here is only used for the celebration screen if the
 * request fails, never as the number of record. Always report the counters —
 * a run that reports nothing is graded at two stars and earns no perfect
 * bonus, so a game that forgets them quietly denies its players the bonus.
 * The authoritative count comes back as `result.bestStars`.
 *
 * `award` never throws — on a network/server failure it resolves to a safe
 * zero-reward shape so the win celebration still renders.
 */
export default function useLevelReward() {
  const [completeLevel, state] = useCompleteLevelMutation()

  const award = useCallback(
    async ({ gameKey, levelId, difficulty = 'easy', stars = 3, moves, timeMs, performance }) => {
      try {
        const result = await completeLevel({
          gameKey,
          levelId,
          difficulty,
          stars: Math.max(0, Math.min(3, Math.round(stars))),
          ...(Number.isFinite(moves) ? { moves } : {}),
          ...(Number.isFinite(timeMs) ? { timeMs } : {}),
          ...(performance ? { performance } : {}),
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
