import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { selectIsAuthed, selectRole } from '../features/auth/authSlice';

/**
 * Guards routes by authentication and (optionally) by role.
 *
 * @param {string[]} [roles] - allowed roles, e.g. ['superadmin']. When omitted,
 *   any authenticated portal user may pass.
 */
export default function ProtectedRoute({ children, roles }) {
  const isAuthed = useSelector(selectIsAuthed);
  const role = useSelector(selectRole);
  const location = useLocation();

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Role-gated: send the user to their own home rather than showing a 404.
  if (roles && !roles.includes(role)) {
    const home = role === 'superadmin' ? '/superadmin' : '/dashboard';
    return <Navigate to={home} replace />;
  }

  return children;
}
