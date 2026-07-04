import { createSlice } from '@reduxjs/toolkit'

const loadInitialState = () => {
  try {
    const accessToken = localStorage.getItem('kk_access_token') || null
    const refreshToken = localStorage.getItem('kk_refresh_token') || null
    const userRaw = localStorage.getItem('kk_user')
    const user = userRaw ? JSON.parse(userRaw) : null
    return { accessToken, refreshToken, user }
  } catch {
    return { accessToken: null, refreshToken: null, user: null }
  }
}

const initialState = loadInitialState()

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, accessToken, refreshToken } = action.payload
      if (accessToken !== undefined) {
        state.accessToken = accessToken
        if (accessToken) localStorage.setItem('kk_access_token', accessToken)
      }
      if (refreshToken !== undefined) {
        state.refreshToken = refreshToken
        if (refreshToken) localStorage.setItem('kk_refresh_token', refreshToken)
      }
      if (user !== undefined) {
        state.user = user
        if (user) localStorage.setItem('kk_user', JSON.stringify(user))
      }
    },
    setUser: (state, action) => {
      state.user = action.payload
      if (action.payload) localStorage.setItem('kk_user', JSON.stringify(action.payload))
    },
    logout: (state) => {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      localStorage.removeItem('kk_access_token')
      localStorage.removeItem('kk_refresh_token')
      localStorage.removeItem('kk_user')
    },
  },
})

export const { setCredentials, setUser, logout } = authSlice.actions
export default authSlice.reducer

export const selectCurrentUser = (state) => state.auth.user
export const selectAccessToken = (state) => state.auth.accessToken
export const selectIsAuthenticated = (state) => Boolean(state.auth.accessToken)
