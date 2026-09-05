import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  api,
  BASE,
  auth,
  login,
  makeOrg,
  resetDb,
  connectTestDb,
  disconnectTestDb,
  PASSWORD,
} from './harness.js';
import { User } from '../../src/models/User.js';

/**
 * RAISING THE BCRYPT COST, WITHOUT ASKING ANYONE TO CHANGE THEIR PASSWORD.
 *
 * The cost factor went from 10 to 12. Each step doubles the work an offline
 * attacker has to do per guess against a stolen hash dump, and costs one
 * sign-in roughly 300ms more — which nobody notices, because it happens once
 * per session rather than once per request.
 *
 * THE PART THAT IS EASY TO GET WRONG
 * ----------------------------------
 * Raising the number protects nobody who already has an account. A bcrypt hash
 * carries its own cost, so every existing password stays at 10 for ever unless
 * something rewrites it — and "ask the whole school to change their password"
 * is not a plan anybody carries out.
 *
 * The only moment the plaintext exists to rehash with is a successful login, so
 * that is where the upgrade happens. These tests assert it happens, that it
 * cannot break a login, and that it never fires on a failed attempt.
 */
describe('password hash upgrade on login', () => {
  let org;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  /**
   * The suite as a whole runs at the floor (cost 10) for speed — see
   * tests/setup.js. This file is the exception, because the cost IS what it
   * tests: it must run at the production value or every assertion below is
   * about the wrong number.
   */
  let previousCost;

  beforeEach(async () => {
    previousCost = process.env.BCRYPT_COST;
    process.env.BCRYPT_COST = '12';
    await resetDb();
    org = await makeOrg('Hash Upgrade School');
  });

  afterEach(() => {
    if (previousCost === undefined) delete process.env.BCRYPT_COST;
    else process.env.BCRYPT_COST = previousCost;
  });

  /** The cost recorded inside a stored bcrypt digest. */
  const costOf = async (userId) => {
    const user = await User.findById(userId).select('+passwordHash').lean();
    const match = /^\$2[aby]?\$(\d{2})\$/.exec(user.passwordHash);
    return match ? Number(match[1]) : null;
  };

  /** Plant a deliberately weak (cost-10) hash, as a legacy account would have. */
  const plantWeakHash = async (userId, plain) => {
    const weak = await bcrypt.hash(plain, 10);
    await User.updateOne({ _id: userId }, { $set: { passwordHash: weak } });
    return weak;
  };

  it('writes NEW passwords at the raised cost', async () => {
    expect(await costOf(org.admin._id)).toBe(12);
  });

  it('UPGRADES a legacy cost-10 hash on a successful sign-in', async () => {
    // The whole point: an existing account is protected without anyone doing
    // anything, on their next sign-in.
    const weak = await plantWeakHash(org.admin._id, PASSWORD);
    expect(await costOf(org.admin._id)).toBe(10);

    const res = await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: org.admin.email, password: PASSWORD });
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    expect(await costOf(org.admin._id)).toBe(12);

    const after = await User.findById(org.admin._id).select('+passwordHash').lean();
    expect(after.passwordHash).not.toBe(weak);
  });

  it('the SAME password still works after the upgrade', async () => {
    /**
     * The failure that would be catastrophic and silent: rehashing with the
     * wrong plaintext would lock the user out of an account whose password
     * they typed correctly a moment ago.
     */
    await plantWeakHash(org.admin._id, PASSWORD);
    await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: org.admin.email, password: PASSWORD });

    const again = await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: org.admin.email, password: PASSWORD });
    expect(again.status).toBe(200);
  });

  it('does NOT touch the hash on a failed attempt', async () => {
    // Rehashing on failure would be both pointless and a way to rewrite a hash
    // using an attacker's guess.
    const weak = await plantWeakHash(org.admin._id, PASSWORD);

    const res = await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: org.admin.email, password: 'definitely-wrong' });
    expect(res.status).toBe(401);

    const after = await User.findById(org.admin._id).select('+passwordHash').lean();
    expect(after.passwordHash).toBe(weak);
  });

  it('leaves an already-strong hash alone', async () => {
    // No pointless write on every login for the majority of accounts.
    const before = await User.findById(org.admin._id).select('+passwordHash').lean();

    await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: org.admin.email, password: PASSWORD });

    const after = await User.findById(org.admin._id).select('+passwordHash').lean();
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('detects an unrecognised hash format as needing a rewrite', async () => {
    // A hash from some other scheme entirely (an old import, a manual edit)
    // must be treated as weak rather than trusted because it did not parse.
    const user = await User.findById(org.admin._id).select('+passwordHash');
    user.passwordHash = 'not-a-bcrypt-hash';
    expect(user.needsRehash()).toBe(true);
  });

  it('refuses to be configured BELOW the floor', async () => {
    /**
     * The variable exists so the cost can be RAISED later, or lowered inside a
     * test suite that hashes thousands of fixtures. It does not exist so a
     * deployment can quietly weaken every password in the database, so a value
     * under 10 is clamped rather than honoured.
     */
    const { bcryptCost } = await import('../../src/models/User.js');
    const original = process.env.BCRYPT_COST;
    try {
      process.env.BCRYPT_COST = '4';
      expect(bcryptCost()).toBe(10);
      process.env.BCRYPT_COST = '14';
      expect(bcryptCost()).toBe(14);
      process.env.BCRYPT_COST = 'nonsense';
      expect(bcryptCost()).toBe(12);
    } finally {
      if (original === undefined) delete process.env.BCRYPT_COST;
      else process.env.BCRYPT_COST = original;
    }
  });

  it('a change-password write uses the raised cost too', async () => {
    // Not just login: every path that sets a password must go through the
    // same helper, or one of them silently keeps writing weak hashes.
    await plantWeakHash(org.admin._id, PASSWORD);
    const token = (await login(org.admin.email)).accessToken;

    await api()
      .post(`${BASE}/auth/change-password`)
      .set(auth(token))
      .send({ currentPassword: PASSWORD, newPassword: 'Brand@NewOne1' });

    expect(await costOf(org.admin._id)).toBe(12);
  });
});
