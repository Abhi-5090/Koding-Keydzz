import { describe, it, expect, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { baseApi } from './baseApi'
import { resetCacheOnIdentityChange } from './resetCacheOnIdentityChange'
import authReducer, { setCredentials, logout } from '../../features/auth/authSlice'
/**
 * Imported for its SIDE EFFECT. Endpoints are injected into `baseApi` when
 * their slice module is loaded, so without this `getDashboard` does not exist
 * and every selector below reads undefined — which would make the tests pass
 * for entirely the wrong reason.
 */
import '../../features/student/studentApi'

/**
 * ONE CHILD MUST NEVER SEE ANOTHER CHILD'S DASHBOARD.
 *
 * THE BUG
 * -------
 * Signing out cleared the auth state and left the RTK Query cache untouched.
 * None of the student endpoints take a user id — the server derives the pupil
 * from the bearer token — so every user shares the same cache key, and the next
 * child to sign in on that machine was served the previous child's cached
 * dashboard. A brand-new account opened on somebody else's level and coins,
 * and two pupils in one class appeared to have identical accounts.
 *
 * On a shared classroom machine, which is what this product runs on, that is
 * indistinguishable from a data leak to the person looking at the screen.
 *
 * The tests below drive the real store with the real middleware and inspect
 * the api slice's cache directly, because the whole failure was invisible at
 * the component level: the component asked for the dashboard and was handed
 * one.
 */

const ALICE = { id: 'user-alice', name: 'Alice', role: 'student' }
const BOB = { id: 'user-bob', name: 'Bob', role: 'student' }

function makeStore() {
  return configureStore({
    reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (g) => g().concat(baseApi.middleware, resetCacheOnIdentityChange)
  })
}

/**
 * Plant a cached response, exactly as a completed fetch would.
 *
 * AWAITED, because `upsertQueryData` is an async thunk. A synchronous dispatch
 * returns before the cache entry exists — which made the sign-out test pass
 * while proving nothing at all, since it asserts the entry is ABSENT and the
 * entry had never been written.
 */
async function seedCache(store, value) {
  await store.dispatch(
    baseApi.util.upsertQueryData('getDashboard', undefined, value)
  )
}

const cachedDashboard = (store) =>
  baseApi.endpoints.getDashboard.select(undefined)(store.getState())?.data

describe('clearing the cache when the person changes', () => {
  let store

  beforeEach(() => {
    store = makeStore()
  })

  it('DROPS the cache when a different user signs in', async () => {
    // The exact reported symptom: a new account showing another pupil's level
    // and coins.
    store.dispatch(setCredentials({ user: ALICE, accessToken: 'a', refreshToken: 'ra' }))
    await seedCache(store, { xp: 4200, coins: 850, level: 8 })
    expect(cachedDashboard(store)?.level).toBe(8)

    store.dispatch(setCredentials({ user: BOB, accessToken: 'b', refreshToken: 'rb' }))

    expect(
      cachedDashboard(store),
      "Bob was served Alice's dashboard"
    ).toBeUndefined()
  })

  it('DROPS the cache on sign-out', async () => {
    /**
     * Not deferred to the next sign-in. Waiting would leave one child's record
     * sitting in memory on the login screen — readable in devtools on a shared
     * machine, and visible for a frame to whoever signs in next.
     */
    store.dispatch(setCredentials({ user: ALICE, accessToken: 'a', refreshToken: 'ra' }))
    await seedCache(store, { xp: 4200, coins: 850, level: 8 })

    store.dispatch(logout())

    expect(cachedDashboard(store)).toBeUndefined()
  })

  it('KEEPS the cache through a silent token refresh', async () => {
    /**
     * The reason this is keyed on the user id rather than on `setCredentials`.
     * A refresh dispatches the same action with new tokens and NO user;
     * resetting there would discard the whole cache every fifteen minutes and
     * refetch the world map in the middle of a lesson.
     */
    store.dispatch(setCredentials({ user: ALICE, accessToken: 'a', refreshToken: 'ra' }))
    await seedCache(store, { xp: 4200, coins: 850, level: 8 })

    // Exactly what baseApi dispatches after a refresh: tokens only.
    store.dispatch(setCredentials({ accessToken: 'a2', refreshToken: 'ra2' }))

    expect(cachedDashboard(store)?.level, 'a token refresh threw the cache away').toBe(8)
  })

  it('KEEPS the cache when the SAME user signs in again', async () => {
    // Re-authenticating as yourself is not an identity change, and dropping
    // the cache would make a re-login feel like a cold start.
    store.dispatch(setCredentials({ user: ALICE, accessToken: 'a', refreshToken: 'ra' }))
    await seedCache(store, { xp: 4200, coins: 850, level: 8 })

    store.dispatch(setCredentials({ user: ALICE, accessToken: 'a3', refreshToken: 'ra3' }))

    expect(cachedDashboard(store)?.level).toBe(8)
  })

  it('handles signing in with no previous user', () => {
    // The first sign-in on a fresh browser: nothing to clear, nothing to break.
    expect(() =>
      store.dispatch(setCredentials({ user: ALICE, accessToken: 'a', refreshToken: 'ra' }))
    ).not.toThrow()
  })
})
