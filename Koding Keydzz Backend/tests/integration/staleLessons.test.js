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
 * THE FIRST TOPIC IS ALWAYS OPEN — even on a database full of stale content.
 *
 * Lessons are upserted on `{ world, title }`, so renaming one creates a second
 * document instead of updating the first. An upgrade that renamed Coding
 * Forest's lessons left the world holding both sets, and the orphans kept
 * their old `order` values with older ObjectIds — so one of THEM won the first
 * slot in the sequence.
 *
 * The first slot is the only one that starts unlocked. So the lesson a child
 * actually sees first, on the first world of the first course, rendered as
 * locked with nothing that could ever open it, and the world's lesson count
 * was inflated past what its cards could deliver so it could never complete.
 *
 * Two independent defences, and this file exercises both:
 *
 *   1. The ladder now sequences and counts only the lessons a world's TOPICS
 *      name, so an orphan takes no part in it. This needs no re-seed, which
 *      matters because the databases with the problem are the ones already
 *      deployed.
 *   2. The seed prunes lessons the curriculum no longer contains, so the
 *      orphans stop accumulating in the first place.
 *
 * The fixture is deliberately the broken shape: orphans inserted first, with
 * colliding order values.
 */
describe('stale lessons left by a renamed curriculum', () => {
  let org;
  let pupilToken;
  let world;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    org = await makeOrg('Rename School');

    const course = await Course.create({
      slug: 'python',
      title: 'Python',
      language: 'python',
      order: 1,
      published: true,
    });

    world = await World.create({
      name: 'Coding Forest',
      slug: 'coding-forest',
      order: 1,
      course: course._id,
      // The topics a pupil sees on the cards — the NEW names.
      topics: ['Variables', 'Stored Values', 'Input', 'Output'],
      description: 'Coding Forest',
    });

    /**
     * The orphans come first, exactly as an upgraded database has them: older
     * ObjectIds, and `order` values that collide with the new lessons'.
     */
    for (const [i, title] of ['Variables Basics', 'Inputs Basics', 'Outputs Basics'].entries()) {
      await Lesson.create({ world: world._id, title, order: i + 1, xpReward: 100 });
    }
    for (const [i, title] of ['Variables', 'Stored Values', 'Input', 'Output'].entries()) {
      await Lesson.create({ world: world._id, title, order: i + 1, xpReward: 100 });
    }

    const pupil = await makeUser({
      name: 'Rename Pupil',
      email: 'pupil@rename.test',
      role: 'student',
      org: org.org._id,
    });
    pupilToken = (await login(pupil.email, PASSWORD)).accessToken;
  });

  const lessonsFor = () =>
    api().get(`${BASE}/worlds/${world._id}/lessons`).set(auth(pupilToken));

  it('"Variables" IS the open lesson even with the orphans still present', async () => {
    /**
     * THE HEART OF IT. This fixture is a database that was upgraded rather
     * than reset: three renamed-away lessons sitting alongside the four real
     * ones, with colliding `order` values and older ObjectIds.
     *
     * Before the curriculum filter, an orphan won the first slot — the only
     * one that starts unlocked — and the first card a child sees rendered
     * locked with nothing that could open it. The fix does not depend on
     * anyone re-seeding: a lesson no card points at takes no part in the
     * ladder, so the first topic is open on the data as it stands.
     */
    const res = await lessonsFor();
    expect(res.status).toBe(200);

    const titles = res.body.data.map((l) => l.title);
    expect(titles, 'orphaned lessons are still being served to the pupil').toEqual([
      'Variables',
      'Stored Values',
      'Input',
      'Output',
    ]);

    const open = res.body.data.filter((l) => l.unlocked).map((l) => l.title);
    expect(open, 'the first lesson is not the only open one').toEqual(['Variables']);
  });

  it('refuses an orphaned lesson on the write path too', async () => {
    // It is on no card, so nothing legitimate asks for it — and paying XP for
    // content the course no longer contains would inflate progress.
    const orphan = await Lesson.findOne({ world: world._id, title: 'Variables Basics' });
    const res = await api()
      .post(`${BASE}/progress/lesson/${orphan._id}/complete`)
      .set(auth(pupilToken));
    expect(res.status).toBe(404);
  });

  it('the world counts only the lessons it teaches, so it can reach 100%', async () => {
    /**
     * The second half of the same fault. Orphans inflated the lesson count, so
     * a world with four cards needed seven completions: finishing every card
     * left it at 4 of 7, the world never completed, and the next world could
     * never unlock.
     */
    const worlds = await api().get(`${BASE}/worlds`).set(auth(pupilToken));
    const forest = worlds.body.data.find((w) => w.slug === 'coding-forest');
    expect(forest.lessonCount, 'orphans are still being counted').toBe(4);
  });

  it('once the orphans are gone, "Variables" is the open lesson', async () => {
    // What the seed's prune step does.
    await Lesson.deleteMany({
      world: world._id,
      title: { $nin: ['Variables', 'Stored Values', 'Input', 'Output'] },
    });

    const res = await lessonsFor();
    const titles = res.body.data.map((l) => l.title);
    expect(titles).toEqual(['Variables', 'Stored Values', 'Input', 'Output']);

    const [first, second] = res.body.data;
    expect(first.title).toBe('Variables');
    expect(first.unlocked, 'the first lesson of the first world is still locked').toBe(true);
    expect(second.unlocked).toBe(false);
  });

  it('every card on the world page maps to a lesson', async () => {
    /**
     * The other half of the same mismatch: the cards are built from
     * `world.topics`, and a topic whose lesson has been renamed away matches
     * nothing. Such a card cannot be completed — it has no lesson to post — so
     * the world can never reach 100% and the next world never unlocks.
     */
    await Lesson.deleteMany({
      world: world._id,
      title: { $nin: ['Variables', 'Stored Values', 'Input', 'Output'] },
    });

    const res = await lessonsFor();
    const byTitle = new Set(res.body.data.map((l) => l.title.trim().toLowerCase()));
    const orphanTopics = (world.topics || []).filter(
      (t) => !byTitle.has(String(t).trim().toLowerCase())
    );
    expect(
      orphanTopics,
      `these topics have no lesson behind them: ${orphanTopics.join(', ')}`
    ).toEqual([]);
  });

  it('the whole world can be completed, so the next world can open', async () => {
    // The end-to-end consequence: with orphans gone, walking the sequence in
    // order finishes the world.
    await Lesson.deleteMany({
      world: world._id,
      title: { $nin: ['Variables', 'Stored Values', 'Input', 'Output'] },
    });

    const lessons = (await lessonsFor()).body.data;
    for (const lesson of lessons) {
      const res = await api()
        .post(`${BASE}/progress/lesson/${lesson.id}/complete`)
        .set(auth(pupilToken));
      expect(res.status, `${lesson.title} was refused: ${JSON.stringify(res.body)}`).toBe(200);
    }

    const worlds = await api().get(`${BASE}/worlds`).set(auth(pupilToken));
    const forest = worlds.body.data.find((w) => w.slug === 'coding-forest');
    expect(forest.complete).toBe(true);
    expect(forest.percent).toBe(100);
  });
});
