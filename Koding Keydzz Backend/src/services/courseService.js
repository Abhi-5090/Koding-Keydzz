import { Course } from '../models/Course.js';
import { CourseProgress } from '../models/CourseProgress.js';
import { World } from '../models/World.js';
import { Lesson } from '../models/Lesson.js';
import { Quiz } from '../models/Quiz.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { ApiError } from '../utils/ApiError.js';
import { GAME_CATALOG } from '../config/gameCatalog.js';
import {
  FINAL_TEST_MAX_ATTEMPTS,
  FINAL_TEST_PASS_MARK,
  FINAL_TEST_TOTAL,
  COGNITIVE_GAME_KEYS,
} from '../config/courses.js';
import {
  unlockedTier,
  MAX_TIER,
  isGatingLevel,
  GATE_CAP_PER_NEUTRAL_GAME,
} from '../config/gameTiers.js';

/**
 * THE COURSE LADDER, from a pupil's point of view.
 *
 * TWO THINGS ARE DERIVED HERE, NOT STORED
 * ---------------------------------------
 * 1. LOCK STATE. A course is unlocked when the previous one has been passed.
 *    Storing that as a flag means it can disagree with the attempts it is
 *    meant to reflect — and then a pupil is either stuck behind a course they
 *    have already passed, or has been handed one they have not earned. Both
 *    failures are silent. Deriving it makes the two unable to disagree.
 *
 * 2. FINAL-TEST READINESS. The test opens only when the course content is
 *    finished, so readiness is counted from what the pupil has actually done
 *    against what the course actually contains. A cached percentage would go
 *    stale the moment content is added — and adding a lesson would then let
 *    pupils sit a test on material they never saw.
 *
 * Everything genuinely historical — attempts, scores, the completion date —
 * lives in CourseProgress.
 */

/* -------------------------------------------------------------------------- */
/* Course content sizes                                                       */
/* -------------------------------------------------------------------------- */

/**
 * How much work a course contains: worlds, lessons and quizzes.
 *
 * Counted live. The alternative — a `totalLessons` column on Course — drifts
 * the first time someone adds a lesson, and drifts SILENTLY, because nothing
 * reads it except the gate it would then open too early.
 */
export async function courseContentSize(courseId) {
  const worlds = await World.find({ course: courseId }).select('_id').lean();
  const worldIds = worlds.map((w) => w._id);
  if (worldIds.length === 0) {
    return {
      worldIds: [],
      lessonIds: [],
      quizIds: [],
      worlds: 0,
      lessons: 0,
      quizzes: 0,
    };
  }

  const lessonDocs = await Lesson.find({ world: { $in: worldIds } })
    .select('_id')
    .lean();
  const lessonIds = lessonDocs.map((l) => l._id);

  /**
   * A quiz reaches its course through EITHER link.
   *
   * This is not defensive coding — it is the actual data. Every one of the 20
   * seeded quizzes carries a `lesson` and a null `world`, so counting by
   * `world` alone returned 0. That is far worse than an undercount: readiness
   * reads "0 of 0 quizzes" as COMPLETE, so the final test would have opened
   * with every quiz in the course still unattempted.
   */
  const quizFilter = {
    $or: [{ world: { $in: worldIds } }, { lesson: { $in: lessonIds } }],
  };
  const quizDocs = await Quiz.find(quizFilter).select('_id').lean();
  const quizIds = quizDocs.map((q) => q._id);

  return {
    worldIds,
    lessonIds,
    quizIds,
    worlds: worldIds.length,
    lessons: lessonIds.length,
    quizzes: quizIds.length,
  };
}

/**
 * The game levels that belong to a course.
 *
 * Read from the server-side catalogue rather than the database, because that
 * file is already the authority on which games and levels exist (see
 * config/gameCatalog.js).
 *
 * A game with NO course is deliberately treated as belonging to every course:
 * the six logic games — Sudoku, Towers of Hanoi, N-Queens, Zip, Patches,
 * Tic-Tac-Toe — teach computational thinking with no syntax at all, so they
 * are played in whichever language a pupil is currently on.
 */
export function courseGameLevels(courseSlug) {
  const games = {};
  let total = 0;
  for (const [gameKey, game] of Object.entries(GAME_CATALOG)) {
    const belongs = !game.course || game.course === courseSlug;
    if (!belongs) continue;

    /**
     * ONLY THE GATING TIER COUNTS TOWARDS THE FINAL-TEST GATE.
     *
     * The puzzle games now hold five tiers of levels, a tier opening each time
     * a course is passed. Counting all of them here would have made passing
     * Python instantly add roughly 240 compulsory puzzles before the C final
     * test could be sat — turning a reward into a wall, and quietly tripling a
     * gate that pupils are already partway through.
     *
     * So the strand counts tier-0 levels, and the later tiers are playable
     * content that still pays full XP, coins and leaderboard placement. A
     * level with no tier recorded is tier 0, which is what keeps every
     * hand-authored game unchanged.
     */
    const tiers = game.tiers || {};
    let levelIds = Object.keys(game.levels || {}).filter((id) =>
      isGatingLevel(tiers[id] || 0),
    );

    /**
     * A language-neutral game contributes at most a CAPPED number of levels.
     *
     * Without this, expanding the puzzle games raised the course gate as a side
     * effect: Python went from 231 required game levels to 376 purely because
     * sudoku, zip, patches and n-queens each grew a 50-level base tier. The
     * language-linked games (identified by carrying a `course`) are required in
     * full, because finishing them IS finishing the course.
     *
     * Sorted numerically before slicing, so the required set is the game's
     * FIRST levels — the gentle on-ramp — rather than an arbitrary slice of
     * whatever order the object happened to enumerate in.
     */
    if (!game.course && GATE_CAP_PER_NEUTRAL_GAME !== null) {
      levelIds = levelIds
        .slice()
        .sort((a, b) => Number(a) - Number(b))
        .slice(0, GATE_CAP_PER_NEUTRAL_GAME);
    }

    games[gameKey] = levelIds;
    total += levelIds.length;
  }
  return { games, total };
}

/* -------------------------------------------------------------------------- */
/* Readiness                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * How far through a course this pupil is, and whether the final test is open.
 *
 * The three strands are reported separately on purpose: "3 quizzes left" is
 * something a child can act on, where a single "87%" is not.
 */
export async function courseReadiness(user, course) {
  /**
   * A GAMES REALM IS MEASURED IN GAMES, AND NEVER OFFERS A FINAL TEST.
   *
   * Falling through to the counting below would be actively wrong. Cognitive
   * Games has no worlds, no lessons and no quizzes, so every strand would be
   * 0 of 0 — and `complete: done >= total` reads 0 >= 0 as finished. All three
   * strands complete means `finalTestUnlocked`, so the realm would offer a
   * paper it has none of, on a pupil's first day, before they had played
   * anything.
   *
   * Its real measure is the four games, which is also what the pupil's
   * progress bar should show.
   */
  if (course.kind === 'games') {
    const progress = cognitiveGameProgress(user);
    const done = progress.filter((g) => g.levelsDone > 0).length;
    const total = progress.length;
    const strandForGames = {
      done,
      total,
      remaining: Math.max(0, total - done),
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
      complete: total > 0 && done >= total,
    };
    return {
      // Named strands are kept so the UI does not need a second shape.
      lessons: { done: 0, total: 0, remaining: 0, percent: 100, complete: true },
      quizzes: { done: 0, total: 0, remaining: 0, percent: 100, complete: true },
      gameLevels: strandForGames,
      games: progress,
      percent: strandForGames.percent,
      // There is no paper for this realm; passing it is playing it.
      finalTestUnlocked: false,
    };
  }

  const size = await courseContentSize(course._id);
  const { games, total: gameTotal } = courseGameLevels(course.slug);

  // ---- lessons ----
  const worldIdSet = new Set(size.worldIds.map(String));
  const lessonsDone = (user.completedLessons || []).filter((c) =>
    worldIdSet.has(String(c.world)),
  ).length;

  // ---- quizzes ----
  // DISTINCT quizzes passed, not attempts. A pupil who passes the same quiz
  // three times has finished one quiz; counting attempts would open the final
  // test on a single quiz replayed enough times.
  let quizzesDone = 0;
  if (size.quizIds.length) {
    const passed = await QuizAttempt.distinct('quiz', {
      user: user._id,
      quiz: { $in: size.quizIds },
      passed: true,
    });
    quizzesDone = passed.length;
  }

  // ---- game levels ----
  let gamesDone = 0;
  for (const entry of user.gameProgress || []) {
    const levels = games[entry.gameKey];
    if (levels && levels.includes(String(entry.levelId))) gamesDone += 1;
  }

  const strand = (done, total) => ({
    done,
    total,
    remaining: Math.max(0, total - done),
    percent:
      total === 0 ? 100 : Math.min(100, Math.round((done / total) * 100)),
    complete: done >= total,
  });

  const lessons = strand(lessonsDone, size.lessons);
  const quizzes = strand(quizzesDone, size.quizzes);
  const gameLevels = strand(gamesDone, gameTotal);

  // EVERY strand must be finished. A weighted average would let a pupil skip
  // all the quizzes and still sit the test on the strength of games alone.
  const ready = lessons.complete && quizzes.complete && gameLevels.complete;

  const weightedTotal = size.lessons + size.quizzes + gameTotal;
  const weightedDone = lessonsDone + quizzesDone + gamesDone;

  return {
    lessons,
    quizzes,
    gameLevels,
    percent:
      weightedTotal === 0
        ? 0
        : Math.min(100, Math.round((weightedDone / weightedTotal) * 100)),
    finalTestUnlocked: ready,
  };
}

/* -------------------------------------------------------------------------- */
/* The ladder                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * HAS THIS PUPIL FINISHED THE COGNITIVE GAMES REALM?
 *
 * The first level of each of its four games. `gameProgress` records one entry
 * per (gameKey, levelId) the pupil has completed, so this asks whether each
 * game has at least one entry — the games number their levels from 1 and a
 * pupil cannot reach level 2 without finishing level 1, so "any completion"
 * and "level 1 completed" are the same statement, and asking it that way does
 * not depend on how a particular game labels its levels.
 *
 * Exported because the staff screen shows the same figures it decides on. Two
 * implementations of "has this child finished the realm?" would eventually
 * disagree, and the one on the teacher's screen is the one they would trust.
 */
export function cognitiveGameProgress(user) {
  const played = new Map();
  for (const entry of user?.gameProgress || []) {
    if (!COGNITIVE_GAME_KEYS.includes(entry.gameKey)) continue;
    played.set(entry.gameKey, (played.get(entry.gameKey) || 0) + 1);
  }
  return COGNITIVE_GAME_KEYS.map((gameKey) => ({
    gameKey,
    levelsDone: played.get(gameKey) || 0,
    started: played.has(gameKey),
  }));
}

/** True when every cognitive game has had its first level finished. */
export function cognitiveRealmComplete(user) {
  return cognitiveGameProgress(user).every((g) => g.levelsDone > 0);
}

/**
 * Every published course, with this pupil's standing in each.
 *
 * Returned in ladder order with a derived `status`:
 *   locked       the previous course has not been passed
 *   available    open, not started
 *   in_progress  started, not passed
 *   completed    final test passed
 */
export async function listCoursesForUser(user) {
  const [courses, progressRows] = await Promise.all([
    Course.find({ published: true }).sort({ order: 1 }).lean(),
    CourseProgress.find({ user: user._id }).lean(),
  ]);

  const byCourse = new Map(progressRows.map((p) => [String(p.course), p]));
  const titleByOrder = new Map(courses.map((c) => [c.order, c.title]));

  const items = [];
  // Walks the ladder in order, carrying whether the PREVIOUS course was
  // passed. That single local variable is the entire unlock rule, which is
  // what makes it impossible for two courses to disagree about it.
  let previousPassed = true; // the first course is always open

  const granted = new Set((user.grantedCourses || []).map(String));

  for (const course of courses) {
    const progress = byCourse.get(String(course._id)) || null;

    /**
     * A GAMES REALM IS PASSED BY PLAYING, not by sitting a paper.
     *
     * Cognitive Games has no worlds, no lessons and no final test, so
     * `completedAt` on CourseProgress — which is written when a final test is
     * passed — would never be set and the realm would block the whole ladder
     * for ever. It is passed when the pupil has finished the first level of
     * each of its games.
     *
     * Deliberately the FIRST level and not all of them: the realm is an
     * on-ramp, not a wall. A child should meet Python in their first session,
     * having shown they can plan a route and think a move ahead.
     */
    const passed =
      course.kind === 'games'
        ? cognitiveRealmComplete(user)
        : Boolean(progress?.completedAt);

    /**
     * Unlocked by the ladder OR by a member of staff.
     *
     * The grant only ever adds: `previousPassed` still opens a realm the pupil
     * has earned, so a revoke cannot close something they finished.
     */
    const unlocked = previousPassed || granted.has(String(course._id));

    let status;
    if (passed) status = 'completed';
    else if (!unlocked) status = 'locked';
    else if (progress?.startedAt) status = 'in_progress';
    else status = 'available';

    // Readiness only means anything for a course the pupil can work on, and
    // each call costs several queries — so it is skipped for locked and
    // finished courses.
    const readiness =
      unlocked && !passed ? await courseReadiness(user, course) : null;

    items.push({
      id: String(course._id),
      slug: course.slug,
      language: course.language,
      order: course.order,
      title: course.title,
      tagline: course.tagline,
      description: course.description,
      icon: course.icon,
      tint: course.tint,
      kind: course.kind,
      status,
      // So the pupil's map can say "your teacher opened this" rather than
      // implying they earned it, and the staff screen can show what it did.
      grantedByStaff: granted.has(String(course._id)) && !previousPassed,
      unlocked,
      passed,
      startedAt: progress?.startedAt || null,
      completedAt: progress?.completedAt || null,
      bestScore: progress?.bestScore || 0,
      attemptsUsed: progress?.attempts?.length || 0,
      attemptsLeft: Math.max(
        0,
        FINAL_TEST_MAX_ATTEMPTS - (progress?.attempts?.length || 0),
      ),
      readiness,
      // Spelled out rather than left as a mystery padlock.
      lockedReason: unlocked
        ? null
        : `Pass the ${titleByOrder.get(course.order - 1) || 'previous'} final test to unlock this.`,
    });

    previousPassed = passed;
  }

  const coursesPassed = items.filter((c) => c.passed).length;

  return {
    items,
    passMark: FINAL_TEST_PASS_MARK,
    total: FINAL_TEST_TOTAL,
    maxAttempts: FINAL_TEST_MAX_ATTEMPTS,
    /**
     * How many courses this pupil has PASSED, and the game tier it unlocks.
     *
     * Returned here rather than counted in the browser so there is one answer
     * to "how far along is this pupil". The student app filters the puzzle
     * games' levels by `gameTier`: passing a course is also the moment
     * sudoku, patches, zip and the rest each gain a fresh set of levels, so
     * finishing Python is felt inside the games a child already likes.
     */
    coursesPassed,
    gameTier: unlockedTier(coursesPassed),
    maxGameTier: MAX_TIER,
    /** The course a pupil should be working on right now. */
    currentSlug:
      items.find((c) => c.status === 'in_progress')?.slug ||
      items.find((c) => c.status === 'available')?.slug ||
      items.filter((c) => c.passed).slice(-1)[0]?.slug ||
      null,
  };
}

/**
 * The pupil's current course, resolved for content scoping.
 *
 * Every student content endpoint funnels through this, so a pupil can never be
 * served worlds, quizzes or challenges from a course they have not unlocked —
 * which is the whole point of the ladder.
 */
export async function resolveCurrentCourse(user, requestedSlug = null) {
  const ladder = await listCoursesForUser(user);

  if (requestedSlug) {
    const wanted = ladder.items.find((c) => c.slug === requestedSlug);
    if (!wanted) throw ApiError.notFound('Course not found');
    if (!wanted.unlocked) {
      // 403, not 404: the course is plainly listed as locked in the ladder, so
      // pretending it does not exist would only confuse.
      throw ApiError.forbidden(wanted.lockedReason || 'This course is locked.');
    }
    return wanted;
  }

  const current = ladder.items.find((c) => c.slug === ladder.currentSlug);
  if (!current) throw ApiError.notFound('No courses are available yet');
  return current;
}

/**
 * Mark a course as started. Idempotent.
 *
 * Called the first time a pupil opens any of its content, so "in progress" is
 * a fact about what they did rather than something an admin has to remember
 * to set.
 */
export async function startCourse(user, courseId, courseSlug) {
  return CourseProgress.findOneAndUpdate(
    { user: user._id, course: courseId },
    {
      $setOnInsert: {
        user: user._id,
        course: courseId,
        courseSlug,
        org: user.org || null,
        startedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export default {
  courseContentSize,
  courseGameLevels,
  courseReadiness,
  listCoursesForUser,
  resolveCurrentCourse,
  startCourse,
};
