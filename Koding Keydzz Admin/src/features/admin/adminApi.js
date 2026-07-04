import { baseApi } from '../../app/api/baseApi';

const unwrap = (res) => res?.data ?? res;

export const adminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ---- Stats ----
    getStats: builder.query({
      query: () => '/admin/stats',
      transformResponse: unwrap,
      providesTags: ['Stats'],
    }),

    // ---- Students ----
    getStudents: builder.query({
      query: (params = {}) => ({ url: '/admin/students', params }),
      transformResponse: unwrap,
      providesTags: ['Students'],
    }),
    suspendStudent: builder.mutation({
      query: ({ id, suspended }) => ({
        url: `/admin/students/${id}/suspend`,
        method: 'PATCH',
        body: { suspended },
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Students'],
    }),
    createStudent: builder.mutation({
      // body: { firstName, lastName, email, phone, password }
      query: (body) => ({ url: '/admin/students', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Students', 'Stats'],
    }),
    resetStudentPassword: builder.mutation({
      // body: { password? } — omit password to let the server generate one.
      // Response: { student: { id, name, email }, password }
      query: ({ id, password }) => ({
        url: `/admin/students/${id}/reset-password`,
        method: 'POST',
        body: password ? { password } : {},
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Students'],
    }),

    // ---- Courses ----
    getCourses: builder.query({
      query: () => '/admin/courses',
      transformResponse: unwrap,
      providesTags: ['Courses'],
    }),
    createCourse: builder.mutation({
      query: (body) => ({ url: '/admin/courses', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Courses'],
    }),
    updateCourse: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/courses/${id}`,
        method: 'PUT',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Courses'],
    }),
    deleteCourse: builder.mutation({
      query: (id) => ({ url: `/admin/courses/${id}`, method: 'DELETE' }),
      transformResponse: unwrap,
      invalidatesTags: ['Courses'],
    }),

    // ---- Lessons ----
    createLesson: builder.mutation({
      query: ({ courseId, ...body }) => ({
        url: `/admin/lessons`,
        method: 'POST',
        body: { courseId, ...body },
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Courses', 'Lessons'],
    }),
    updateLesson: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/lessons/${id}`,
        method: 'PUT',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Courses', 'Lessons'],
    }),
    deleteLesson: builder.mutation({
      query: (id) => ({ url: `/admin/lessons/${id}`, method: 'DELETE' }),
      transformResponse: unwrap,
      invalidatesTags: ['Courses', 'Lessons'],
    }),

    // ---- Challenges ----
    getChallenges: builder.query({
      query: () => '/admin/challenges',
      transformResponse: unwrap,
      providesTags: ['Challenges'],
    }),
    createChallenge: builder.mutation({
      query: (body) => ({ url: '/admin/challenges', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Challenges'],
    }),
    updateChallenge: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/challenges/${id}`,
        method: 'PUT',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Challenges'],
    }),
    deleteChallenge: builder.mutation({
      query: (id) => ({ url: `/admin/challenges/${id}`, method: 'DELETE' }),
      transformResponse: unwrap,
      invalidatesTags: ['Challenges'],
    }),

    // ---- Achievements ----
    getAchievements: builder.query({
      query: () => '/admin/achievements',
      transformResponse: unwrap,
      providesTags: ['Achievements'],
    }),
    createAchievement: builder.mutation({
      query: (body) => ({ url: '/admin/achievements', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Achievements'],
    }),
    updateAchievement: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/achievements/${id}`,
        method: 'PUT',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Achievements'],
    }),
    deleteAchievement: builder.mutation({
      query: (id) => ({ url: `/admin/achievements/${id}`, method: 'DELETE' }),
      transformResponse: unwrap,
      invalidatesTags: ['Achievements'],
    }),

    // ---- Notifications ----
    broadcastNotification: builder.mutation({
      query: (body) => ({
        url: '/admin/notifications/broadcast',
        method: 'POST',
        body,
      }),
      transformResponse: unwrap,
    }),

    // ---- Shop / Avatar items ----
    getShopItems: builder.query({
      query: () => '/admin/shop-items',
      transformResponse: unwrap,
      providesTags: ['ShopItems'],
    }),
    createShopItem: builder.mutation({
      query: (body) => ({ url: '/admin/shop-items', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['ShopItems'],
    }),
    updateShopItem: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/shop-items/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['ShopItems'],
    }),
    deleteShopItem: builder.mutation({
      query: (id) => ({ url: `/admin/shop-items/${id}`, method: 'DELETE' }),
      transformResponse: unwrap,
      invalidatesTags: ['ShopItems'],
    }),

    // ---- Leaderboards ----
    getLeaderboard: builder.query({
      query: (type = 'global') => ({ url: '/leaderboards', params: { type } }),
      transformResponse: unwrap,
      providesTags: ['Leaderboard'],
    }),

    // ---- Quizzes ----
    getQuizzes: builder.query({
      query: () => '/admin/quizzes',
      transformResponse: unwrap,
      providesTags: ['Quizzes'],
    }),
    createQuiz: builder.mutation({
      query: (body) => ({ url: '/admin/quizzes', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Quizzes'],
    }),
    updateQuiz: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/quizzes/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Quizzes'],
    }),
    deleteQuiz: builder.mutation({
      query: (id) => ({ url: `/admin/quizzes/${id}`, method: 'DELETE' }),
      transformResponse: unwrap,
      invalidatesTags: ['Quizzes'],
    }),
  }),
});

// ---- Helpers (server-driven roster export) ----

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500/api/v1';
const AUTH_STORAGE_KEY = 'kk_admin_auth';

// Read the stored access token (same key the auth slice persists to).
function getAccessToken() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.accessToken || null;
  } catch {
    return null;
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Download the org's roster CSV from the server. Throws on failure so the
// caller can surface a real error to the user.
export async function exportStudentsCsv() {
  const filename = `students_roster_${new Date().toISOString().slice(0, 10)}.csv`;
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/admin/students/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Export failed');
  }
  const blob = await res.blob();
  downloadBlob(blob, filename);
}

export const {
  useGetStatsQuery,
  useGetStudentsQuery,
  useSuspendStudentMutation,
  useCreateStudentMutation,
  useResetStudentPasswordMutation,
  useGetCoursesQuery,
  useCreateCourseMutation,
  useUpdateCourseMutation,
  useDeleteCourseMutation,
  useCreateLessonMutation,
  useUpdateLessonMutation,
  useDeleteLessonMutation,
  useGetChallengesQuery,
  useCreateChallengeMutation,
  useUpdateChallengeMutation,
  useDeleteChallengeMutation,
  useGetAchievementsQuery,
  useCreateAchievementMutation,
  useUpdateAchievementMutation,
  useDeleteAchievementMutation,
  useBroadcastNotificationMutation,
  useGetShopItemsQuery,
  useCreateShopItemMutation,
  useUpdateShopItemMutation,
  useDeleteShopItemMutation,
  useGetLeaderboardQuery,
  useGetQuizzesQuery,
  useCreateQuizMutation,
  useUpdateQuizMutation,
  useDeleteQuizMutation,
} = adminApi;
