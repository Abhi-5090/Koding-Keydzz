import { baseApi, unwrap } from '../../app/api/baseApi'

/**
 * Mini-game completion. The backend is the single source of truth for awards
 * (idempotent per game/level/difficulty), so we never fabricate XP/coins on the
 * client — we only display what the server returns.
 *
 * POST /games/complete { gameKey, levelId, difficulty, stars, moves?, timeMs? }
 *  -> { awarded:{xp,coins}, alreadyCompleted, bestStars, totalXp, level, coins,
 *       leveledUp, best:{moves,timeMs,stars}, levelRank }
 *
 * `moves` and `timeMs` are optional run metrics (integers) used for the
 * move-count / time leaderboards; they are only sent when finite so older
 * callers stay backward compatible.
 *
 * Invalidating 'Dashboard' forces the dashboard query to refetch so the topbar
 * XP bar, level and coin counter update everywhere immediately. 'Leaderboard'
 * is invalidated so the per-game / per-level ranks refresh after a run.
 */
export const gamesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    completeLevel: builder.mutation({
      query: ({ gameKey, levelId, difficulty, stars, moves, timeMs }) => ({
        url: '/games/complete',
        method: 'POST',
        body: {
          gameKey,
          levelId,
          difficulty,
          stars,
          ...(Number.isFinite(moves) ? { moves: Math.max(0, Math.round(moves)) } : {}),
          ...(Number.isFinite(timeMs) ? { timeMs: Math.max(0, Math.round(timeMs)) } : {}),
        },
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Dashboard', 'Achievements', 'Leaderboard'],
    }),
  }),
  overrideExisting: false,
})

export const { useCompleteLevelMutation } = gamesApi
