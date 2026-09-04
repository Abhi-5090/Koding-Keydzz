import { useSelector, useDispatch } from 'react-redux'
import { useCallback } from 'react'
import {
  selectCurrentUser,
  selectAccessToken,
  selectIsAuthenticated,
  logout as logoutAction,
} from '../features/auth/authSlice'
import { useLogoutMutation } from '../features/auth/authApi'

export function useAuth() {
  const dispatch = useDispatch()
  const user = useSelector(selectCurrentUser)
  const token = useSelector(selectAccessToken)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const refreshToken = useSelector((state) => state.auth?.refreshToken)
  const [revokeSession] = useLogoutMutation()

  /**
   * Sign out. Revokes the session on the server FIRST so the refresh token
   * can't be reused from a shared classroom machine, then clears local state.
   * The local clear happens even if the network call fails — the user must
   * always end up signed out on this device.
   */
  const logout = useCallback(async () => {
    try {
      if (refreshToken) await revokeSession(refreshToken).unwrap()
    } catch {
      // Offline or already-expired session: still sign out locally.
    }
    dispatch(logoutAction())
  }, [dispatch, refreshToken, revokeSession])

  return { user, token, isAuthenticated, logout }
}
