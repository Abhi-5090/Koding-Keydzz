import { baseApi } from '../../app/api/baseApi';

const unwrap = (res) => res?.data ?? res;

export const adminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /* ---- Final-test results (read only) ----
     *
     * Staff track and support; they never mark or change a score. The endpoint
     * is scoped to the school and, for a teacher, narrowed to their own
     * classes by the same middleware every other student read uses.
     */
    getTestResults: builder.query({
      query: ({ slug, ...params }) => ({ url: `/admin/test-results/${slug}`, params }),
      transformResponse: unwrap,
      providesTags: (res, err, arg) => [{ type: 'TestResults', id: arg?.slug }],
    }),

    /* ====================================================================
     * THE MARKING QUEUE — answers the machine could not mark.
     *
     * Task answers with no machine-checkable rule, and coding answers the
     * runner could not judge, are flagged `needsReview`. That is a WITHHELD
     * mark, never a zero — so until a human awards it the pupil is scored
     * below their real mark with no remedy. The service and the endpoints
     * existed; there was no screen, which is what made the withheld mark
     * permanent in practice.
     *
     * This is the ONLY surface in the product that shows staff a mark scheme,
     * which is why it is gated on `final_test:mark` rather than on plain
     * student read.
     * ==================================================================== */
    getReviewQueue: builder.query({
      query: (params) => ({ url: '/admin/review-queue', params }),
      transformResponse: unwrap,
      providesTags: ['ReviewQueue'],
    }),

    markTestAnswer: builder.mutation({
      query: ({ attemptId, ...body }) => ({
        url: `/admin/review-queue/${attemptId}`,
        method: 'POST',
        body,
      }),
      transformResponse: unwrap,
      /**
       * Marking recomputes the whole attempt from the PAPER, so a released
       * mark can change a pass/fail and unlock the next course. Both the queue
       * and the results table have to be refetched rather than patched
       * locally — the server is the only thing that knows the new total.
       */
      invalidatesTags: ['ReviewQueue', 'TestResults', 'Analytics', 'Reports'],
    }),

    /* ====================================================================
     * TEACHING INSIGHTS.
     *
     * Scoped exactly like the class report: a teacher sees their own classes,
     * an administrator the whole school. Read-only — nothing here changes a
     * mark or a pupil.
     * ==================================================================== */
    getHardestQuestions: builder.query({
      query: (params) => ({ url: '/admin/insights/questions', params }),
      transformResponse: unwrap,
      providesTags: ['Insights'],
    }),
    getHardestQuizzes: builder.query({
      query: (params) => ({ url: '/admin/insights/quizzes', params }),
      transformResponse: unwrap,
      providesTags: ['Insights'],
    }),
    getStallPoints: builder.query({
      query: (params) => ({ url: '/admin/insights/stalls', params }),
      transformResponse: unwrap,
      providesTags: ['Insights'],
    }),

    /**
     * SYSTEM HEALTH — the metrics endpoint, read by a human.
     *
     * The application published these all along and nothing looked at them.
     * Prometheus rules now exist (ops/alerts/), but not every deployment runs
     * Prometheus, and a platform owner should be able to see whether exams can
     * be marked without setting up a monitoring stack first.
     *
     * `kk_code_runner_available` is the one that matters: with a runtime
     * missing, coding answers cannot be judged and quietly pile into the
     * marking queue while the exam still appears to work.
     *
     * Polled rather than cached — a health reading five minutes stale is
     * worse than none, because it is believed.
     */
    getSystemHealth: builder.query({
      query: () => '/metrics',
      transformResponse: unwrap,
      keepUnusedDataFor: 15,
    }),

    /* ====================================================================
     * ASSIGNMENTS — the primitive the product did not have.
     *
     * Completion is DERIVED on the server from progress the pupil already
     * recorded, so there is nothing to mark done from here and no submission
     * endpoint to call. Every mutation refetches rather than patching the
     * cache: the completion figures are computed, not stored, and only the
     * server can recompute them.
     * ==================================================================== */
    getClassroomAssignments: builder.query({
      query: ({ classroomId, includeArchived }) => ({
        url: `/admin/classrooms/${classroomId}/assignments`,
        params: includeArchived ? { includeArchived: 'true' } : undefined,
      }),
      transformResponse: unwrap,
      providesTags: (r, e, arg) => [{ type: 'Assignments', id: arg?.classroomId }],
    }),
    createAssignment: builder.mutation({
      query: ({ classroomId, ...body }) => ({
        url: `/admin/classrooms/${classroomId}/assignments`,
        method: 'POST',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: (r, e, arg) => [{ type: 'Assignments', id: arg?.classroomId }],
    }),
    updateAssignment: builder.mutation({
      query: ({ id, classroomId, ...body }) => ({
        url: `/admin/assignments/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: (r, e, arg) => [{ type: 'Assignments', id: arg?.classroomId }],
    }),
    archiveAssignment: builder.mutation({
      query: ({ id, archive = true }) => ({
        url: `/admin/assignments/${id}/archive`,
        method: 'POST',
        body: { archive },
      }),
      transformResponse: unwrap,
      invalidatesTags: (r, e, arg) => [{ type: 'Assignments', id: arg?.classroomId }],
    }),

    // ---- Stats ----
    getStats: builder.query({
      query: () => '/admin/stats',
      transformResponse: unwrap,
      providesTags: ['Stats'],
    }),

    /* ====================================================================
     * ANALYTICS — the dashboard data source.
     *
     * One endpoint serves both roles: an administrator gets the whole
     * school, a faculty member gets exactly the pupils in the classes they
     * teach. The server resolves that from the caller's token, so the client
     * needs no branching.
     * ================================================================== */
    getOrgAnalytics: builder.query({
      // arg: { days } — reporting window, 7..365 (default 30)
      query: (params = {}) => ({ url: '/admin/analytics', params }),
      transformResponse: unwrap,
      providesTags: ['Analytics'],
    }),
    getClassroomAnalytics: builder.query({
      query: ({ id, ...params }) => ({ url: `/admin/analytics/classrooms/${id}`, params }),
      transformResponse: unwrap,
      providesTags: (r, e, arg) => [{ type: 'Analytics', id: arg?.id }],
    }),

    /* ---- Reports ---- */
    getClassReport: builder.query({
      query: (params = {}) => ({ url: '/admin/reports/class', params }),
      transformResponse: unwrap,
      providesTags: ['Reports'],
    }),
    getQuizReport: builder.query({
      query: (id) => `/admin/reports/quiz/${id}`,
      transformResponse: unwrap,
      providesTags: (r, e, id) => [{ type: 'Reports', id }],
    }),

    /* ====================================================================
     * STAFF — administrators and faculty.
     *
     * An organization can have many of both. Creating one returns a
     * one-time password to hand over, since there is no mail provider.
     * ================================================================== */
    getStaff: builder.query({
      // arg: { role?: 'admin'|'faculty', search?, page?, limit? }
      query: (params = {}) => ({ url: '/admin/staff', params }),
      transformResponse: unwrap,
      providesTags: ['Staff'],
    }),
    getStaffMember: builder.query({
      query: (id) => `/admin/staff/${id}`,
      transformResponse: unwrap,
      providesTags: (r, e, id) => [{ type: 'Staff', id }],
    }),
    createStaff: builder.mutation({
      // body: { role, name, email, phone?, title?, subjects? }
      // Response: { staff, password } — password shown once.
      query: (body) => ({ url: '/admin/staff', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Staff', 'Stats', 'Analytics'],
    }),
    updateStaff: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/staff/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Staff', 'Analytics'],
    }),
    suspendStaff: builder.mutation({
      query: ({ id, suspend }) => ({
        url: `/admin/staff/${id}/suspend`,
        method: 'PATCH',
        body: { suspend },
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Staff'],
    }),
    resetStaffPassword: builder.mutation({
      query: ({ id, password }) => ({
        url: `/admin/staff/${id}/reset-password`,
        method: 'POST',
        body: password ? { password } : {},
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Staff'],
    }),
    deleteStaff: builder.mutation({
      query: (id) => ({ url: `/admin/staff/${id}`, method: 'DELETE' }),
      transformResponse: unwrap,
      invalidatesTags: ['Staff', 'Classrooms', 'Stats', 'Analytics'],
    }),

    /* ====================================================================
     * CLASSROOMS — the faculty <-> student link.
     * ================================================================== */
    getClassrooms: builder.query({
      query: (params = {}) => ({ url: '/admin/classrooms', params }),
      transformResponse: unwrap,
      providesTags: ['Classrooms'],
    }),
    getClassroom: builder.query({
      query: (id) => `/admin/classrooms/${id}`,
      transformResponse: unwrap,
      providesTags: (r, e, id) => [{ type: 'Classrooms', id }],
    }),
    createClassroom: builder.mutation({
      query: (body) => ({ url: '/admin/classrooms', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Classrooms', 'Analytics'],
    }),
    updateClassroom: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/classrooms/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Classrooms', 'Analytics'],
    }),
    updateClassroomRoster: builder.mutation({
      // body: { add: [studentId], remove: [studentId] }
      query: ({ id, ...body }) => ({
        url: `/admin/classrooms/${id}/roster`,
        method: 'POST',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Classrooms', 'Students', 'Analytics'],
    }),
    updateClassroomFaculty: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/classrooms/${id}/faculty`,
        method: 'POST',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Classrooms', 'Staff'],
    }),
    archiveClassroom: builder.mutation({
      query: ({ id, archive }) => ({
        url: `/admin/classrooms/${id}/archive`,
        method: 'PATCH',
        body: { archive },
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Classrooms', 'Analytics'],
    }),

    /* ---- Audit trail (admins only) ---- */
    getAuditLog: builder.query({
      query: (params = {}) => ({ url: '/admin/audit', params }),
      transformResponse: unwrap,
      providesTags: ['Audit'],
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
      // body: { firstName, lastName, password, email?, phone?, username? }
      // email + username are optional — the server auto-generates a unique
      // username when it is omitted. Response: { student: { ..., username }, password }
      query: (body) => ({ url: '/admin/students', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Students', 'Stats'],
    }),
    updateStudent: builder.mutation({
      // arg: { id, ...partial } — any of { firstName, lastName, grade, school,
      // phone, username, email }. Response: { data: <safe student> }.
      query: ({ id, ...body }) => ({
        url: `/admin/students/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: unwrap,
      // 'Students' (no id) refreshes the roster list; the per-id tag refreshes
      // an open detail modal (getStudentDetail providesTags [{ type, id }]).
      invalidatesTags: (res, err, { id }) => ['Students', { type: 'Students', id }],
    }),
    deleteStudent: builder.mutation({
      query: (id) => ({ url: `/admin/students/${id}`, method: 'DELETE' }),
      transformResponse: unwrap,
      invalidatesTags: (res, err, id) => ['Students', 'Stats', { type: 'Students', id }],
    }),
    resetStudentPassword: builder.mutation({
      // body: { password? } — omit password to let the server generate one.
      // Response: { student: { id, name, username, email }, password }
      query: ({ id, password }) => ({
        url: `/admin/students/${id}/reset-password`,
        method: 'POST',
        body: password ? { password } : {},
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Students'],
    }),
    // Full per-student progress/detail (org admin scope).
    // -> { student, stats, gameProgress, achievements }
    getStudentDetail: builder.query({
      query: (id) => `/admin/students/${id}`,
      transformResponse: unwrap,
      providesTags: (res, err, id) => [{ type: 'Students', id }],
    }),

    // ---- Worlds ----
    getWorlds: builder.query({
      query: () => '/admin/worlds',
      transformResponse: unwrap,
      providesTags: (res) => {
        const list = Array.isArray(res) ? res : res?.worlds || [];
        return [
          { type: 'Worlds', id: 'LIST' },
          ...list.map((w) => ({ type: 'Worlds', id: w._id || w.id })),
        ];
      },
    }),
    // Single world (for an edit form that needs the freshest copy).
    getWorld: builder.query({
      query: (id) => `/admin/worlds/${id}`,
      transformResponse: unwrap,
      providesTags: (res, err, id) => [{ type: 'Worlds', id }],
    }),
    createWorld: builder.mutation({
      query: (body) => ({ url: '/admin/worlds', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: 'Worlds', id: 'LIST' }],
    }),
    updateWorld: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/worlds/${id}`,
        method: 'PUT',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: (res, err, { id }) => [
        { type: 'Worlds', id: 'LIST' },
        { type: 'Worlds', id },
      ],
    }),
    deleteWorld: builder.mutation({
      query: (id) => ({ url: `/admin/worlds/${id}`, method: 'DELETE' }),
      transformResponse: unwrap,
      invalidatesTags: (res, err, id) => [
        { type: 'Worlds', id: 'LIST' },
        { type: 'Worlds', id },
      ],
    }),

    // Full lesson docs (incl. structured `body`) for a world. This reads the
    // PUBLIC route (`/worlds/:id/lessons`), not an `/admin` one — there is no
    // admin lesson list endpoint. Scoped by worldId via the 'Lessons' LIST tag
    // so any lesson mutation refreshes the open world's lesson list.
    getWorldLessons: builder.query({
      query: (worldId) => `/worlds/${worldId}/lessons`,
      transformResponse: unwrap,
      providesTags: (res) => {
        const list = Array.isArray(res) ? res : res?.lessons || [];
        return [
          { type: 'Lessons', id: 'LIST' },
          ...list.map((l) => ({ type: 'Lessons', id: l._id || l.id })),
        ];
      },
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
    // The whole arg is forwarded as the body so callers can send the full
    // lesson payload — `world` (REQUIRED on create), `body` (structured
    // content), `content`, `order`, `language`, `starterCode`, `xpReward` — as
    // well as the legacy `courseId` the Courses page still passes (the backend
    // strips fields it doesn't accept). Mutations invalidate the 'Lessons' LIST
    // tag so an open world's lesson list refetches.
    createLesson: builder.mutation({
      query: (body) => ({ url: `/admin/lessons`, method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Courses', { type: 'Lessons', id: 'LIST' }],
    }),
    updateLesson: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/lessons/${id}`,
        method: 'PUT',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: (res, err, { id }) => [
        'Courses',
        { type: 'Lessons', id: 'LIST' },
        { type: 'Lessons', id },
      ],
    }),
    deleteLesson: builder.mutation({
      query: (id) => ({ url: `/admin/lessons/${id}`, method: 'DELETE' }),
      transformResponse: unwrap,
      invalidatesTags: (res, err, id) => [
        'Courses',
        { type: 'Lessons', id: 'LIST' },
        { type: 'Lessons', id },
      ],
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
      providesTags: (res) => {
        const list = Array.isArray(res) ? res : res?.quizzes || [];
        return [
          { type: 'Quizzes', id: 'LIST' },
          ...list.map((q) => ({ type: 'Quizzes', id: q.id })),
        ];
      },
    }),
    // Single quiz WITH question answers, for the editor.
    getQuiz: builder.query({
      query: (id) => `/admin/quizzes/${id}`,
      transformResponse: unwrap,
      providesTags: (res, err, id) => [{ type: 'Quizzes', id }],
    }),
    createQuiz: builder.mutation({
      query: (body) => ({ url: '/admin/quizzes', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: 'Quizzes', id: 'LIST' }],
    }),
    updateQuiz: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/quizzes/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: (res, err, { id }) => [
        { type: 'Quizzes', id: 'LIST' },
        { type: 'Quizzes', id },
      ],
    }),
    deleteQuiz: builder.mutation({
      query: (id) => ({ url: `/admin/quizzes/${id}`, method: 'DELETE' }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: 'Quizzes', id: 'LIST' }],
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

/**
 * Download the class report CSV.
 *
 * The server has exposed `GET /admin/reports/class/export` — permission-gated
 * and scoped to the caller's own pupils — since the reporting work landed, but
 * nothing in this app ever called it. Staff could read results on screen and
 * had no way to take them into a meeting, a spreadsheet or a parents' evening,
 * which is most of what a report is for.
 *
 * Scope is deliberately NOT sent from here. A teacher's export must cover
 * their classes and an administrator's the whole school, and that decision
 * belongs to the server, which already makes it for the on-screen table.
 */
export async function exportClassReportCsv(grade) {
  const token = getAccessToken();
  const qs = grade ? `?grade=${encodeURIComponent(grade)}` : '';
  const res = await fetch(`${API_URL}/admin/reports/class/export${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Export failed');
  }
  const blob = await res.blob();
  downloadBlob(blob, `class_report_${new Date().toISOString().slice(0, 10)}.csv`);
}

export const {
  useGetSystemHealthQuery,
  useGetClassroomAssignmentsQuery,
  useCreateAssignmentMutation,
  useUpdateAssignmentMutation,
  useArchiveAssignmentMutation,
  // Marking queue + teaching insights.
  useGetReviewQueueQuery,
  useMarkTestAnswerMutation,
  useGetHardestQuestionsQuery,
  useGetHardestQuizzesQuery,
  useGetStallPointsQuery,
  useGetTestResultsQuery,
  useGetStatsQuery,
  useGetOrgAnalyticsQuery,
  useGetClassroomAnalyticsQuery,
  useGetClassReportQuery,
  useGetQuizReportQuery,
  useGetStaffQuery,
  useGetStaffMemberQuery,
  useCreateStaffMutation,
  useUpdateStaffMutation,
  useSuspendStaffMutation,
  useResetStaffPasswordMutation,
  useDeleteStaffMutation,
  useGetClassroomsQuery,
  useGetClassroomQuery,
  useCreateClassroomMutation,
  useUpdateClassroomMutation,
  useUpdateClassroomRosterMutation,
  useUpdateClassroomFacultyMutation,
  useArchiveClassroomMutation,
  useGetAuditLogQuery,
  useGetStudentsQuery,
  useSuspendStudentMutation,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useResetStudentPasswordMutation,
  useGetStudentDetailQuery,
  useGetWorldsQuery,
  useGetWorldQuery,
  useCreateWorldMutation,
  useUpdateWorldMutation,
  useDeleteWorldMutation,
  useGetWorldLessonsQuery,
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
  useGetQuizQuery,
  useCreateQuizMutation,
  useUpdateQuizMutation,
  useDeleteQuizMutation,
} = adminApi;
