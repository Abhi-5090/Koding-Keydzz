import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { setCredentials, logout } from '../../features/auth/authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500/api/v1';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  // Resolve `fetch` lazily at call time so tests can swap the global mock
  // after this module has been imported.
  fetchFn: (...args) => globalThis.fetch(...args),
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

// Wrap to handle 401 -> attempt refresh once, otherwise logout.
const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const refreshToken = api.getState().auth.refreshToken;
    if (refreshToken) {
      const refreshResult = await rawBaseQuery(
        {
          url: '/auth/refresh',
          method: 'POST',
          body: { refreshToken },
        },
        api,
        extraOptions
      );

      const data = refreshResult.data?.data || refreshResult.data;
      if (data?.accessToken) {
        api.dispatch(
          setCredentials({
            user: api.getState().auth.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken || refreshToken,
          })
        );
        // retry original
        result = await rawBaseQuery(args, api, extraOptions);
      } else {
        api.dispatch(logout());
      }
    } else {
      api.dispatch(logout());
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Stats',
    // Who has been given which realm by hand.
    'Realms',
    'Students',
    'Worlds',
    'Courses',
    'Lessons',
    'Challenges',
    'Achievements',
    'ShopItems',
    'Leaderboard',
    'Quizzes',
    'Orgs',
    'OrgStudents',
    'SuperStats',
    'SuperStudents',
    'Analytics',
    // Tenancy model: organization staff (admins + faculty) and classrooms.
    'Staff',
    // Users belonging to no organization. Separate tag because assigning one
    // has to refresh this list AND every org-scoped roster at once.
    'Unassigned',
    // The final-test question bank, and the read-only results staff see.
    'Questions',
    'TestResults',
    'Classrooms',
    'Audit',
    'Reports',
    // Answers the machine could not mark, awaiting a human. Marking one
    // recomputes the attempt's score, so it invalidates TestResults too.
    'ReviewQueue',
    // Teaching insights: hardest questions, stalling quizzes, ladder stalls.
    'Insights',
    // Work set for a class. Invalidated by setting, editing or archiving —
    // completion itself is derived on the server from pupil progress, so it is
    // never patched locally.
    'Assignments',
  ],
  endpoints: () => ({}),
});
