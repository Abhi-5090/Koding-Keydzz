import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { setCredentials, logout } from '../../features/auth/authSlice'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500/api/v1'

/**
 * Backend wraps every response in an envelope: { success, data, message }.
 * Use this as `transformResponse` so endpoints receive the real payload.
 */
export const unwrap = (response) =>
  response && typeof response === 'object' && 'data' in response
    ? response.data
    : response

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth?.accessToken
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
    headers.set('content-type', 'application/json')
    return headers
  },
})

// Wrap base query to handle 401 -> attempt refresh -> retry once.
const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions)

  if (result.error && result.error.status === 401) {
    const refreshToken = api.getState().auth?.refreshToken
    if (refreshToken) {
      const refreshResult = await rawBaseQuery(
        {
          url: '/auth/refresh',
          method: 'POST',
          body: { refreshToken },
        },
        api,
        extraOptions
      )

      if (refreshResult.data) {
        const data = unwrap(refreshResult.data)
        api.dispatch(
          setCredentials({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken ?? refreshToken,
          })
        )
        // retry original request with new token
        result = await rawBaseQuery(args, api, extraOptions)
      } else {
        api.dispatch(logout())
      }
    } else {
      api.dispatch(logout())
    }
  }

  return result
}

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Auth',
    'Dashboard',
    'Worlds',
    'Lessons',
    'Leaderboard',
    'Notifications',
    'Avatar',
    'Shop',
    'Quiz',
    'Achievements',
    // The course ladder. Tagged separately from 'Worlds' because finishing a
    // lesson changes readiness (how much of the course is left) without
    // changing the world list itself.
    'Courses',
    // The final test's eligibility (attempts left, readiness). Separate from
    // 'Courses' because submitting a paper changes both, but finishing a
    // lesson changes only the latter.
    'FinalTest',
  ],
  endpoints: () => ({}),
})
