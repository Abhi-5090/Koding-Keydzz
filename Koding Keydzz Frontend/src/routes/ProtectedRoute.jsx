import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  /**
   * A GUARDIAN IS NOT A LEARNER, so they never see the learner app.
   *
   * Parent accounts sign in here because this is the app a family already
   * knows, but they hold `child:read` and nothing else — every pupil route
   * would answer 403 for them. Diverting keeps them out of a wall of errors,
   * and it is a redirect rather than a hidden nav item because there is
   * genuinely nothing on those pages for them.
   *
   * The server is what enforces this; the redirect is a courtesy.
   */
  if (user?.role === 'guardian' && location.pathname !== '/family') {
    return <Navigate to="/family" replace />
  }

  return children
}
