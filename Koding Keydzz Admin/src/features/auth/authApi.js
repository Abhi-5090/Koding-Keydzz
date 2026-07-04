import { baseApi } from '../../app/api/baseApi';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      transformResponse: (res) => res?.data || res,
    }),
  }),
});

export const { useLoginMutation } = authApi;
