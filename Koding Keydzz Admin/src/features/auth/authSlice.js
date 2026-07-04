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

// Authenticated when a token exists AND the user has a known portal role.
export const selectIsAuthed = (s) =>
  Boolean(s.auth.accessToken) &&
  (s.auth.user?.role === 'admin' || s.auth.user?.role === 'superadmin');

export const selectRole = (s) => s.auth.user?.role || null;
export const selectOrg = (s) => s.auth.user?.org || null;

export const selectAdminName = (s) =>
  s.auth.user?.name || s.auth.user?.fullName || s.auth.user?.email || 'Admin';

export default authSlice.reducer;
