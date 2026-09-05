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

/**
 * FINISH THE PREVIOUS ONE — at every level of the ladder.
 *
 * The rule used to be stated three different ways: courses by final-test
 * passes, worlds by an XP `requiredLevel`, and lessons not at all. A pupil who
 * had ground XP out of mini-games could open the fourth world of a course
 * without writing a line in the first, and every topic inside a world opened
 * at once.
 *
 * These tests pin the single rule, and — the part that actually matters —
 * check it is enforced on the WRITE path, where a pupil with the address bar
 * is not bound by what the screen greys out.
 */
describe('lesson and world progression', () => {
  let org;
  let pupilToken;
  let course;
  let worlds;
  let lessons;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    org = await makeOrg('Ladder School');

    course = await Course.create({
      slug: 'python',
      title: 'Python',
      language: 'python',
      order: 1,
      published: true,
    });

    // Two worlds, three lessons each — enough to show both sequences.
    worlds = [];
    lessons = { first: [], second: [] };
    for (const [i, name] of ['Coding Forest', 'Loop Mountain'].entries()) {
      const world = await World.create({
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        order: i + 1,
        course: course._id,
        topics: ['One', 'Two', 'Three'],
        description: name,
      });
      worlds.push(world);
      const key = i === 0 ? 'first' : 'second';
      for (let j = 0; j < 3; j += 1) {
        lessons[key].push(
          await Lesson.create({
            world: world._id,
            title: `${name} lesson ${j + 1}`,
            order: j + 1,
            xpReward: 20,
          })
        );
      }
    }

    const pupil = await makeUser({
      name: 'Ladder Pupil',
      email: 'pupil@ladder.test',
      role: 'student',
      org: org.org._id,
    });
    pupilToken = (await login(pupil.email, PASSWORD)).accessToken;
  });

  const listWorlds = (slug) =>
    api()
      .get(`${BASE}/worlds${slug ? `?course=${slug}` : ''}`)
      .set(auth(pupilToken));

  const listLessons = (worldId) =>
    api().get(`${BASE}/worlds/${worldId}/lessons`).set(auth(pupilToken));

  const complete = (lessonId) =>
    api().post(`${BASE}/progress/lesson/${lessonId}/complete`).set(auth(pupilToken));

  describe('worlds', () => {
    it('opens the FIRST world and locks the rest', async () => {
      const res = await listWorlds();
      expect(res.status, JSON.stringify(res.body)).toBe(200);

      const [first, second] = res.body.data;
      expect(first.unlocked).toBe(true);
      expect(second.unlocked).toBe(false);
      expect(second.lockedReason).toMatch(/Coding Forest/);
    });

    it('unlocks the next world only when EVERY lesson of the previous one is done', async () => {
      // Two of three is not enough — a world half-read is not a world finished.
      await complete(lessons.first[0]._id);
      await complete(lessons.first[1]._id);

      let res = await listWorlds();
      expect(res.body.data[1].unlocked, 'two of three lessons opened the next world').toBe(false);
      expect(res.body.data[0].percent).toBe(67);

      await complete(lessons.first[2]._id);

      res = await listWorlds();
      expect(res.body.data[0].complete).toBe(true);
      expect(res.body.data[0].percent).toBe(100);
      expect(res.body.data[1].unlocked, 'finishing the world did not open the next').toBe(true);
      expect(res.body.data[1].lockedReason).toBeNull();
    });

    it('reports progress counts the map can render', async () => {
      await complete(lessons.first[0]._id);
      const res = await listWorlds();
      expect(res.body.data[0]).toMatchObject({
        lessonCount: 3,
        completedLessons: 1,
        complete: false,
      });
    });
  });

  describe('lessons within a world', () => {
    it('opens only the first topic, and names what blocks the rest', async () => {
      const res = await listLessons(worlds[0]._id);
      expect(res.status).toBe(200);

      const [one, two, three] = res.body.data;
      expect(one.unlocked).toBe(true);
      expect(two.unlocked).toBe(false);
      expect(two.lockedReason).toContain('Coding Forest lesson 1');
      expect(three.unlocked).toBe(false);
    });

    it('advances one topic at a time', async () => {
      await complete(lessons.first[0]._id);
      const res = await listLessons(worlds[0]._id);

      expect(res.body.data[0].completed).toBe(true);
      expect(res.body.data[1].unlocked, 'finishing topic 1 did not open topic 2').toBe(true);
      expect(res.body.data[2].unlocked, 'topic 3 opened too early').toBe(false);
    });
  });

  describe('the write path — where a lock has to actually hold', () => {
    it('REFUSES to complete a lesson whose predecessor is unfinished', async () => {
      /**
       * The heart of it. Greying the button out is a suggestion; the id is in
       * the page and this endpoint takes it in the URL.
       */
      const res = await complete(lessons.first[2]._id);
      expect(res.status, `skipping ahead was allowed: ${JSON.stringify(res.body)}`).toBe(403);
      expect(res.body.message).toMatch(/Finish "Coding Forest lesson 1"/);
    });

    it('REFUSES a lesson in a world that is still locked', async () => {
      const res = await complete(lessons.second[0]._id);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Coding Forest/);
    });

    it('cannot be walked around by completing a world back to front', async () => {
      // The exploit the derived-unlock design has to survive: post the last
      // lesson first, then fill in behind it, and the count reaches 3.
      expect((await complete(lessons.first[2]._id)).status).toBe(403);
      expect((await complete(lessons.first[1]._id)).status).toBe(403);
      expect((await complete(lessons.first[0]._id)).status).toBe(200);

      const res = await listWorlds();
      expect(res.body.data[1].unlocked).toBe(false);
    });

    it('allows the sequence in order, all the way through', async () => {
      for (const lesson of lessons.first) {
        const res = await complete(lesson._id);
        expect(res.status, `${lesson.title} was refused: ${JSON.stringify(res.body)}`).toBe(200);
      }
      expect((await complete(lessons.second[0]._id)).status).toBe(200);
    });

    it('lets a pupil re-open a lesson they have already finished', async () => {
      // Revisiting your own finished work must never be an error, and must not
      // pay out twice.
      await complete(lessons.first[0]._id);
      const again = await complete(lessons.first[0]._id);
      expect(again.status).toBe(200);
      expect(again.body.data.xpEarned).toBe(0);
    });
  });

  describe('a world with no lessons yet', () => {
    it('does not wall off everything behind it', async () => {
      /**
       * An authoring gap must not become a pupil's dead end: an empty world
       * counts as complete so the course stays walkable while content is
       * still being written.
       */
      const empty = await World.create({
        name: 'Empty Valley',
        slug: 'empty-valley',
        order: 0,
        course: course._id,
        topics: [],
        description: 'Not authored yet',
      });
      const res = await listWorlds();
      const names = res.body.data.map((w) => w.name);
      expect(names[0]).toBe('Empty Valley');
      expect(res.body.data[0].complete).toBe(true);
      expect(res.body.data[1].unlocked, 'an empty world blocked the course').toBe(true);
      expect(String(empty._id)).toBeTruthy();
    });
  });
});
