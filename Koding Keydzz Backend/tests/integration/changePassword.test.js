import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  api,
  BASE,
  auth,
  login,
  makeOrg,
  makeUser,
  resetDb,
  connectTestDb,
  disconnectTestDb,
  PASSWORD,
} from './harness.js';
import { User } from '../../src/models/User.js';

/**
 * CHANGING YOUR OWN PASSWORD, AND THE FORCED CHANGE THAT NOW BITES.
 *
 * `mustChangePassword` was written by staff creation and by every staff
 * password reset, shown on the roster as a "pending invite" — and no endpoint
 * existed that could satisfy it. So a teacher was handed a temporary password
 * and could never change it, and the administrator who created the account
 * knew it for the life of the account.
 *
 * Two halves are asserted here, and the second is the one that makes the flag
 * mean anything:
 *
 *   1. an account can change its own password, safely — current password
 *      required, no silent no-op, other devices ended;
 *   2. an account that MUST change it can do nothing else until it has.
 */
describe('changing your own password', () => {
  let org;
  let adminToken;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    org = await makeOrg('Change Password School');
    adminToken = (await login(org.admin.email)).accessToken;
  });

  const NEW = 'Fresh@Passw0rd';

  /* ------------------------------------------------------------------ */
  /* The happy path                                                     */
  /* ------------------------------------------------------------------ */

  it('changes the password and lets the new one sign in', async () => {
    const res = await api()
      .post(`${BASE}/auth/change-password`)
      .set(auth(adminToken))
      .send({ currentPassword: PASSWORD, newPassword: NEW });

    expect(res.status, JSON.stringify(res.body)).toBe(200);

    // The OLD password must stop working...
    const stale = await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: org.admin.email, password: PASSWORD });
    expect(stale.status).toBe(401);

    // ...and the new one must work.
    const fresh = await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: org.admin.email, password: NEW });
    expect(fresh.status, JSON.stringify(fresh.body)).toBe(200);
  });

  it('returns a WORKING token pair, because the change killed the old one', async () => {
    /**
     * The change revokes every session. If it did not hand back a fresh pair
     * the caller would be signed out by the act of changing their password,
     * which is a rotten experience and would push clients into re-prompting
     * for the password they just set.
     */
    const res = await api()
      .post(`${BASE}/auth/change-password`)
      .set(auth(adminToken))
      .send({ currentPassword: PASSWORD, newPassword: NEW });

    const next = res.body.data.accessToken;
    expect(next).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();

    /**
     * Asserted by USING the pair, not by comparing it to the old one.
     *
     * `expect(next).not.toBe(adminToken)` looks like the obvious check and is
     * quietly racy: an access token is a JWT over {sub, iat, exp}, `iat` has
     * one-second resolution, and a change that lands in the same second as the
     * login produces a byte-identical string. It passed alone and failed in
     * the full suite, which is the signature of exactly this kind of
     * time-quantised assertion.
     *
     * What actually matters is that the caller is still working afterwards.
     */
    const me = await api().get(`${BASE}/auth/me`).set(auth(next));
    expect(me.status).toBe(200);

    // And the refresh token that came back is the live one.
    const rotated = await api()
      .post(`${BASE}/auth/refresh`)
      .send({ refreshToken: res.body.data.refreshToken });
    expect(rotated.status, JSON.stringify(rotated.body)).toBe(200);
  });

  it('ENDS every other session', async () => {
    // Two devices signed in on the same account.
    const deviceA = (await login(org.admin.email)).accessToken;
    const deviceB = await login(org.admin.email);

    await api()
      .post(`${BASE}/auth/change-password`)
      .set(auth(deviceA))
      .send({ currentPassword: PASSWORD, newPassword: NEW });

    // Device B's REFRESH must be dead — this is what "signed out everywhere"
    // means. (Its access token stays valid until it expires; that is the
    // nature of a stateless bearer token, and the short TTL is the mitigation.)
    const refreshed = await api()
      .post(`${BASE}/auth/refresh`)
      .send({ refreshToken: deviceB.refreshToken });
    expect(refreshed.status).toBe(401);
  });

  it('clears the forced-change flag', async () => {
    await User.updateOne({ _id: org.admin._id }, { $set: { mustChangePassword: true } });
    const token = (await login(org.admin.email)).accessToken;

    await api()
      .post(`${BASE}/auth/change-password`)
      .set(auth(token))
      .send({ currentPassword: PASSWORD, newPassword: NEW });

    const after = await User.findById(org.admin._id).lean();
    expect(after.mustChangePassword).toBe(false);
  });

  /* ------------------------------------------------------------------ */
  /* Refusals                                                           */
  /* ------------------------------------------------------------------ */

  it('REFUSES without the current password, so a stolen token is not enough', async () => {
    /**
     * The security property that matters. An access token alone must not be
     * escalatable into permanent account takeover — otherwise a leaked token
     * is worse than a leaked password, because the victim cannot see it.
     */
    const res = await api()
      .post(`${BASE}/auth/change-password`)
      .set(auth(adminToken))
      .send({ currentPassword: 'not-the-password', newPassword: NEW });

    expect(res.status).toBe(401);

    // And nothing changed.
    const still = await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: org.admin.email, password: PASSWORD });
    expect(still.status).toBe(200);
  });

  it('refuses to set the SAME password again', async () => {
    // Otherwise a flagged account could clear the flag while changing nothing,
    // which is precisely what the flag exists to prevent.
    const res = await api()
      .post(`${BASE}/auth/change-password`)
      .set(auth(adminToken))
      .send({ currentPassword: PASSWORD, newPassword: PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/different/i);
  });

  it('holds staff to the 8-character floor they were provisioned with', async () => {
    // Choosing your own password must not be a route to a weaker account than
    // the one the administrator created.
    const res = await api()
      .post(`${BASE}/auth/change-password`)
      .set(auth(adminToken))
      .send({ currentPassword: PASSWORD, newPassword: 'Sh0rt!' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 characters/i);
  });

  it('lets a pupil use the 6-character floor pupils are created with', async () => {
    const pupil = await makeUser({
      role: 'student',
      name: 'Small Person',
      username: 'smallperson',
      org: org.org._id,
    });
    const token = (await login(pupil.username)).accessToken;

    const res = await api()
      .post(`${BASE}/auth/change-password`)
      .set(auth(token))
      .send({ currentPassword: PASSWORD, newPassword: 'sixch1' });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
  });

  it('requires authentication at all', async () => {
    const res = await api()
      .post(`${BASE}/auth/change-password`)
      .send({ currentPassword: PASSWORD, newPassword: NEW });
    expect(res.status).toBe(401);
  });

  /* ------------------------------------------------------------------ */
  /* The forced change is actually enforced                             */
  /* ------------------------------------------------------------------ */

  describe('while a change is REQUIRED', () => {
    let flaggedToken;

    beforeEach(async () => {
      await User.updateOne({ _id: org.admin._id }, { $set: { mustChangePassword: true } });
      flaggedToken = (await login(org.admin.email)).accessToken;
    });

    it('still lets the account sign in — being locked out would be worse', async () => {
      const res = await api()
        .post(`${BASE}/auth/login`)
        .send({ identifier: org.admin.email, password: PASSWORD });
      expect(res.status).toBe(200);
      // ...and the client is told, so it can put up the change screen.
      expect(res.body.data.user.mustChangePassword).toBe(true);
    });

    it('BLOCKS every other endpoint with a code the client can key on', async () => {
      const res = await api().get(`${BASE}/admin/students`).set(auth(flaggedToken));
      expect(res.status).toBe(403);
      expect(res.body.details?.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('blocks writes as well as reads', async () => {
      const res = await api()
        .post(`${BASE}/admin/students`)
        .set(auth(flaggedToken))
        .send({ name: 'Should Not Exist', username: 'shouldnotexist' });
      expect(res.status).toBe(403);
      expect(res.body.details?.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('allows exactly the four things the account needs to fix itself', async () => {
      // /auth/me — so the client knows who it is and why it is blocked.
      expect((await api().get(`${BASE}/auth/me`).set(auth(flaggedToken))).status).toBe(200);

      // /auth/change-password — the way out.
      const changed = await api()
        .post(`${BASE}/auth/change-password`)
        .set(auth(flaggedToken))
        .send({ currentPassword: PASSWORD, newPassword: NEW });
      expect(changed.status, JSON.stringify(changed.body)).toBe(200);

      // And once changed, the rest of the API opens up on the new token.
      const students = await api()
        .get(`${BASE}/admin/students`)
        .set(auth(changed.body.data.accessToken));
      expect(students.status).toBe(200);
    });

    it('lets a blocked account log OUT rather than trapping it', async () => {
      const res = await api().post(`${BASE}/auth/logout`).set(auth(flaggedToken)).send({});
      expect(res.status).toBe(200);
    });

    it('does not exempt a path that merely CONTAINS an allowed one', async () => {
      /**
       * The allowlist is anchored to the end of the path. An unanchored match
       * would have let anything under a crafted URL through, which is the
       * classic way an allowlist like this leaks.
       */
      const res = await api()
        .get(`${BASE}/admin/students?x=/auth/me`)
        .set(auth(flaggedToken));
      expect(res.status).toBe(403);
    });
  });

  /* ------------------------------------------------------------------ */
  /* The flow this was built for                                        */
  /* ------------------------------------------------------------------ */

  it('completes the real teacher-onboarding path end to end', async () => {
    /**
     * The journey the audit found broken: an administrator creates a teacher,
     * the teacher signs in with the temporary password, is forced to change
     * it, and only then has their account. Before the change endpoint existed
     * the last two steps were impossible.
     */
    const created = await api()
      .post(`${BASE}/admin/staff`)
      .set(auth(adminToken))
      .send({
        role: 'faculty',
        name: 'Newly Hired',
        email: 'newly.hired@school.test',
        password: 'Temp@12345',
      });
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    // Flagged on creation.
    const signIn = await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: 'newly.hired@school.test', password: 'Temp@12345' });
    expect(signIn.status).toBe(200);
    expect(signIn.body.data.user.mustChangePassword).toBe(true);

    const teacherToken = signIn.body.data.accessToken;

    // Blocked from the product until they change it.
    expect((await api().get(`${BASE}/admin/classrooms`).set(auth(teacherToken))).status).toBe(
      403
    );

    // Change it...
    const change = await api()
      .post(`${BASE}/auth/change-password`)
      .set(auth(teacherToken))
      .send({ currentPassword: 'Temp@12345', newPassword: 'MyOwn@Passw0rd' });
    expect(change.status, JSON.stringify(change.body)).toBe(200);
    expect(change.body.data.user.mustChangePassword).toBe(false);

    // ...and the account works.
    const classrooms = await api()
      .get(`${BASE}/admin/classrooms`)
      .set(auth(change.body.data.accessToken));
    expect(classrooms.status).toBe(200);

    // The administrator's temporary password is now worthless.
    const oldPw = await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: 'newly.hired@school.test', password: 'Temp@12345' });
    expect(oldPw.status).toBe(401);
  });
});
