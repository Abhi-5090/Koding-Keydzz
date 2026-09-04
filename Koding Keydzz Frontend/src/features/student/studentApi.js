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
    // Report a finished lesson. The backend awards XP/coins and records the
    // lesson id against the student, so we invalidate Dashboard (XP/level +
    // completedLessonIds) and Leaderboard (XP-ranked) to reconcile from source.
    completeLesson: builder.mutation({
      query: (lessonId) => ({
        url: `/progress/lesson/${lessonId}/complete`,
        method: 'POST',
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Dashboard', 'Leaderboard'],
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
  useCompleteLessonMutation,
  useGetLeaderboardQuery,
  useGetNotificationsQuery,
  useGetAchievementsQuery,
} = studentApi
