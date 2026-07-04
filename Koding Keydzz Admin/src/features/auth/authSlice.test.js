import { describe, it, expect, beforeEach } from 'vitest';
import reducer, {
  setCredentials,
  logout,
  selectIsAuthed,
  selectAdminName,
} from './authSlice';

const emptyState = {
  user: null,
  accessToken: null,
  refreshToken: null,
};

describe('authSlice reducer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the initial state by default', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toMatchObject({ accessToken: null, user: null });
  });

  it('stores credentials on setCredentials', () => {
    const next = reducer(
      emptyState,
      setCredentials({
        user: { id: '1', name: 'Asha', role: 'admin' },
        accessToken: 'tok',
        refreshToken: 'ref',
      })
    );
    expect(next.accessToken).toBe('tok');
    expect(next.refreshToken).toBe('ref');
    expect(next.user.name).toBe('Asha');
  });

  it('keeps existing refreshToken when not provided', () => {
    const seeded = { ...emptyState, refreshToken: 'old' };
    const next = reducer(
      seeded,
      setCredentials({ user: { role: 'admin' }, accessToken: 'new' })
    );
    expect(next.refreshToken).toBe('old');
  });

  it('clears everything on logout', () => {
    const seeded = {
      user: { role: 'admin' },
      accessToken: 'tok',
      refreshToken: 'ref',
    };
    const next = reducer(seeded, logout());
    expect(next).toEqual(emptyState);
  });

  it('selectIsAuthed is true only for an authed admin', () => {
    expect(selectIsAuthed({ auth: emptyState })).toBe(false);
    expect(
      selectIsAuthed({ auth: { accessToken: 't', user: { role: 'student' } } })
    ).toBe(false);
    expect(
      selectIsAuthed({ auth: { accessToken: 't', user: { role: 'admin' } } })
    ).toBe(true);
  });

  it('selectAdminName falls back gracefully', () => {
    expect(selectAdminName({ auth: emptyState })).toBe('Admin');
    expect(
      selectAdminName({ auth: { user: { email: 'a@b.com' } } })
    ).toBe('a@b.com');
    expect(
      selectAdminName({ auth: { user: { name: 'Neo' } } })
    ).toBe('Neo');
  });
});
