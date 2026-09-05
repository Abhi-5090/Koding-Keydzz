import { baseApi, unwrap } from '../../app/api/baseApi'

export const studentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboard: builder.query({
      query: () => '/student/dashboard',
      transformResponse: unwrap,
      providesTags: ['Dashboard'],
    }),

    /**
     * WORK MY TEACHER HAS SET ME.
     *
     * There is nothing to hand in and no "done" button to press: the server
     * works out what I have finished from my own progress — the lessons I have
     * completed, the quizzes I have passed, the levels I have beaten. So this
     * is read-only, and it re-reads whenever that progress changes, which is
     * why it shares the Dashboard tag rather than owning one.
     */
    getMyAssignments: builder.query({
      query: () => '/student/assignments',
      transformResponse: unwrap,
      providesTags: ['Assignments', 'Dashboard'],
    }),
    /**
     * This pupil's worlds, optionally for a NAMED course.
     *
     * The map shows all four courses and drills into whichever one the pupil
     * opens, so it asks about a course that may not be the one they are
     * furthest through. Passing no slug keeps the old behaviour — the course
     * they are currently on — which is what the dashboard wants.
     *
     * Each world comes back already carrying `unlocked`, `lockedReason`,
     * `lessonCount`, `completedLessons` and `percent`. None of that is
     * recomputed here: a second implementation of the unlock rule in the
     * client would eventually disagree with the one that gates the content.
     */
    getWorlds: builder.query({
      query: (courseSlug) =>
        courseSlug ? `/worlds?course=${encodeURIComponent(courseSlug)}` : '/worlds',
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
  useGetMyAssignmentsQuery,
  useGetDashboardQuery,
  useGetWorldsQuery,
  useGetLessonsQuery,
  useCompleteLessonMutation,
  useGetLeaderboardQuery,
  useGetNotificationsQuery,
  useGetAchievementsQuery,
} = studentApi
