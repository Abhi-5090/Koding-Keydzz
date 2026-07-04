import { baseApi, unwrap } from '../../app/api/baseApi'

export const studentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboard: builder.query({
      query: () => '/student/dashboard',
      transformResponse: unwrap,
      providesTags: ['Dashboard'],
    }),
    getWorlds: builder.query({
      query: () => '/worlds',
      transformResponse: unwrap,
      providesTags: ['Worlds'],
    }),
    getLessons: builder.query({
      query: (worldId) => `/worlds/${worldId}/lessons`,
      transformResponse: unwrap,
      providesTags: ['Lessons'],
    }),
    // Leaderboard scope. The backend reads `type` (enum: global|school|weekly);
    // `scope` is sent alongside for forward-compat with newer API builds.
    // RTK caches per-arg, so switching tabs refetches the right scope.
    getLeaderboard: builder.query({
      query: (scope = 'global') => `/leaderboards?scope=${scope}&type=${scope}`,
      transformResponse: unwrap,
      providesTags: (result, error, scope) => [{ type: 'Leaderboard', id: scope }],
    }),
    getNotifications: builder.query({
      query: () => '/notifications',
      transformResponse: unwrap,
      providesTags: ['Notifications'],
    }),
    getAchievements: builder.query({
      query: () => '/achievements',
      transformResponse: unwrap,
      providesTags: ['Achievements'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetDashboardQuery,
  useGetWorldsQuery,
  useGetLessonsQuery,
  useGetLeaderboardQuery,
  useGetNotificationsQuery,
  useGetAchievementsQuery,
} = studentApi
