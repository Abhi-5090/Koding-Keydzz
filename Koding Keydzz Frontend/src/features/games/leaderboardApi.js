import { baseApi, unwrap } from '../../app/api/baseApi'

/**
 * Move-count / time leaderboards for the mini-games. Both endpoints are read
 * only and tagged 'Leaderboard' so a POST /games/complete (which invalidates
 * that tag) refreshes the ranks automatically after a run.
 *
 * GET /games/:gameKey/leaderboard?limit=&scope=global|org
 *  -> { entries:[{ rank, userId, name, avatar, levelsCompleted, totalStars,
 *                  totalMoves, totalTimeMs }], me:{...}|null, totalPlayers }
 *
 * GET /games/:gameKey/levels/:levelId/leaderboard?limit=&scope=global|org
 *  -> { entries:[{ rank, userId, name, avatar, moves, timeMs, stars }],
 *       me:{...}|null, totalPlayers }
 */
export const leaderboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getGameLeaderboard: builder.query({
      query: ({ gameKey, scope = 'global', limit = 25 }) =>
        `/games/${encodeURIComponent(gameKey)}/leaderboard?limit=${limit}&scope=${scope}`,
      transformResponse: unwrap,
      providesTags: (result, error, arg) => [
        { type: 'Leaderboard', id: `game-${arg?.gameKey}` },
        'Leaderboard',
      ],
    }),
    getLevelLeaderboard: builder.query({
      query: ({ gameKey, levelId, scope = 'global', limit = 15 }) =>
        `/games/${encodeURIComponent(gameKey)}/levels/${encodeURIComponent(
          levelId
        )}/leaderboard?limit=${limit}&scope=${scope}`,
      transformResponse: unwrap,
      providesTags: (result, error, arg) => [
        { type: 'Leaderboard', id: `level-${arg?.gameKey}-${arg?.levelId}` },
        'Leaderboard',
      ],
    }),
  }),
  overrideExisting: false,
})

export const { useGetGameLeaderboardQuery, useGetLevelLeaderboardQuery } = leaderboardApi
