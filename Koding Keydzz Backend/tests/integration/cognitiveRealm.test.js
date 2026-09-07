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
import { Course } from '../../src/models/Course.js';
import { World } from '../../src/models/World.js';
import { Lesson } from '../../src/models/Lesson.js';
import { User } from '../../src/models/User.js';
import { COGNITIVE_GAME_KEYS } from '../../src/config/courses.js';

/**
 * THE COGNITIVE GAMES REALM — the first rung, and how Python opens after it.
 *
 * The realm holds no worlds, no lessons and no final test: its content is four
 * mini-games that already existed, and it is passed by finishing the first
 * level of each. That makes it the first thing on the ladder that breaks every
 * assumption the ladder was built on, so these tests pin the two ways it could
 * go badly wrong:
 *
 *   1. A realm with no content reads as 0-of-0 to the readiness check, and
 *      `complete: done >= total` reads 0 >= 0 as finished. All strands
 *      complete means `finalTestUnlocked` — so an unguarded games realm would
 *      offer a paper it has none of, to a pupil on their first day.
 *
 *   2. Its `completedAt` is never written, because that happens when a final
 *      test is passed. Left to the normal rule the realm would never be
 *      passed, and it sits at order 1 — so it would block the entire ladder
 *      for every pupil, for ever.
 *
 * And the teacher's override, which is the one place on the platform where a
 * lock is stored rather than derived.
 */
describe('the cognitive games realm', () => {
  let org;
  let pupil;
  let pupilToken;
  let adminToken;
  let cognitive;
  let python;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    org = await makeOrg('Cognitive School');

    // The realm, and Python behind it. Seeded descending, as the real seed
    // does, so the unique `order` index cannot collide.
    python = await Course.create({
      slug: 'python',
      language: 'python',
      order: 2,
      title: 'Python',
      kind: 'code',
      published: true,
    });
    cognitive = await Course.create({
      slug: 'cognitive-games',
      language: 'cognitive',
      order: 1,
      title: 'Cognitive Games',
      kind: 'games',
      published: true,
    });

    // Python needs a world with a lesson, or it is empty and its own
    // readiness would read as complete.
    const world = await World.create({
      name: 'Coding Forest',
      slug: 'coding-forest',
      order: 1,
      course: python._id,
      topics: ['Variables'],
      description: 'first',
    });
    await Lesson.create({ world: world._id, title: 'Variables', order: 1, xpReward: 100 });

    pupil = await makeUser({
      name: 'Cog Pupil',
      email: 'pupil@cognitive.test',
      role: 'student',
      org: org.org._id,
      // This suite IS the gate, so it needs a pupil who has played nothing.
      cognitiveDone: false,
    });
    pupilToken = (await login(pupil.email, PASSWORD)).accessToken;
    adminToken = (await login(org.admin.email)).accessToken;
  });

  const ladder = () => api().get(`${BASE}/courses`).set(auth(pupilToken));

  /** Record a completed level for a game, as finishing one really does. */
  const finishGame = (gameKey, levelId = '1') =>
    User.updateOne(
      { _id: pupil._id },
      { $push: { gameProgress: { gameKey, levelId, stars: 3 } } }
    );

  describe('the ladder', () => {
    it('puts the realm FIRST and opens it to a brand-new pupil', async () => {
      const res = await ladder();
      expect(res.status, JSON.stringify(res.body)).toBe(200);

      const [first] = res.body.data.items;
      expect(first.slug).toBe('cognitive-games');
      expect(first.order).toBe(1);
      expect(first.unlocked, 'the first rung of the ladder was locked').toBe(true);
    });

    it('locks Python until the realm is finished', async () => {
      const res = await ladder();
      const py = res.body.data.items.find((c) => c.slug === 'python');
      expect(py.unlocked).toBe(false);
      expect(py.lockedReason).toMatch(/Cognitive Games/i);
    });

    it('NEVER offers a final test for the realm', async () => {
      /**
       * The 0-of-0 trap. Every strand of a contentless course counts as
       * complete, which would unlock a paper that does not exist.
       */
      const res = await ladder();
      const first = res.body.data.items.find((c) => c.slug === 'cognitive-games');
      expect(first.readiness?.finalTestUnlocked, 'a games realm offered a final test').toBe(
        false
      );
    });

    it('measures the realm in GAMES, so the pupil has a progress bar', async () => {
      await finishGame(COGNITIVE_GAME_KEYS[0]);
      await finishGame(COGNITIVE_GAME_KEYS[1]);

      const res = await ladder();
      const first = res.body.data.items.find((c) => c.slug === 'cognitive-games');
      expect(first.readiness.gameLevels).toMatchObject({ done: 2, total: 4 });
      expect(first.readiness.percent).toBe(50);
    });
  });

  describe('passing it by playing', () => {
    it('three of four games is NOT enough', async () => {
      for (const key of COGNITIVE_GAME_KEYS.slice(0, 3)) await finishGame(key);

      const res = await ladder();
      const py = res.body.data.items.find((c) => c.slug === 'python');
      expect(py.unlocked, 'Python opened on three of four games').toBe(false);
    });

    it('the first level of all four opens Python', async () => {
      for (const key of COGNITIVE_GAME_KEYS) await finishGame(key);

      const res = await ladder();
      const items = res.body.data.items;
      expect(items.find((c) => c.slug === 'cognitive-games').status).toBe('completed');
      expect(
        items.find((c) => c.slug === 'python').unlocked,
        'finishing all four games did not open Python'
      ).toBe(true);
    });

    it('playing MORE levels of one game does not substitute for another', async () => {
      // The obvious way to get this wrong: count total levels instead of
      // asking whether each game has been played.
      await finishGame(COGNITIVE_GAME_KEYS[0], '1');
      await finishGame(COGNITIVE_GAME_KEYS[0], '2');
      await finishGame(COGNITIVE_GAME_KEYS[0], '3');
      await finishGame(COGNITIVE_GAME_KEYS[0], '4');

      const res = await ladder();
      expect(res.body.data.items.find((c) => c.slug === 'python').unlocked).toBe(false);
    });

    it('ignores games that are not part of the realm', async () => {
      await finishGame('sudoku');
      await finishGame('n-queens');
      await finishGame('zip');
      await finishGame('patches');

      const res = await ladder();
      const first = res.body.data.items.find((c) => c.slug === 'cognitive-games');
      expect(first.readiness.gameLevels.done).toBe(0);
    });
  });

  describe("a teacher opening Python by hand", () => {
    const grant = (token, slug = 'python') =>
      api().post(`${BASE}/admin/realms/${slug}/grant/${pupil._id}`).set(auth(token));
    const revoke = (token, slug = 'python') =>
      api().delete(`${BASE}/admin/realms/${slug}/grant/${pupil._id}`).set(auth(token));

    it('opens the realm for a pupil who has not earned it', async () => {
      const res = await grant(adminToken);
      expect(res.status, JSON.stringify(res.body)).toBe(200);

      const after = await ladder();
      const py = after.body.data.items.find((c) => c.slug === 'python');
      expect(py.unlocked, 'the grant did not open Python').toBe(true);
      // And the pupil is told it was a gift rather than something they earned.
      expect(py.grantedByStaff).toBe(true);
    });

    it('is idempotent, so a double click is harmless', async () => {
      await grant(adminToken);
      expect((await grant(adminToken)).status).toBe(200);

      const fresh = await User.findById(pupil._id).select('grantedCourses').lean();
      expect(fresh.grantedCourses).toHaveLength(1);
    });

    it('a revoke CANNOT close a realm the pupil has earned', async () => {
      /**
       * The asymmetry that makes this safe to hand to a staff room: the grant
       * only ever adds, so the worst a mistaken revoke can do is nothing.
       */
      for (const key of COGNITIVE_GAME_KEYS) await finishGame(key);
      await grant(adminToken);

      const res = await revoke(adminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.stillOpenOnMerit).toBe(true);

      const after = await ladder();
      expect(after.body.data.items.find((c) => c.slug === 'python').unlocked).toBe(true);
    });

    it('a revoke DOES close a realm that was only ever granted', async () => {
      await grant(adminToken);
      await revoke(adminToken);

      const after = await ladder();
      expect(after.body.data.items.find((c) => c.slug === 'python').unlocked).toBe(false);
    });

    it('reports who is ready, who was granted, and every pupil\'s games', async () => {
      await finishGame(COGNITIVE_GAME_KEYS[0]);
      const res = await api()
        .get(`${BASE}/admin/realms/python/roster`)
        .set(auth(adminToken));
      expect(res.status, JSON.stringify(res.body)).toBe(200);

      const row = res.body.data.items.find((i) => i.id === String(pupil._id));
      expect(row).toMatchObject({ gamesDone: 1, gamesTotal: 4, earned: false, granted: false });
      expect(row.games).toHaveLength(4);
      expect(res.body.data.readyCount).toBe(0);
    });

    it('refuses a pupil in another school', async () => {
      const other = await makeOrg('Other School');
      const outsider = await makeUser({
        name: 'Outsider',
        email: 'out@other.test',
        role: 'student',
        org: other.org._id,
      });
      const res = await api()
        .post(`${BASE}/admin/realms/python/grant/${outsider._id}`)
        .set(auth(adminToken));
      // 404, not 403 — the endpoint must not confirm the pupil exists.
      expect(res.status).toBe(404);
    });

    it('refuses a pupil to someone with no permission', async () => {
      const otherPupilToken = pupilToken;
      const res = await api()
        .post(`${BASE}/admin/realms/python/grant/${pupil._id}`)
        .set(auth(otherPupilToken));
      expect([401, 403]).toContain(res.status);
    });

    it('rejects a realm that does not exist, without a 500', async () => {
      const res = await api()
        .post(`${BASE}/admin/realms/not-a-realm/grant/${pupil._id}`)
        .set(auth(adminToken));
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/realm/i);
    });

    it('keeps the slug through validation', async () => {
      /**
       * `validate` assigns zod's parsed output back over `req.params`, and zod
       * strips unknown keys — so validating this route with an id-only schema
       * silently deleted `slug`, and the handler looked up a realm called
       * `undefined`. A 200 here is the proof the slug survived.
       */
      const res = await grant(adminToken, 'cognitive-games');
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.data.realm.slug).toBe('cognitive-games');
    });
  });
});
