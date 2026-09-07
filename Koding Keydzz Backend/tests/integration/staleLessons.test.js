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
 * STALE LESSONS LEFT BY A RENAMED CURRICULUM, AND WHERE THEY GET REMOVED.
 *
 * Lessons are upserted on `{ world, title }`, so renaming one creates a second
 * document instead of updating the first. A database upgraded rather than
 * reset holds both sets, and the orphans are not inert: they keep their old
 * `order` values with older ObjectIds, so one of them wins the first slot in
 * the sequence — the only slot that starts unlocked — and the first topic a
 * child sees renders locked. They also inflate the world's lesson count past
 * what its cards can deliver, so the world can never complete.
 *
 * THE REMEDY IS THE SEED, NOT A READ-TIME FILTER.
 *
 * A read-time filter was tried and reverted. It tested a lesson's title
 * against its world's `topics`, which holds only in Python: C, HTML and AI
 * deliberately use short topic labels with descriptive lesson titles
 * ("Printing Output" vs "Printing with printf"), so the filter matched one
 * lesson of three and made the other two unreachable across fifteen worlds.
 *
 * The seed is the only place that knows which titles are authored for which
 * world, so that is where the prune belongs. These tests pin the shape of the
 * fault, that pruning fixes it, and that the ordering is deterministic even
 * when `order` values collide — which is what stops the fault being random.
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

  /** What the seed's prune step does: keep only the authored titles. */
  const pruneToAuthored = () =>
    Lesson.deleteMany({
      world: world._id,
      title: { $nin: ['Variables', 'Stored Values', 'Input', 'Output'] },
    });

  it('SHOWS THE FAULT: an orphan takes the first, unlocked slot', async () => {
    /**
     * Pinned so the shape of the problem stays on record. With both sets
     * present, the lesson a child sees called "Variables" is second in
     * sequence and therefore locked — with nothing that could open it.
     */
    const res = await lessonsFor();
    expect(res.status).toBe(200);

    const open = res.body.data.filter((l) => l.unlocked).map((l) => l.title);
    expect(open).toEqual(['Variables Basics']);

    const variables = res.body.data.find((l) => l.title === 'Variables');
    expect(variables.unlocked).toBe(false);
  });

  it('SHOWS THE FAULT: the orphans inflate the world past what its cards can deliver', async () => {
    // Four cards against seven lessons: finishing every card leaves 4 of 7,
    // so the world never completes and the next never unlocks.
    const worlds = await api().get(`${BASE}/worlds`).set(auth(pupilToken));
    const forest = worlds.body.data.find((w) => w.slug === 'coding-forest');
    expect(forest.lessonCount).toBe(7);
  });

  it('the sequence is DETERMINISTIC when order values collide', async () => {
    /**
     * The reason the fault presented as random. `order` defaults to 0 and the
     * orphans collide with the real lessons at 1, 2, 3 — so without a
     * tiebreak Mongo may return a different sequence per call, and a
     * different lesson would be the open one each time. `_id` breaks the tie,
     * which is also authoring order.
     */
    const first = (await lessonsFor()).body.data.map((l) => l.title);
    const second = (await lessonsFor()).body.data.map((l) => l.title);
    const third = (await lessonsFor()).body.data.map((l) => l.title);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
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
