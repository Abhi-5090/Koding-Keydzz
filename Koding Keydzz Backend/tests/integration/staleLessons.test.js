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
 * A RENAMED CURRICULUM MUST NOT LEAVE THE FIRST LESSON LOCKED.
 *
 * Lessons are upserted on `{ world, title }`, so renaming one creates a second
 * document instead of updating the first. An upgrade that renamed Coding
 * Forest's lessons left the world holding both sets — and because the orphans
 * kept their old `order` values and had older ObjectIds, one of THEM took the
 * first slot in the sequence.
 *
 * The first slot is the only one that starts unlocked. So the lesson a child
 * actually sees first, on the first world of the first course, rendered as
 * locked with nothing that could open it. This is what that looks like, and
 * what the fix has to guarantee.
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

  it('REPRODUCES the fault: with orphans present, "Variables" is not the open lesson', async () => {
    /**
     * Pinned deliberately. This is the state the reported bug came from, and
     * if a future change makes it stop happening on its own, that is worth
     * knowing rather than silently relying on.
     */
    const res = await lessonsFor();
    expect(res.status).toBe(200);

    const open = res.body.data.filter((l) => l.unlocked).map((l) => l.title);
    expect(open).toEqual(['Variables Basics']);

    const variables = res.body.data.find((l) => l.title === 'Variables');
    expect(variables.unlocked, 'the fault did not reproduce').toBe(false);
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
