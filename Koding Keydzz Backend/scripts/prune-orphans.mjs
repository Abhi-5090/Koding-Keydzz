#!/usr/bin/env node
/**
 * FIND — AND OPTIONALLY REMOVE — CONTENT NOTHING POINTS AT ANY MORE.
 *
 * WHY THIS EXISTS
 * ---------------
 * Content is upserted on natural keys, and several of those keys include a
 * TITLE. So renaming anything creates a second document and leaves the
 * original behind. A database that has been upgraded rather than reset
 * accumulates that debris, and it is not inert:
 *
 *   • A stale lesson kept its old `order`, so it won the first slot in a
 *     world's sequence — the only slot that starts unlocked. The first topic a
 *     child sees rendered locked, with nothing that could open it.
 *   • It also counted towards the world's total, so a world with four cards
 *     and three orphans needed seven completions. Finishing every card left it
 *     at 4 of 7, so the world never completed and the next never unlocked.
 *
 * The application now ignores such lessons at read time, so the ladder works
 * without this script ever being run. This is the other half: actually taking
 * the debris out, so that reports, exports, counts and the admin curriculum
 * screens stop showing rows nobody can reach.
 *
 * SAFETY
 * ------
 * DRY RUN BY DEFAULT. It prints what it would remove and changes nothing until
 * `--apply` is passed. It names the target database first, because the whole
 * point is that it deletes things, and "which database am I pointed at" is the
 * question you want answered before that happens.
 *
 * Against NODE_ENV=production it refuses `--apply` without `--force`, on the
 * same reasoning as the seed: a mistake here is not recoverable from inside
 * the app.
 *
 * WHAT IT WILL NOT TOUCH
 * ----------------------
 * Anything a person created: pupils, staff, schools, classrooms, attempts,
 * scores, certificates, purchases. Only authored CONTENT that nothing
 * references, plus references inside pupil records that point at content which
 * no longer exists. A pupil's history is never rewritten to say they did less
 * than they did — a dangling completion is dropped only when the lesson it
 * names is genuinely gone.
 *
 *   node scripts/prune-orphans.mjs            # report only
 *   node scripts/prune-orphans.mjs --apply    # remove
 */
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { World } from '../src/models/World.js';
import { Lesson } from '../src/models/Lesson.js';
import { Quiz } from '../src/models/Quiz.js';
import { Challenge } from '../src/models/Challenge.js';
import { Course } from '../src/models/Course.js';
import { User } from '../src/models/User.js';
import { authoredTitlesFor } from '../src/seed/lessonCatalog.js';

const APPLY = process.argv.includes('--apply');
const FORCED = process.argv.includes('--force');
const IS_PROD = process.env.NODE_ENV === 'production';

const norm = (v) => String(v || '').trim().toLowerCase();

/** One finding: what it is, how many, and a few examples to eyeball. */
function finding(label, docs, describe) {
  return {
    label,
    count: docs.length,
    ids: docs.map((d) => d._id),
    examples: docs.slice(0, 6).map(describe),
  };
}

async function survey() {
  const [worlds, courses] = await Promise.all([
    World.find({}).select('_id name slug topics course').lean(),
    Course.find({}).select('_id slug').lean(),
  ]);
  const worldById = new Map(worlds.map((w) => [String(w._id), w]));
  const courseIds = new Set(courses.map((c) => String(c._id)));

  const findings = [];

  /* ---- Lessons ------------------------------------------------------- */
  const lessons = await Lesson.find({}).select('_id title world order').lean();

  // A lesson whose world was deleted. Unreachable by any route.
  const lessonsNoWorld = lessons.filter((l) => !l.world || !worldById.has(String(l.world)));
  findings.push(
    finding('Lessons whose world no longer exists', lessonsNoWorld, (l) => `"${l.title}"`)
  );

  /**
   * A lesson the AUTHORED CONTENT does not contain — the renamed-away case.
   *
   * Judged against `lessonCatalog`, which is what the seed writes from, and
   * never against the world's `topics`. An earlier version did use topics and
   * was badly wrong: C, HTML and AI deliberately pair short card labels with
   * descriptive lesson titles ("Printing Output" against "Printing with
   * printf"), so it flagged seventeen real lessons across fifteen worlds as
   * orphans. A script that deletes things cannot work from an inference.
   *
   * A world with no entry in the catalogue is skipped entirely: that is
   * content this build does not know about — hand-authored through the admin
   * screens, or from a course added later — and absence of knowledge is not
   * evidence of an orphan.
   */
  const lessonsNotAuthored = lessons.filter((l) => {
    const world = worldById.get(String(l.world));
    if (!world) return false; // already covered above
    const authored = authoredTitlesFor(world.slug);
    if (!authored) return false;
    return !new Set(authored.map(norm)).has(norm(l.title));
  });
  findings.push(
    finding(
      'Lessons the authored curriculum no longer contains (renamed away)',
      lessonsNotAuthored,
      (l) => `"${l.title}" in ${worldById.get(String(l.world))?.name || '?'}`
    )
  );

  /**
   * Worlds this build has no content for. Reported so the number is visible
   * rather than silently skipped — if a world you expect to be seeded appears
   * here, its slug does not match the catalogue and the seed is not writing
   * to it.
   */
  const worldsUnknown = worlds.filter((w) => !authoredTitlesFor(w.slug));
  findings.push(
    finding(
      'Worlds with no authored content in this build (SKIPPED, not judged)',
      worldsUnknown,
      (w) => `${w.name} (${w.slug})`
    )
  );

  const doomedLessonIds = new Set(
    [...lessonsNoWorld, ...lessonsNotAuthored].map((l) => String(l._id))
  );

  /* ---- Quizzes ------------------------------------------------------- */
  const quizzes = await Quiz.find({}).select('_id title world lesson').lean();
  const liveLessonIds = new Set(
    lessons.filter((l) => !doomedLessonIds.has(String(l._id))).map((l) => String(l._id))
  );

  /**
   * A quiz pointing at a lesson or world that is gone — including one about to
   * go in this run, so a single pass leaves nothing dangling behind it.
   *
   * These are UNLINKED rather than deleted: a quiz carries authored questions,
   * which is real work, and the arena can still show it under its world. Only
   * a quiz with no valid world AND no valid lesson is unreachable.
   */
  const quizzesToUnlink = quizzes.filter(
    (q) =>
      (q.lesson && !liveLessonIds.has(String(q.lesson))) ||
      (q.world && !worldById.has(String(q.world)))
  );
  findings.push(
    finding(
      'Quizzes pointing at a lesson or world that is gone (link cleared, quiz kept)',
      quizzesToUnlink,
      (q) => `"${q.title}"`
    )
  );

  const quizzesUnreachable = quizzes.filter((q) => {
    const lessonOk = q.lesson && liveLessonIds.has(String(q.lesson));
    const worldOk = q.world && worldById.has(String(q.world));
    return !lessonOk && !worldOk;
  });

  /**
   * EXACT-TITLE DUPLICATES whose link is dead — safe to delete outright.
   *
   * The quiz upsert used to be keyed on `{ title, lesson }`, putting a foreign
   * key inside a natural key. Recreating a lesson changed every quiz's key
   * with it, so the upsert inserted a duplicate and the original kept pointing
   * at the deleted lesson.
   *
   * Such a document is not lost work: an identically-titled quiz with a LIVE
   * link already exists, carrying the same authored questions. That is what
   * makes deleting it safe, and why it is separated from the general
   * unreachable case — a quiz with a unique title and no link might be
   * something an author still wants, and is left alone.
   */
  const liveTitles = new Map();
  for (const q of quizzes) {
    const lessonOk = q.lesson && liveLessonIds.has(String(q.lesson));
    const worldOk = q.world && worldById.has(String(q.world));
    if (lessonOk || worldOk) liveTitles.set(norm(q.title), String(q._id));
  }
  const quizDuplicates = quizzesUnreachable.filter(
    (q) => liveTitles.has(norm(q.title)) && liveTitles.get(norm(q.title)) !== String(q._id)
  );
  findings.push(
    finding(
      'Quizzes that are dead-linked duplicates of a live one (safe to delete)',
      quizDuplicates,
      (q) => `"${q.title}"`
    )
  );

  const duplicateIds = new Set(quizDuplicates.map((q) => String(q._id)));
  const quizzesStranded = quizzesUnreachable.filter((q) => !duplicateIds.has(String(q._id)));
  findings.push(
    finding(
      'Quizzes unreachable with no live twin (REPORT ONLY — an author must decide)',
      quizzesStranded,
      (q) => `"${q.title}"`
    )
  );

  /* ---- Challenges ---------------------------------------------------- */
  const challenges = await Challenge.find({}).select('_id title world lesson').lean();
  const challengesOrphaned = challenges.filter(
    (c) =>
      (c.world && !worldById.has(String(c.world))) ||
      (c.lesson && !liveLessonIds.has(String(c.lesson)))
  );
  findings.push(
    finding('Challenges pointing at missing content', challengesOrphaned, (c) => `"${c.title}"`)
  );

  /* ---- Worlds -------------------------------------------------------- */
  /**
   * A world with no course is INVISIBLE to pupils — the student API only ever
   * asks for the current course's worlds. Reported, never deleted: it holds
   * authored lessons and the fix is to attach it to a course (the seed does
   * that), not to throw it away.
   */
  const worldsNoCourse = worlds.filter((w) => !w.course || !courseIds.has(String(w.course)));
  findings.push(
    finding(
      'Worlds with no course — invisible to pupils (REPORT ONLY, never deleted)',
      worldsNoCourse,
      (w) => `${w.name} (${w.slug})`
    )
  );

  /* ---- Pupil records ------------------------------------------------- */
  /**
   * Completions naming a lesson that no longer exists. These are already
   * ignored when counting — matched by id against the lessons that exist — so
   * they are harmless, but they inflate `lessonsCompleted` and linger in
   * exports.
   */
  const allLessonIds = new Set(lessons.map((l) => String(l._id)));
  const usersWithDangling = await User.find({ 'completedLessons.0': { $exists: true } })
    .select('_id name completedLessons lessonsCompleted')
    .lean();
  const danglingByUser = usersWithDangling
    .map((u) => {
      const dangling = (u.completedLessons || []).filter((entry) => {
        const id = String(entry.lesson);
        return !allLessonIds.has(id) || doomedLessonIds.has(id);
      });
      return { _id: u._id, name: u.name, dangling };
    })
    .filter((u) => u.dangling.length > 0);
  findings.push(
    finding(
      'Pupils holding completions for lessons that are gone',
      danglingByUser,
      (u) => `${u.name} (${u.dangling.length})`
    )
  );

  return {
    findings,
    doomedLessonIds,
    quizzesToUnlink,
    quizzesUnreachable,
    quizDuplicates,
    quizzesStranded,
    challengesOrphaned,
    danglingByUser,
    worldsNoCourse,
  };
}

async function main() {
  await connectDB();
  const dbName = mongoose.connection.name;

  console.log('');
  console.log(`Target database : ${dbName}`);
  console.log(`Mode            : ${APPLY ? 'APPLY — documents will be removed' : 'DRY RUN — nothing will change'}`);
  console.log('');

  if (IS_PROD && APPLY && !FORCED) {
    console.error(
      'Refusing to --apply against NODE_ENV=production without --force.\n' +
        'Run the dry run first, read what it lists, then re-run with --force.\n'
    );
    await disconnectDB();
    process.exit(1);
  }

  const result = await survey();

  let total = 0;
  for (const f of result.findings) {
    total += f.count;
    const head = `${String(f.count).padStart(5)}  ${f.label}`;
    console.log(f.count === 0 ? `\x1b[2m${head}\x1b[0m` : head);
    if (f.count > 0) {
      for (const ex of f.examples) console.log(`         · ${ex}`);
      if (f.count > f.examples.length) {
        console.log(`         · …and ${f.count - f.examples.length} more`);
      }
    }
  }

  console.log('');
  if (total === 0) {
    console.log('Nothing orphaned. Database is clean.');
    await disconnectDB();
    return;
  }

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to remove the above.');
    console.log('(Worlds with no course are never deleted — attach them with `npm run seed`.)');
    await disconnectDB();
    return;
  }

  /* ---- Apply --------------------------------------------------------- */
  const lessonIds = [...result.doomedLessonIds].map((id) => new mongoose.Types.ObjectId(id));

  if (lessonIds.length > 0) {
    const res = await Lesson.deleteMany({ _id: { $in: lessonIds } });
    console.log(`Removed ${res.deletedCount} lesson(s).`);
  }

  /**
   * Quizzes and challenges are UNLINKED, not deleted, wherever they still have
   * somewhere to live: the questions inside them are authored work. `$unset`
   * rather than `$set: null` so the field simply is not there, which is what
   * the schema default expresses.
   */
  if (result.quizDuplicates.length > 0) {
    const res = await Quiz.deleteMany({
      _id: { $in: result.quizDuplicates.map((q) => q._id) },
    });
    console.log(`Removed ${res.deletedCount} dead-linked duplicate quiz(zes).`);
  }

  /**
   * Anything still unreachable but WITHOUT a live twin keeps its stale link
   * cleared rather than being deleted: the questions inside it are authored
   * work, and only a person can say which world it now belongs to.
   */
  const goneIds = new Set(result.quizDuplicates.map((q) => String(q._id)));
  let unlinked = 0;
  for (const quiz of result.quizzesToUnlink) {
    if (goneIds.has(String(quiz._id))) continue;
    const unset = {};
    if (quiz.lesson) unset.lesson = '';
    if (Object.keys(unset).length === 0) continue;
    await Quiz.updateOne({ _id: quiz._id }, { $unset: unset });
    unlinked += 1;
  }
  if (unlinked > 0) {
    console.log(`Cleared stale lesson links on ${unlinked} quiz(zes).`);
  }
  if (result.quizzesStranded.length > 0) {
    console.log(
      `NOTE: ${result.quizzesStranded.length} quiz(zes) remain unreachable with no live twin. ` +
        'Left in place — they hold authored questions and only an author can place them.'
    );
  }

  for (const challenge of result.challengesOrphaned) {
    const unset = {};
    if (challenge.lesson) unset.lesson = '';
    if (challenge.world) unset.world = '';
    await Challenge.updateOne({ _id: challenge._id }, { $unset: unset });
  }
  if (result.challengesOrphaned.length > 0) {
    console.log(`Cleared stale links on ${result.challengesOrphaned.length} challenge(s).`);
  }

  /**
   * Dangling completions are pulled, and `lessonsCompleted` is recomputed from
   * what actually remains rather than decremented — a counter that has drifted
   * cannot be corrected by arithmetic on the drift.
   */
  for (const user of result.danglingByUser) {
    const doomed = user.dangling.map((d) => d.lesson);
    await User.updateOne(
      { _id: user._id },
      { $pull: { completedLessons: { lesson: { $in: doomed } } } }
    );
    const fresh = await User.findById(user._id).select('completedLessons').lean();
    await User.updateOne(
      { _id: user._id },
      { $set: { lessonsCompleted: (fresh.completedLessons || []).length } }
    );
  }
  if (result.danglingByUser.length > 0) {
    console.log(
      `Cleaned dangling completions for ${result.danglingByUser.length} pupil(s) ` +
        'and recomputed their lesson counts.'
    );
  }

  if (result.worldsNoCourse.length > 0) {
    console.log('');
    console.log(
      `NOTE: ${result.worldsNoCourse.length} world(s) still have no course and stay invisible ` +
        'to pupils. Run `npm run seed` to attach them; this script will not delete authored worlds.'
    );
  }

  console.log('');
  console.log('Done.');
  await disconnectDB();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
