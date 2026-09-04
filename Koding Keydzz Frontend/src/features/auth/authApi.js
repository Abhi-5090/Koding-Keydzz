import { baseApi, unwrap } from '../../app/api/baseApi'
import { setCredentials } from './authSlice'

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      transformResponse: unwrap,
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(
            setCredentials({
              user: data.user,
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
            })
          )
        } catch {
          // handled by component
        }
      },
      invalidatesTags: ['Auth'],
    }),

    registerStudent: builder.mutation({
      query: (payload) => ({
        url: '/auth/register/student',
        method: 'POST',
        body: payload,
      }),
      transformResponse: unwrap,
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (data?.accessToken) {
            dispatch(
              setCredentials({
                user: data.user,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
              })
            )
          }
        } catch {
          // handled by component
        }
      },
      invalidatesTags: ['Auth'],
    }),

    getMe: builder.query({
      query: () => '/auth/me',
      transformResponse: unwrap,
      providesTags: ['Auth'],
    }),

    /**
     * Revoke this device's session on the SERVER.
     *
     * Signing out previously only cleared localStorage, so the refresh token
     * stayed valid for its full 7-day lifetime — which matters on the shared
     * classroom machines this app runs on. Sending the refresh token revokes
     * just this device and leaves the student's other devices signed in.
     */
    logout: builder.mutation({
      query: (refreshToken) => ({
        url: '/auth/logout',
        method: 'POST',
        body: { refreshToken },
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Auth'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useLoginMutation,
  useRegisterStudentMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
  useLogoutMutation,
} = authApi
