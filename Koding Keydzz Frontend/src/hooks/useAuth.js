import { useSelector, useDispatch } from 'react-redux'
import { useCallback } from 'react'
import {
  selectCurrentUser,
  selectAccessToken,
  selectIsAuthenticated,
  logout as logoutAction,
} from '../features/auth/authSlice'

export function useAuth() {
  const dispatch = useDispatch()
  const user = useSelector(selectCurrentUser)
  const token = useSelector(selectAccessToken)
  const isAuthenticated = useSelector(selectIsAuthenticated)

  const logout = useCallback(() => dispatch(logoutAction()), [dispatch])

  return { user, token, isAuthenticated, logout }
}
