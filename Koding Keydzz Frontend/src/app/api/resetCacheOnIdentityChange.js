import { baseApi } from './baseApi'

/**
 * CLEAR THE API CACHE WHEN THE PERSON CHANGES.
 *
 * THE BUG THIS FIXES
 * ------------------
 * Signing out cleared the auth state and localStorage and left the RTK Query
 * cache completely untouched. Every response was still sitting in the Redux
 * store: the dashboard, the course ladder, the world map, the leaderboard.
 *
 * None of those endpoints take a user id — the server derives the pupil from
 * the bearer token — so every user shares the SAME cache key. The next child
 * to sign in on that machine was therefore served the previous child's cached
 * dashboard: their XP, their coins, their level, their progress. A brand-new
 * account would open on somebody else's level 8 and 850 coins.
 *
 * It is not a data leak on the server — the next fetch returns the correct
 * data and the cached copy never left the device — but on a SHARED CLASSROOM
 * MACHINE, which is what this product runs on, one child is shown another
 * child's record. That is indistinguishable from a leak to the person looking
 * at it, and it makes two pupils appear to have identical accounts.
 *
 * WHY A MIDDLEWARE
 * ----------------
 * The same reason the toast middleware is one: sign-in and sign-out happen on
 * several paths — the login form, a refresh failure inside `baseApi`, the
 * sign-out button — and a call added later would silently miss the reset. One
 * listener covers every path, including ones not written yet.
 *
 * WHY IT DOES NOT FIRE ON A TOKEN REFRESH
 * ---------------------------------------
 * `setCredentials` is dispatched in two very different situations:
 *
 *   • signing in           -> carries a `user`
 *   • silent token refresh -> carries only the new tokens
 *
 * Resetting on the second would throw away the whole cache every fifteen
 * minutes and refetch the world map mid-lesson. So the reset is keyed on the
 * USER ID actually changing, which is true on a switch of account and false on
 * a refresh, and also false when the same person signs in again.
 */
export const resetCacheOnIdentityChange = (store) => (next) => (action) => {
  const previousUserId = store.getState()?.auth?.user?.id ?? null

  // Let the auth reducer apply first, so the comparison is old vs new.
  const result = next(action)

  if (action.type === 'auth/logout') {
    /**
     * Reset on sign-out as well as sign-in.
     *
     * Waiting until the next sign-in would leave one child's data sitting in
     * memory on the login screen, recoverable by anyone who opens devtools on
     * a shared machine — and visible for a frame to the next user before their
     * own fetch lands.
     */
    store.dispatch(baseApi.util.resetApiState())
    return result
  }

  if (action.type === 'auth/setCredentials' || action.type === 'auth/setUser') {
    const nextUserId = store.getState()?.auth?.user?.id ?? null
    // Only an actual change of person. A token refresh carries no user, so
    // `nextUserId` is unchanged and nothing is thrown away.
    if (nextUserId && nextUserId !== previousUserId) {
      store.dispatch(baseApi.util.resetApiState())
    }
  }

  return result
}

export default resetCacheOnIdentityChange
