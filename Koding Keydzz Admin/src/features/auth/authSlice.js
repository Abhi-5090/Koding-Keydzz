import { createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'kk_admin_auth';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persist(state) {
  try {
    if (state.accessToken) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
        })
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

const saved = loadState();

const initialState = {
  user: saved?.user || null,
  accessToken: saved?.accessToken || null,
  refreshToken: saved?.refreshToken || null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action) {
      const { user, accessToken, refreshToken } = action.payload;
      state.user = user;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken ?? state.refreshToken;
      persist(state);
    },
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      persist(state);
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;

export const selectAuth = (s) => s.auth;

/**
 * Roles that belong in the staff portal.
 *
 * `faculty` was missing here, which meant a signed-in teacher was treated as
 * unauthenticated by every route guard and bounced back to /login in a loop —
 * the same oversight as the login gate. Keep this list and Login.jsx's
 * PORTAL_ROLES in step.
 */
export const PORTAL_ROLES = ['superadmin', 'admin', 'faculty'];

// Authenticated when a token exists AND the user has a known portal role.
export const selectIsAuthed = (s) =>
  Boolean(s.auth.accessToken) && PORTAL_ROLES.includes(s.auth.user?.role);

export const selectRole = (s) => s.auth.user?.role || null;

/**
 * Capabilities the signed-in user holds, as reported by the server
 * (src/config/permissions.js). Used to decide which navigation and actions to
 * render, so a teacher never sees a link that would only 403.
 *
 * This is a UI hint ONLY — every route is still enforced server-side.
 */
export const selectCapabilities = (s) => s.auth.user?.capabilities || [];

/** Does the signed-in user hold this capability? */
export const selectCan = (capability) => (s) =>
  (s.auth.user?.capabilities || []).includes(capability);

/** Classes a faculty member is assigned to (empty for other roles). */
export const selectMyClassrooms = (s) => s.auth.user?.classrooms || [];
export const selectOrg = (s) => s.auth.user?.org || null;

/**
 * Is this account required to change its password before it can do anything?
 *
 * The server enforces this in `protect` — a flagged account gets 403 with
 * `details.code === 'PASSWORD_CHANGE_REQUIRED'` on every route except the four
 * it needs to fix itself. This selector exists so the client redirects on its
 * own rather than letting the user walk into a wall of 403s.
 */
export const selectMustChangePassword = (s) =>
  Boolean(s.auth.user?.mustChangePassword);

export const selectAdminName = (s) =>
  s.auth.user?.name || s.auth.user?.fullName || s.auth.user?.email || 'Admin';

export default authSlice.reducer;
