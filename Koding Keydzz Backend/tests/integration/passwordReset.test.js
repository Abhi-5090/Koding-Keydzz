import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { api, BASE, makeOrg, makeUser, resetDb, connectTestDb, disconnectTestDb, PASSWORD } from './harness.js';
import { User } from '../../src/models/User.js';

/**
 * SELF-SERVICE PASSWORD RESET.
 *
 * Every reset used to be somebody else doing it for you, with a shell script at
 * the top of the chain for a locked-out superadmin.
 *
 * The properties asserted here are the ones that make a public, unauthenticated
 * reset endpoint safe to expose. Each has a specific attack behind it, named in
 * the test.
 */
describe('password reset', () => {
  let org;
  let staffEmail;

  beforeAll(async () => {
    await connectTestDb();
    // `log` sends nothing but behaves exactly as a real transport would, so the
    // flow under test is the production flow.
    process.env.MAIL_TRANSPORT = 'log';
    process.env.APP_URL = 'https://school.example';
  });

  afterAll(async () => {
    delete process.env.MAIL_TRANSPORT;
    delete process.env.APP_URL;
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    org = await makeOrg('Reset School');
    staffEmail = org.admin.email;
  });

  /** Pull the token straight from the database — the email is not inspectable. */
  const tokenFor = async (email) => {
    const before = await User.findOne({ email }).select('+passwordResetTokenHash').lean();
    return before?.passwordResetTokenHash || null;
  };

  const request = (email) =>
    api().post(`${BASE}/auth/password-reset/request`).send({ email });

  describe('asking for a link', () => {
    it('issues a token for a staff account', async () => {
      const res = await request(staffEmail);
      expect(res.status).toBe(200);
      expect(await tokenFor(staffEmail)).toBeTruthy();
    });

    it('STORES ONLY A HASH, never the token itself', async () => {
      // A reset token is a bearer credential for one account. A database dump
      // or a stray log must not contain usable ones.
      await request(staffEmail);
      const stored = await tokenFor(staffEmail);
      expect(stored).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex, not a base64url token
    });

    it('gives the SAME answer for an address that does not exist', async () => {
      /**
       * User enumeration. A form that says "no such account" is a free tool
       * for discovering which of a school's staff addresses are real, which is
       * the first step of a phishing campaign aimed at the people who can
       * reset children's passwords.
       */
      const real = await request(staffEmail);
      const fake = await request('nobody@nowhere.example');

      expect(fake.status).toBe(real.status);
      expect(fake.body.message).toBe(real.body.message);
    });

    it('gives the same answer for a PUPIL, and issues nothing', async () => {
      // Pupils mostly have no address, and a child's password is deliberately
      // something their teacher can reset.
      const pupil = await makeUser({
        role: 'student',
        name: 'Small Person',
        username: 'smallperson',
        email: 'pupil@school.test',
        org: org.org._id,
      });

      const res = await request(pupil.email);
      expect(res.status).toBe(200);
      expect(await tokenFor(pupil.email)).toBeNull();
    });

    it('gives the same answer for a SUSPENDED account, and issues nothing', async () => {
      await User.updateOne({ _id: org.admin._id }, { $set: { status: 'suspended' } });
      const res = await request(staffEmail);
      expect(res.status).toBe(200);
      expect(await tokenFor(staffEmail)).toBeNull();
    });

    it('does not resend within the cooldown, and does not say so', async () => {
      // Otherwise the endpoint is a way to send somebody hundreds of emails
      // knowing only their address. Silent, because "too soon" would confirm
      // the address exists.
      await request(staffEmail);
      const first = await tokenFor(staffEmail);

      const second = await request(staffEmail);
      expect(second.status).toBe(200);
      expect(await tokenFor(staffEmail)).toBe(first); // unchanged
    });

    it('rejects a malformed address before doing anything', async () => {
      const res = await request('not-an-email');
      expect(res.status).toBe(400);
    });
  });

  describe('using a link', () => {
    /** Request a reset and return the raw token by re-deriving it. */
    const freshToken = async () => {
      /**
       * The raw token is never persisted, so it cannot be read back. Instead a
       * known token is planted with the same hashing the service uses — this
       * tests the CONSUMPTION path, which is the half with the interesting
       * failures, without needing to intercept an email.
       */
      const { hashToken } = await import('../../src/utils/tokens.js');
      const raw = 'test-token-'.padEnd(48, 'x');
      await User.updateOne(
        { _id: org.admin._id },
        {
          $set: {
            passwordResetTokenHash: await hashToken(raw),
            passwordResetExpiresAt: new Date(Date.now() + 20 * 60_000),
            // Set because the real `request()` sets it, and the lookup bounds
            // its candidate scan by request age — a fixture that omits it is
            // testing a state the application never produces.
            passwordResetRequestedAt: new Date(),
            passwordResetUsedAt: null,
          },
        }
      );
      return raw;
    };

    const complete = (token, newPassword) =>
      api().post(`${BASE}/auth/password-reset/complete`).send({ token, newPassword });

    it('sets the new password and lets it sign in', async () => {
      const token = await freshToken();
      const res = await complete(token, 'BrandNew@2026');
      expect(res.status, JSON.stringify(res.body)).toBe(200);

      const signIn = await api()
        .post(`${BASE}/auth/login`)
        .send({ identifier: staffEmail, password: 'BrandNew@2026' });
      expect(signIn.status).toBe(200);

      // The old password is dead.
      const old = await api()
        .post(`${BASE}/auth/login`)
        .send({ identifier: staffEmail, password: PASSWORD });
      expect(old.status).toBe(401);
    });

    it('IS SINGLE USE, and says so on a replay', async () => {
      const token = await freshToken();
      expect((await complete(token, 'FirstUse@2026')).status).toBe(200);

      const replay = await complete(token, 'SecondUse@2026');
      expect(replay.status).toBe(400);
      // "Already used" rather than "invalid": the distinction is what stops
      // someone hunting for a fault that is not there.
      expect(replay.body.message).toMatch(/already been used/i);
    });

    it('refuses an EXPIRED link', async () => {
      const token = await freshToken();
      await User.updateOne(
        { _id: org.admin._id },
        { $set: { passwordResetExpiresAt: new Date(Date.now() - 1000) } }
      );

      const res = await complete(token, 'TooLate@2026');
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid or has expired/i);
    });

    it('refuses a token that was never issued', async () => {
      const res = await complete('made-up-token-'.padEnd(48, 'z'), 'Nope@20260');
      expect(res.status).toBe(400);
    });

    it('holds the 8-character staff floor', async () => {
      // A reset must not be a way to end up with a weaker account than the one
      // the administrator provisioned.
      const token = await freshToken();
      const res = await complete(token, 'Sh0rt!');
      expect(res.status).toBe(400);
    });

    it('ENDS every existing session', async () => {
      /**
       * Someone resetting a password usually believes it is compromised.
       * Leaving the attacker's session alive defeats the whole exercise.
       */
      const signIn = await api()
        .post(`${BASE}/auth/login`)
        .send({ identifier: staffEmail, password: PASSWORD });
      const staleRefresh = signIn.body.data.refreshToken;

      const token = await freshToken();
      await complete(token, 'AfterReset@2026');

      const refreshed = await api()
        .post(`${BASE}/auth/refresh`)
        .send({ refreshToken: staleRefresh });
      expect(refreshed.status).toBe(401);
    });

    it('clears a forced password change, because one was just made', async () => {
      await User.updateOne({ _id: org.admin._id }, { $set: { mustChangePassword: true } });
      const token = await freshToken();
      await complete(token, 'IChoseThis@2026');

      const after = await User.findById(org.admin._id).lean();
      expect(after.mustChangePassword).toBe(false);
    });

    it('clears a lockout, so a locked-out account can actually recover', async () => {
      // Otherwise the reset succeeds and the user still cannot sign in, which
      // is the one outcome this whole feature exists to avoid.
      await User.updateOne(
        { _id: org.admin._id },
        { $set: { failedLoginAttempts: 9, lockUntil: new Date(Date.now() + 3_600_000) } }
      );
      const token = await freshToken();
      await complete(token, 'Unlocked@2026');

      const signIn = await api()
        .post(`${BASE}/auth/login`)
        .send({ identifier: staffEmail, password: 'Unlocked@2026' });
      expect(signIn.status, JSON.stringify(signIn.body)).toBe(200);
    });
  });

  describe('inspecting a link before typing anything', () => {
    it('reports a good link as valid', async () => {
      const { hashToken } = await import('../../src/utils/tokens.js');
      const raw = 'inspect-me-'.padEnd(48, 'q');
      await User.updateOne(
        { _id: org.admin._id },
        {
          $set: {
            passwordResetTokenHash: await hashToken(raw),
            passwordResetExpiresAt: new Date(Date.now() + 10 * 60_000),
            passwordResetRequestedAt: new Date(),
            passwordResetUsedAt: null,
          },
        }
      );

      const res = await api()
        .get(`${BASE}/auth/password-reset/inspect`)
        .query({ token: raw });
      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
    });

    it('reports an unknown link as unusable without saying why it might exist', async () => {
      const res = await api()
        .get(`${BASE}/auth/password-reset/inspect`)
        .query({ token: 'nonsense-'.padEnd(48, 'k') });
      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
    });
  });
});
