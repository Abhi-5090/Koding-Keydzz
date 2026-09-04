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

/**
 * SESSION LIFECYCLE.
 *
 * Three separate defects are pinned down here:
 *
 *   1. ONE session per account. A single `refreshTokenHash` field meant
 *      signing in on a classroom PC silently signed you out on the tablet.
 *
 *   2. Refresh tokens were never rotated, so a captured token stayed valid for
 *      its full 7-day life.
 *
 *   3. Refresh-token hashes used bcrypt, which TRUNCATES at 72 bytes. Every
 *      JWT for a given user shares its first 72 bytes, so all of that user's
 *      refresh tokens hashed identically — revocation and rotation silently
 *      did nothing. Hashing is SHA-256 now.
 */
describe('session lifecycle', () => {
  let org;
  let adminToken;

  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    await resetDb();
    const made = await makeOrg('Session School');
    org = made.org;
    await makeUser({
      role: 'student',
      name: 'Multi Device',
      username: 'multi',
      org: org._id,
    });
    adminToken = (await login(made.admin.email)).accessToken;
  });

  const refresh = (refreshToken) =>
    api().post(`${BASE}/auth/refresh`).send({ refreshToken });

  it('issues a DIFFERENT refresh token for two logins in the same second', async () => {
    // Without a unique `jti`, `iat` has one-second resolution and the two
    // tokens came out byte-identical — which made per-device sessions
    // indistinguishable.
    const [a, b] = await Promise.all([login('multi'), login('multi')]);
    expect(a.refreshToken).not.toBe(b.refreshToken);
  });

  it('keeps both devices signed in', async () => {
    const deviceA = await login('multi');
    const deviceB = await login('multi');

    const rA = await refresh(deviceA.refreshToken);
    expect(rA.status).toBe(200);

    const rB = await refresh(deviceB.refreshToken);
    expect(rB.status).toBe(200);
  });

  it('rotates the refresh token and rejects the consumed one', async () => {
    const device = await login('multi');

    const first = await refresh(device.refreshToken);
    expect(first.status).toBe(200);
    expect(first.body.data.refreshToken).toBeTruthy();
    expect(first.body.data.refreshToken).not.toBe(device.refreshToken);

    // Replaying the old token must fail.
    const replay = await refresh(device.refreshToken);
    expect(replay.status).toBe(401);

    // The rotated token works.
    const second = await refresh(first.body.data.refreshToken);
    expect(second.status).toBe(200);
  });

  it('re-signs the access token with the full claim set including org', async () => {
    const device = await login('multi');
    const res = await refresh(device.refreshToken);

    const claims = JSON.parse(
      Buffer.from(res.body.data.accessToken.split('.')[1], 'base64url').toString()
    );
    // `org` used to be dropped on refresh, which also broke org-scoped socket
    // matchmaking once that started reading the claim.
    expect(claims.org).toBe(String(org._id));
    expect(claims.role).toBe('student');
  });

  it('signs out only the current device by default', async () => {
    const deviceA = await login('multi');
    const deviceB = await login('multi');

    const out = await api()
      .post(`${BASE}/auth/logout`)
      .set(auth(deviceA.accessToken))
      .send({ refreshToken: deviceA.refreshToken });
    expect(out.status).toBe(200);

    expect((await refresh(deviceA.refreshToken)).status).toBe(401);
    // The other device is untouched.
    expect((await refresh(deviceB.refreshToken)).status).toBe(200);
  });

  it('signs out everywhere when asked', async () => {
    const deviceA = await login('multi');
    const deviceB = await login('multi');

    await api()
      .post(`${BASE}/auth/logout`)
      .set(auth(deviceA.accessToken))
      .send({ allDevices: true });

    expect((await refresh(deviceA.refreshToken)).status).toBe(401);
    expect((await refresh(deviceB.refreshToken)).status).toBe(401);
  });

  it('revokes every device when a teacher resets the password', async () => {
    const deviceA = await login('multi');
    const deviceB = await login('multi');

    const list = await api().get(`${BASE}/admin/students?limit=5`).set(auth(adminToken));
    const id = list.body.data.items[0]._id;

    const reset = await api()
      .post(`${BASE}/admin/students/${id}/reset-password`)
      .set(auth(adminToken))
      .send({});
    expect(reset.status).toBe(200);

    expect((await refresh(deviceA.refreshToken)).status).toBe(401);
    expect((await refresh(deviceB.refreshToken)).status).toBe(401);

    // The new password works, the old one does not.
    const newPw = reset.body.data.password;
    const ok = await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: 'multi', password: newPw });
    expect(ok.status).toBe(200);

    const old = await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: 'multi', password: PASSWORD });
    expect(old.status).toBe(401);
  });

  it('caps the number of concurrent devices', async () => {
    // MAX_SESSIONS is 5; the 6th login evicts the least-recently-used.
    const devices = [];
    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      devices.push(await login('multi'));
    }
    // The oldest session has been evicted.
    expect((await refresh(devices[0].refreshToken)).status).toBe(401);
    // The newest still works.
    expect((await refresh(devices[5].refreshToken)).status).toBe(200);
  });

  it('locks an account after repeated wrong passwords', async () => {
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await api()
        .post(`${BASE}/auth/login`)
        .send({ identifier: 'multi', password: 'wrong-password' });
    }
    // Even the CORRECT password is refused while locked.
    const res = await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: 'multi', password: PASSWORD });
    expect(res.status).toBe(423);
    expect(res.body.message).toMatch(/locked/i);
  });
});
