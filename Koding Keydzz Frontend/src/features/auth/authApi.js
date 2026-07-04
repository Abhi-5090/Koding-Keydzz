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
  }),
  overrideExisting: false,
})

export const {
  useLoginMutation,
  useRegisterStudentMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
} = authApi
