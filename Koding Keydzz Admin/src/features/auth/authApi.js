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

    /**
     * Revoke this device's session on the SERVER. Signing out used to clear
     * only localStorage, leaving the refresh token usable for days.
     */
    logout: builder.mutation({
      query: (refreshToken) => ({
        url: '/auth/logout',
        method: 'POST',
        body: { refreshToken },
      }),
      transformResponse: (res) => res?.data || res,
    }),
    /**
     * Change your own password.
     *
     * Returns a FRESH token pair, because the server revokes every session on
     * a change — including the one that made this call. The caller must put the
     * new pair into the store or the very next request 401s.
     */
    changePassword: builder.mutation({
      query: (body) => ({
        url: '/auth/change-password',
        method: 'POST',
        body,
      }),
      transformResponse: (res) => res?.data || res,
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation, useChangePasswordMutation } = authApi;
