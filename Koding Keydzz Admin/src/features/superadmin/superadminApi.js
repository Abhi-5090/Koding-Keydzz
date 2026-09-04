import { baseApi } from '../../app/api/baseApi';

const unwrap = (res) => res?.data ?? res;

export const superadminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /* ====================================================================
     * PLATFORM ANALYTICS — the superadmin dashboard data source.
     * ================================================================== */
    getPlatformAnalytics: builder.query({
      // arg: { days } — reporting window, 7..365 (default 30)
      query: (params = {}) => ({ url: '/superadmin/analytics/platform', params }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: ['Analytics'],
    }),
    // Drill into ONE school with the same shape its own admin sees.
    getOrgAnalyticsForOrg: builder.query({
      query: ({ id, ...params }) => ({ url: `/superadmin/orgs/${id}/analytics`, params }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, arg) => [{ type: 'Analytics', id: arg?.id }],
    }),
    getPlatformAudit: builder.query({
      query: (params = {}) => ({ url: '/superadmin/audit', params }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: ['Audit'],
    }),

    /* ---- Per-organization staff, managed on a school's behalf ---- */
    getOrgStaff: builder.query({
      query: ({ id, ...params }) => ({ url: `/superadmin/orgs/${id}/staff`, params }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: ['Staff'],
    }),
    createOrgStaff: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/superadmin/orgs/${id}/staff`,
        method: 'POST',
        body,
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: ['Staff', 'Orgs', 'SuperStats'],
    }),
    deleteOrgStaff: builder.mutation({
      query: ({ id, staffId }) => ({
        url: `/superadmin/orgs/${id}/staff/${staffId}`,
        method: 'DELETE',
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: ['Staff', 'Orgs'],
    }),
    getOrgClassrooms: builder.query({
      query: ({ id, ...params }) => ({ url: `/superadmin/orgs/${id}/classrooms`, params }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: ['Classrooms'],
    }),
    broadcastPlatform: builder.mutation({
      query: (body) => ({
        url: '/superadmin/notifications/broadcast',
        method: 'POST',
        body,
      }),
      transformResponse: (res) => res?.data ?? res,
    }),

    // ---- Aggregate stats ----
    getSuperStats: builder.query({
      query: () => '/superadmin/stats',
      transformResponse: unwrap,
      providesTags: ['SuperStats'],
    }),

    // ---- Platform-wide analytics ----
    getSuperAnalytics: builder.query({
      query: () => '/superadmin/analytics',
      transformResponse: unwrap,
      providesTags: ['Analytics'],
    }),

    /* ---- The final-test question bank ----
     *
     * Superadmin-only. The bank holds the mark scheme for every final test, so
     * a school admin must never be able to read it — which is why these sit on
     * the superadmin surface rather than the shared content one.
     */
    getQuestions: builder.query({
      query: (params = {}) => ({ url: '/superadmin/questions', params }),
      transformResponse: unwrap,
      providesTags: ['Questions'],
    }),
    createQuestion: builder.mutation({
      query: (body) => ({ url: '/superadmin/questions', method: 'POST', body }),
      transformResponse: unwrap,
      // Coverage changes with every question, so both refresh together.
      invalidatesTags: ['Questions'],
    }),
    updateQuestion: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/superadmin/questions/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Questions'],
    }),
    /**
     * Retire rather than delete. Past attempts store the question ids they
     * drew, so removing one would leave a pupil unable to see the paper they
     * sat. A retired question stays in the bank and is never drawn again.
     */
    retireQuestion: builder.mutation({
      query: (id) => ({ url: `/superadmin/questions/${id}/retire`, method: 'POST' }),
      transformResponse: unwrap,
      invalidatesTags: ['Questions'],
    }),
    deleteQuestion: builder.mutation({
      query: (id) => ({ url: `/superadmin/questions/${id}`, method: 'DELETE' }),
      transformResponse: unwrap,
      invalidatesTags: ['Questions'],
    }),
    /**
     * Whether a course's bank can produce a test, and where it is short.
     *
     * This is the check that prevents the failure nobody sees until the worst
     * moment: a pupil who has finished an entire course pressing "Start test"
     * and being told the bank is too small.
     */
    getBankCoverage: builder.query({
      query: (slug) => `/superadmin/questions/coverage/${slug}`,
      transformResponse: unwrap,
      providesTags: ['Questions'],
    }),

    /* ---- Users with no organization ----
     *
     * Every user must belong to a school. `User.org` defaults to null and
     * public self-registration used to never set it, so accounts created that
     * way are owned by no school: invisible to every admin, on no classroom,
     * filtered out of every org-scoped query — and still able to sign in.
     * These two endpoints are how such an account is found and fixed.
     *
     * Covers EVERY role (admins and teachers too), not just students, which is
     * why it does not reuse the students list.
     */
    getUnassignedUsers: builder.query({
      query: (params = {}) => ({ url: '/superadmin/users/unassigned', params }),
      transformResponse: unwrap,
      providesTags: ['Unassigned'],
    }),
    assignUserOrganization: builder.mutation({
      // arg: { id, org } — `org` is an organization _id.
      query: ({ id, org }) => ({
        url: `/superadmin/users/${id}/organization`,
        method: 'PATCH',
        body: { org },
      }),
      transformResponse: unwrap,
      // Assigning re-homes the person, so every list that is scoped by org
      // changes at once: the orphan list, both student rosters, the staff
      // list, the org member counts, and the classroom rosters they were
      // pulled out of.
      invalidatesTags: [
        'Unassigned',
        'SuperStudents',
        'OrgStudents',
        'Students',
        'Staff',
        'Orgs',
        'Classrooms',
        'SuperStats',
      ],
    }),

    // ---- All students across orgs ----
    getSuperStudents: builder.query({
      query: (params = {}) => ({ url: '/superadmin/students', params }),
      transformResponse: unwrap,
      providesTags: ['SuperStudents'],
    }),
    suspendSuperStudent: builder.mutation({
      query: ({ id, suspended }) => ({
        url: `/superadmin/students/${id}/suspend`,
        method: 'PATCH',
        body: { suspended },
      }),
      transformResponse: unwrap,
      // 'OrgStudents' too: the per-org roster (OrgDetail) is tagged separately
      // and must refresh when a student is suspended/reinstated there.
      invalidatesTags: ['SuperStudents', 'OrgStudents'],
    }),
    updateSuperStudent: builder.mutation({
      // arg: { id, ...partial } — any of { firstName, lastName, grade, school,
      // phone, username, email }. Response: { data: <safe student> }.
      query: ({ id, ...body }) => ({
        url: `/superadmin/students/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: unwrap,
      // 'SuperStudents' + 'OrgStudents' refresh both roster surfaces; the per-id
      // tag refreshes an open detail modal (getSuperStudentDetail).
      invalidatesTags: (res, err, { id }) => [
        'SuperStudents',
        'OrgStudents',
        { type: 'SuperStudents', id },
      ],
    }),
    deleteSuperStudent: builder.mutation({
      query: (id) => ({ url: `/superadmin/students/${id}`, method: 'DELETE' }),
      transformResponse: unwrap,
      invalidatesTags: (res, err, id) => [
        'SuperStudents',
        'OrgStudents',
        'SuperStats',
        { type: 'SuperStudents', id },
      ],
    }),
    resetSuperStudentPassword: builder.mutation({
      query: ({ id, password }) => ({
        url: `/superadmin/students/${id}/reset-password`,
        method: 'POST',
        body: password ? { password } : {},
      }),
      transformResponse: unwrap,
      invalidatesTags: ['SuperStudents', 'OrgStudents'],
    }),
    // Full per-student progress/detail (platform / superadmin scope).
    // -> { student, stats, gameProgress, achievements }
    getSuperStudentDetail: builder.query({
      query: (id) => `/superadmin/students/${id}`,
      transformResponse: unwrap,
      providesTags: (res, err, id) => [{ type: 'SuperStudents', id }],
    }),

    // ---- Organizations ----
    getOrgs: builder.query({
      query: () => '/superadmin/orgs',
      transformResponse: unwrap,
      providesTags: ['Orgs'],
    }),
    getOrg: builder.query({
      query: (id) => `/superadmin/orgs/${id}`,
      transformResponse: unwrap,
      providesTags: (res, err, id) => [{ type: 'Orgs', id }],
    }),

    // ---- Students scoped to a single org ----
    getOrgStudents: builder.query({
      // arg: { id, search?, page?, limit? }
      query: ({ id, ...params }) => ({
        url: `/superadmin/orgs/${id}/students`,
        params,
      }),
      transformResponse: unwrap,
      providesTags: (res, err, { id }) => [{ type: 'OrgStudents', id }],
    }),
    createOrgStudent: builder.mutation({
      // arg: { id, firstName, lastName, password, email?, phone?, username? }
      // email + username optional; server auto-generates a unique username when blank.
      // Response: { student: { ..., username }, password }
      query: ({ id, ...body }) => ({
        url: `/superadmin/orgs/${id}/students`,
        method: 'POST',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: (res, err, { id }) => [
        { type: 'OrgStudents', id },
        { type: 'Orgs', id },
        'Orgs',
        'SuperStats',
      ],
    }),
    createOrg: builder.mutation({
      // body: { name, adminName, adminEmail, adminPassword }
      query: (body) => ({ url: '/superadmin/orgs', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Orgs', 'SuperStats'],
    }),
    updateOrg: builder.mutation({
      // body: { name?, status? }
      query: ({ id, ...body }) => ({
        url: `/superadmin/orgs/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Orgs', 'SuperStats'],
    }),
    updateOrgAdmin: builder.mutation({
      // body: { adminName?, adminEmail?, adminPassword? }
      query: ({ id, ...body }) => ({
        url: `/superadmin/orgs/${id}/admin`,
        method: 'PATCH',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Orgs'],
    }),
    deleteOrg: builder.mutation({
      query: (id) => ({ url: `/superadmin/orgs/${id}`, method: 'DELETE' }),
      transformResponse: unwrap,
      invalidatesTags: ['Orgs', 'SuperStats'],
    }),
  }),
});

export const {
  useGetPlatformAnalyticsQuery,
  useGetOrgAnalyticsForOrgQuery,
  useGetPlatformAuditQuery,
  useGetOrgStaffQuery,
  useCreateOrgStaffMutation,
  useDeleteOrgStaffMutation,
  useGetOrgClassroomsQuery,
  useBroadcastPlatformMutation,
  useGetSuperStatsQuery,
  useGetSuperAnalyticsQuery,
  useGetSuperStudentsQuery,
  useGetQuestionsQuery,
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
  useRetireQuestionMutation,
  useDeleteQuestionMutation,
  useGetBankCoverageQuery,
  useGetUnassignedUsersQuery,
  useAssignUserOrganizationMutation,
  useSuspendSuperStudentMutation,
  useUpdateSuperStudentMutation,
  useDeleteSuperStudentMutation,
  useResetSuperStudentPasswordMutation,
  useGetSuperStudentDetailQuery,
  useGetOrgsQuery,
  useGetOrgQuery,
  useGetOrgStudentsQuery,
  useCreateOrgStudentMutation,
  useCreateOrgMutation,
  useUpdateOrgMutation,
  useUpdateOrgAdminMutation,
  useDeleteOrgMutation,
} = superadminApi;
