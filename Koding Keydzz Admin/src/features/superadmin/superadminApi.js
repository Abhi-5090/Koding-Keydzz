import { baseApi } from '../../app/api/baseApi';

const unwrap = (res) => res?.data ?? res;

export const superadminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
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
    resetSuperStudentPassword: builder.mutation({
      query: ({ id, password }) => ({
        url: `/superadmin/students/${id}/reset-password`,
        method: 'POST',
        body: password ? { password } : {},
      }),
      transformResponse: unwrap,
      invalidatesTags: ['SuperStudents', 'OrgStudents'],
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
      // arg: { id, firstName, lastName, email, phone, password }
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
  useGetSuperStatsQuery,
  useGetSuperAnalyticsQuery,
  useGetSuperStudentsQuery,
  useSuspendSuperStudentMutation,
  useResetSuperStudentPasswordMutation,
  useGetOrgsQuery,
  useGetOrgQuery,
  useGetOrgStudentsQuery,
  useCreateOrgStudentMutation,
  useCreateOrgMutation,
  useUpdateOrgMutation,
  useUpdateOrgAdminMutation,
  useDeleteOrgMutation,
} = superadminApi;
