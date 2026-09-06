import { Lesson } from '../models/Lesson.js';
import { worldRepository } from '../repositories/worldRepository.js';
import { lessonRepository } from '../repositories/lessonRepository.js';

/**
 * THE LADDER: which world, and which lesson inside it, a pupil may open.
 *
 * WHY THIS IS ONE FILE
 * --------------------
 * The rule "you may open this when you have finished the one before it"
 * appears at three levels — course, world, lesson — and it used to be
 * expressed differently at each. The course level lived in courseService and
 * was derived from final-test passes. The world level was a `requiredLevel`
 * number compared against the pupil's XP level. The lesson level did not exist
 * at all: every lesson in a world opened from the moment the world did.
 *
 * That is three answers to one question, and they disagreed. A pupil who had
 * ground XP out of mini-games could open Algorithm Desert without having
 * written a line in Coding Forest, because their level was high enough. The
 * map said "unlocks at level 5", which is not the rule anyone teaching this
 * course would state.
 *
 * The rule is now the same sentence everywhere: FINISH THE PREVIOUS ONE.
 *
 * WHY IT IS DERIVED AND NEVER STORED
 * ----------------------------------
 * Same reasoning as CourseProgress: a stored `unlocked` flag can drift out of
 * step with the completions it is meant to summarise, and then a child is
 * either stuck in front of work they have finished or holding a key to work
 * they have not started. Both are worse than a query. The only thing written
 * down is what the pupil actually did — `user.completedLessons`.
 *
 * WHY THE SERVER DECIDES
 * ----------------------
 * The UI greys out a locked world, but a greyed-out button is a suggestion.
 * Lesson ids are handed to the browser by the map, so a pupil who opens
 * devtools — or simply edits the address bar — can ask for any lesson in the
 * course. If the lock lives only in React it is decoration. Every read and
 * write path that can advance a pupil goes through the helpers here.
 */

/** Compare a topic label with a lesson title, ignoring case and padding. */
const normalise = (value) => String(value || '').trim().toLowerCase();

/**
 * THE LESSONS A WORLD ACTUALLY TEACHES, IN THE ORDER ITS CARDS SHOW THEM.
 *
 * WHY THIS FILTER EXISTS
 * ----------------------
 * A world's cards come from its `topics` array. Its lessons are separate
 * documents, upserted on `{ world, title }` — so renaming a lesson creates a
 * second one and leaves the original behind. A database that was upgraded
 * rather than reset holds both sets, and those orphans are invisible on screen
 * while still counting in every calculation:
 *
 *   • They took the FIRST slot in the sequence, which is the only one that
 *     starts unlocked. An orphan sat in it, so the first card a child sees —
 *     "Variables", the first lesson of the first world of the first course —
 *     rendered LOCKED with nothing that could open it.
 *
 *   • They inflated the lesson count. A world with four cards and three
 *     orphans needed seven completions to reach 100%, which four cards can
 *     never deliver, so the world could never be finished and the next world
 *     could never unlock.
 *
 * Filtering to the authored topics fixes both without anyone having to re-seed:
 * a lesson no card points at simply takes no part in the ladder.
 *
 * THE FALLBACK MATTERS
 * --------------------
 * If a world has no topics, or none of them match a lesson title, the filter
 * would empty the world — turning a content mismatch into a world with nothing
 * in it. So the filter only applies when it actually matches something, and
 * otherwise the full ordered list is used.
 */
export function curriculumLessons(world, lessons) {
  const topics = Array.isArray(world?.topics) ? world.topics : [];
  const byTopic = new Map(topics.map((topic, index) => [normalise(topic), index]));

  const matched = lessons.filter((lesson) => byTopic.has(normalise(lesson.title)));
  if (matched.length === 0) return lessons;

  /**
   * Ordered by the TOPICS array, because that is the order the cards are drawn
   * in. Sequencing by `lesson.order` while displaying by topic order lets the
   * two disagree, and then a locked card appears first and the open one
   * further down — which reads as the sequence being broken when it is only
   * being shown out of order.
   */
  return matched
    .slice()
    .sort(
      (a, b) =>
        byTopic.get(normalise(a.title)) - byTopic.get(normalise(b.title)) ||
        (a.order ?? 0) - (b.order ?? 0)
    );
}

/** A pupil's completed-lesson ids as a Set of strings. */
export function completedLessonIds(user) {
  return new Set((user?.completedLessons || []).map((entry) => String(entry.lesson)));
}

/**
 * Lesson counts per world for one course, in a single query.
 *
 * The obvious implementation asks for each world's lessons in a loop, which is
 * five round trips to render one map. This is one aggregate, and it matters
 * because the map is the screen a child lands on most.
 */
async function lessonsByWorld(worldIds) {
  /**
   * Titles come back as well as ids, because the count has to be of the
   * lessons the world actually TEACHES — see `curriculumLessons`. Counting
   * every Lesson document in the world lets orphaned content inflate the
   * total, and a world whose four cards are all finished then reports 4 of 7
   * and never completes.
   */
  const rows = await Lesson.aggregate([
    { $match: { world: { $in: worldIds } } },
    {
      $group: {
        _id: '$world',
        lessons: { $push: { _id: '$_id', title: '$title', order: '$order' } },
      },
    },
  ]);
  const byWorld = new Map();
  for (const row of rows) {
    byWorld.set(String(row._id), row.lessons);
  }
  return byWorld;
}

/**
 * Decorate a course's worlds with their progress and lock state.
 *
 * Returns plain objects rather than documents: the lock state is computed, not
 * stored, so handing back something that looks like a saveable document would
 * invite exactly the drift this module exists to avoid.
 */
export async function decorateWorlds(worlds, user) {
  const done = completedLessonIds(user);
  const allLessons = await lessonsByWorld(worlds.map((w) => w._id));

  // Worlds arrive ordered; the ladder depends on that order, so it is not
  // re-derived from anything else.
  let previousComplete = true; // the first world of a course is always open.
  let previousName = null;

  return worlds.map((world) => {
    const plain = typeof world.toObject === 'function' ? world.toObject() : { ...world };
    const taught = curriculumLessons(plain, allLessons.get(String(world._id)) || []);
    const entry = { total: taught.length, ids: taught.map((l) => String(l._id)) };
    const completedCount = entry.ids.filter((id) => done.has(id)).length;

    /**
     * A world with no lessons authored yet counts as complete.
     *
     * Otherwise an empty world part-way through a course would wall off
     * everything behind it, and the only way a pupil could tell would be a
     * permanently locked map. Content gaps are an authoring problem; they must
     * not become a pupil's dead end.
     */
    const complete = entry.total === 0 ? true : completedCount >= entry.total;
    const unlocked = previousComplete;

    const decorated = {
      ...plain,
      id: String(world._id),
      lessonCount: entry.total,
      completedLessons: completedCount,
      percent: entry.total === 0 ? 0 : Math.round((completedCount / entry.total) * 100),
      complete,
      unlocked,
      lockedReason: unlocked
        ? null
        : `Finish every lesson in ${previousName || 'the previous world'} to unlock this.`,
    };

    previousComplete = complete;
    previousName = world.name;
    return decorated;
  });
}

/**
 * Decorate one world's lessons with their completion and lock state.
 *
 * Sequential for the same reason the worlds are: the topics in a world build
 * on each other. "Stored Values" is not readable before "Variables", and a
 * pupil who opens it first has been given a worse lesson, not a freer one.
 */
export function decorateLessons(lessons, user) {
  const done = completedLessonIds(user);

  let previousComplete = true; // the first lesson of a world is always open.
  let previousTitle = null;

  return lessons.map((lesson) => {
    const plain = typeof lesson.toObject === 'function' ? lesson.toObject() : { ...lesson };
    const completed = done.has(String(lesson._id));
    const unlocked = previousComplete;

    const decorated = {
      ...plain,
      id: String(lesson._id),
      completed,
      unlocked,
      lockedReason: unlocked
        ? null
        : `Finish "${previousTitle}" first.`,
    };

    previousComplete = completed;
    previousTitle = lesson.title;
    return decorated;
  });
}

/**
 * May this pupil complete this lesson right now?
 *
 * Called on the WRITE path. Without it the sequence above is advisory: a
 * pupil could POST completions for every lesson in a world in any order and
 * the map would happily unlock, because the map only counts completions and
 * does not ask how they were come by.
 *
 * Re-completing an already-finished lesson stays allowed — it is idempotent,
 * awards nothing the second time, and a child re-reading a lesson they liked
 * should not meet an error.
 */
export async function assertLessonOpen(user, lessonId) {
  const lesson = await Lesson.findById(lessonId).lean();
  if (!lesson) return { ok: false, status: 404, message: 'Lesson not found' };

  const done = completedLessonIds(user);
  if (done.has(String(lesson._id))) return { ok: true, lesson };

  const world = await worldRepository.findById(lesson.world);

  /**
   * Every earlier lesson IN THE CURRICULUM must be finished.
   *
   * Sequencing over every Lesson document in the world let orphaned content —
   * a lesson renamed in a later version, whose original was never removed —
   * sit in front of the real first lesson and block it. Filtering to what the
   * world actually teaches means the read path and this write path agree about
   * what "the previous one" is.
   */
  const siblings = curriculumLessons(world, await lessonRepository.findByWorld(lesson.world));

  /**
   * A lesson that is not in the curriculum at all is refused rather than
   * silently allowed. It is not on any card, so nothing legitimate can be
   * asking for it, and paying XP for content the course no longer contains
   * would be a way to inflate progress.
   */
  if (!siblings.some((s) => String(s._id) === String(lesson._id))) {
    return {
      ok: false,
      status: 404,
      message: 'Lesson not found',
    };
  }

  for (const sibling of siblings) {
    if (String(sibling._id) === String(lesson._id)) break;
    if (!done.has(String(sibling._id))) {
      return {
        ok: false,
        status: 403,
        message: `Finish "${sibling.title}" before starting "${lesson.title}".`,
      };
    }
  }

  // And every earlier world in the same course must be finished.
  if (world?.course) {
    const worlds = await worldRepository.findByCourse(world.course);
    const decorated = await decorateWorlds(worlds, user);
    const target = decorated.find((w) => String(w._id) === String(world._id));
    if (target && !target.unlocked) {
      return { ok: false, status: 403, message: target.lockedReason };
    }
  }

  return { ok: true, lesson };
}

export default {
  completedLessonIds,
  decorateWorlds,
  decorateLessons,
  assertLessonOpen,
};
