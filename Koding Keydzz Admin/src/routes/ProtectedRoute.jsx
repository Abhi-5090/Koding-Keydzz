import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import {
  selectIsAuthed,
  selectRole,
  selectCapabilities,
  selectMustChangePassword,
} from '../features/auth/authSlice';

/** Where each role lands when it has no business on the requested route. */
function homeFor(role) {
  if (role === 'superadmin') return '/superadmin';
  return '/dashboard';
}

/**
 * Guards routes by authentication and by CAPABILITY.
 *
 * Prefer `capability` over `roles`: it stays correct when a role is added.
 * Introducing the faculty role needed no change to any route that used a
 * capability, whereas every `roles={['admin']}` had to be revisited.
 *
 * This is a UI convenience only — the API enforces the same capability on
 * every request, so a hand-typed URL cannot bypass anything.
 *
 * @param {string}   [capability] required capability, e.g. 'staff:read'
 * @param {string[]} [roles]      legacy role allow-list
 */
export default function ProtectedRoute({ children, roles, capability }) {
  const isAuthed = useSelector(selectIsAuthed);
  const role = useSelector(selectRole);
  const capabilities = useSelector(selectCapabilities);
  const mustChangePassword = useSelector(selectMustChangePassword);
  const location = useLocation();

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  /**
   * A pending forced password change outranks every other check.
   *
   * The server refuses this account on all but four routes, so without this
   * the user would land on a page that renders nothing but 403s and be unable
   * to work out why. Diverting here means the only screen they can reach is
   * the one that fixes it.
   */
  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  if (capability && !capabilities.includes(capability)) {
    return <Navigate to={homeFor(role)} replace />;
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to={homeFor(role)} replace />;
  }

  return children;
}
