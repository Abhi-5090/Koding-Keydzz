import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  api,
  BASE,
  auth,
  login,
  makeUser,
  resetDb,
  connectTestDb,
  disconnectTestDb,
  PASSWORD,
} from './harness.js';
import { generateOrgCode } from '../../src/utils/orgUtils.js';

/**
 * TWO SCHOOLS WHOSE NAMES START THE SAME MUST BOTH BE ABLE TO EXIST.
 *
 * An organization's short code is seeded from the first six alphanumerics of
 * its name. `generateOrgCode` pads with random characters only when the seed
 * is SHORTER than the code, so for any real school name it was completely
 * deterministic — and the collision retry re-called it with the same name,
 * got the same answer twelve times, and handed the duplicate to the database.
 *
 * The superadmin saw "Duplicate value for code" and had no way to act on it.
 * This is not a rare edge: school groups are named by branch, so
 *
 *   "Delhi Public School Rohini"  -> DELHIP
 *   "Delhi Public School Dwarka"  -> DELHIP
 *   "St Mary's Primary School"    -> STMARY
 *   "St Mary's Secondary School"  -> STMARY
 *
 * all collide. The second campus simply could not be onboarded.
 */
describe('organization code collisions', () => {
  let ownerToken;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    const owner = await makeUser({
      name: 'Platform Owner',
      email: 'owner@codes.test',
      role: 'superadmin',
      org: null,
    });
    ownerToken = (await login(owner.email, PASSWORD)).accessToken;
  });

  const createOrg = (name, adminEmail) =>
    api()
      .post(`${BASE}/superadmin/orgs`)
      .set(auth(ownerToken))
      .send({
        name,
        adminName: 'Head Teacher',
        adminEmail,
        adminPassword: 'Head@Teacher1',
      });

  it('creates BOTH schools when their names share a six-character prefix', async () => {
    const first = await createOrg('Delhi Public School Rohini', 'rohini@codes.test');
    expect(first.status, JSON.stringify(first.body)).toBe(201);

    const second = await createOrg('Delhi Public School Dwarka', 'dwarka@codes.test');
    expect(
      second.status,
      `the second campus was rejected: ${JSON.stringify(second.body)}`
    ).toBe(201);

    expect(second.body.data.org.code).not.toBe(first.body.data.org.code);
  });

  it('handles a whole group of same-prefix branches', async () => {
    // Four branches of one trust — every one of them seeds to STMARY.
    const names = [
      "St Mary's Primary School",
      "St Mary's Secondary School",
      "St Mary's Infant School",
      "St Mary's Sixth Form",
    ];
    const codes = [];
    for (let i = 0; i < names.length; i += 1) {
      const res = await createOrg(names[i], `stmary${i}@codes.test`);
      expect(res.status, `${names[i]} was rejected: ${JSON.stringify(res.body)}`).toBe(201);
      codes.push(res.body.data.org.code);
    }
    expect(new Set(codes).size, `codes were not unique: ${codes.join(', ')}`).toBe(names.length);
  });

  it('still refuses a genuinely duplicate NAME, with a readable message', async () => {
    // The prefix fix must not weaken the real uniqueness rule.
    await createOrg('Riverbank Academy', 'river1@codes.test');
    const again = await createOrg('Riverbank Academy', 'river2@codes.test');
    expect(again.status).toBe(409);
    expect(again.body.message).toMatch(/already exists/i);
    // And never a database error surfacing to the reader.
    expect(again.body.message).not.toMatch(/duplicate value|E11000/i);
  });

  it('never leaks a raw database duplicate-key message', async () => {
    await createOrg('Northgate College', 'north1@codes.test');
    const res = await createOrg('Northgate Community College', 'north2@codes.test');
    expect(res.status, JSON.stringify(res.body)).toBe(201);
  });

  describe('generateOrgCode', () => {
    it('is deterministic without randomChars — the property that caused the bug', () => {
      expect(generateOrgCode('Delhi Public School Rohini')).toBe(
        generateOrgCode('Delhi Public School Dwarka')
      );
    });

    it('explores different codes once randomChars is asked for', () => {
      const seen = new Set();
      for (let i = 0; i < 200; i += 1) {
        seen.add(generateOrgCode('Delhi Public School Dwarka', 6, { randomChars: 2 }));
      }
      // 36^2 = 1296 possibilities, so 200 draws must not collapse to a handful.
      expect(seen.size).toBeGreaterThan(100);
    });

    it('keeps the code exactly the requested length', () => {
      for (const n of ['A', 'Ab', 'Short', 'A Very Long School Name Indeed']) {
        expect(generateOrgCode(n, 6, { randomChars: 3 })).toHaveLength(6);
        expect(generateOrgCode(n)).toHaveLength(6);
      }
    });

    it('always keeps at least one seeded character, however greedy randomChars is', () => {
      // A code made entirely of noise would be unrecognisable to the school.
      const code = generateOrgCode('Zebra Academy', 6, { randomChars: 99 });
      expect(code).toHaveLength(6);
      expect(code[0]).toBe('Z');
    });
  });
});
