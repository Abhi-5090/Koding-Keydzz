/**
 * Reconcile the database with the course ladder in src/config/courses.js.
 *
 * WHAT IT DOES
 * ------------
 *  1. Upserts the four courses by slug. Titles and descriptions are only
 *     written on CREATE — a superadmin may edit those afterwards and a re-run
 *     must not stamp their wording back to the defaults. `slug`, `language`,
 *     `order` and `kind` ARE re-applied every run, because the unlock chain
 *     and the compiler depend on them and neither tolerates drift.
 *
 *  2. Backfills `World.course`. Every world that exists today is Python
 *     content, so any world with no course is attached to Python. This is the
 *     step that turns the existing product into "course 1 of 4".
 *
 *  3. Backfills `Challenge.course` from each challenge's `language`.
 *
 *  4. Publishes only the courses that actually have content behind them. A
 *     course published with no worlds would show a pupil an empty track and,
 *     worse, would count as "100% complete" to the readiness check — which
 *     opens its final test immediately. So C, HTML and AI stay unpublished
 *     until their content lands.
 *
 * SAFE TO RE-RUN. Everything is an upsert or a conditional backfill.
 *
 * USAGE
 *   npm run seed:courses
 *   npm run seed:courses -- --dry     # report only, write nothing
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { COURSES } from '../src/config/courses.js';
import { Course } from '../src/models/Course.js';
import { World } from '../src/models/World.js';
import { Challenge } from '../src/models/Challenge.js';
import { Lesson } from '../src/models/Lesson.js';
import { Quiz } from '../src/models/Quiz.js';

const DRY = process.argv.includes('--dry');
const say = (...a) => console.log(...a);

await mongoose.connect(env.MONGO_URI);
say(`\nCourse ladder → ${env.MONGO_URI.replace(/\/\/.*@/, '//***@')}`);
if (DRY) say('DRY RUN — nothing will be written.\n');

/* -------------------------------------------------------------------- 1 --- */
say('1. Courses');
const bySlug = new Map();
for (const spec of COURSES) {
  const existing = await Course.findOne({ slug: spec.slug });

  if (!existing) {
    if (DRY) {
      say(`   + would create ${spec.order}. ${spec.title} (${spec.slug})`);
      continue;
    }
    const created = await Course.create({
      slug: spec.slug,
      language: spec.language,
      order: spec.order,
      title: spec.title,
      tagline: spec.tagline,
      description: spec.description,
      icon: spec.icon,
      tint: spec.tint,
      kind: spec.kind,
      // Publication is decided in step 4, once we know what content exists.
      published: false,
    });
    bySlug.set(spec.slug, created);
    say(`   + created ${spec.order}. ${spec.title}`);
    continue;
  }

  bySlug.set(spec.slug, existing);

  // Structural fields are re-applied; editorial ones are left alone.
  const drift = [];
  for (const key of ['language', 'order', 'kind']) {
    if (existing[key] !== spec[key]) drift.push(`${key}: ${existing[key]} → ${spec[key]}`);
  }
  if (drift.length) {
    if (!DRY) {
      existing.language = spec.language;
      existing.order = spec.order;
      existing.kind = spec.kind;
      await existing.save();
    }
    say(`   ~ ${spec.title}: ${drift.join(', ')}`);
  } else {
    say(`   = ${spec.order}. ${spec.title}`);
  }
}

if (DRY && bySlug.size === 0) {
  say('\n(dry run on an empty database — later steps need the courses to exist)');
  await mongoose.disconnect();
  process.exit(0);
}

const python = bySlug.get('python');

/* -------------------------------------------------------------------- 2 --- */
say('\n2. Worlds → Python');
const orphanWorlds = await World.find({
  $or: [{ course: null }, { course: { $exists: false } }],
}).select('_id name');

if (orphanWorlds.length === 0) {
  say('   = every world already belongs to a course');
} else if (DRY) {
  say(`   ~ would attach ${orphanWorlds.length} world(s) to Python:`);
  for (const w of orphanWorlds) say(`       ${w.name}`);
} else {
  const res = await World.updateMany(
    { _id: { $in: orphanWorlds.map((w) => w._id) } },
    { $set: { course: python._id } }
  );
  say(`   ~ attached ${res.modifiedCount} world(s) to Python:`);
  for (const w of orphanWorlds) say(`       ${w.name}`);
}

/* -------------------------------------------------------------------- 3 --- */
say('\n3. Challenges → course, from their language');
const orphanChallenges = await Challenge.find({
  $or: [{ course: null }, { course: { $exists: false } }],
}).select('_id title language');

if (orphanChallenges.length === 0) {
  say('   = every challenge already belongs to a course');
} else {
  const counts = {};
  for (const ch of orphanChallenges) {
    // Anything without a recognised language is Python — that is what all the
    // existing content is.
    const slug = bySlug.has(ch.language) ? ch.language : 'python';
    counts[slug] = (counts[slug] || 0) + 1;
    if (!DRY) {
      await Challenge.updateOne({ _id: ch._id }, { $set: { course: bySlug.get(slug)._id } });
    }
  }
  const summary = Object.entries(counts).map(([s, n]) => `${n} → ${s}`).join(', ');
  say(`   ${DRY ? '~ would attach' : '~ attached'} ${orphanChallenges.length} challenge(s): ${summary}`);
}

/* -------------------------------------------------------------------- 4 --- */
say('\n4. Publication (a course is published only if it has content)');
for (const spec of COURSES) {
  const course = bySlug.get(spec.slug);
  if (!course) continue;

  const worlds = await World.countDocuments({ course: course._id });
  const worldIds = await World.find({ course: course._id }).select('_id').lean();
  const ids = worldIds.map((w) => w._id);
  const lessonDocs = ids.length
    ? await Lesson.find({ world: { $in: ids } }).select('_id').lean()
    : [];
  const lessons = lessonDocs.length;
  // Either link — every seeded quiz attaches via `lesson`, not `world`. See
  // courseService.courseContentSize for why counting one alone is dangerous.
  const quizzes = ids.length
    ? await Quiz.countDocuments({
        $or: [{ world: { $in: ids } }, { lesson: { $in: lessonDocs.map((l) => l._id) } }],
      })
    : 0;

  // Worlds AND lessons. A course with empty worlds still has nothing to
  // teach, and the readiness check would read 0-of-0 as "finished" and open
  // its final test on day one.
  const hasContent = worlds > 0 && lessons > 0;

  if (course.published === hasContent) {
    say(
      `   = ${spec.title.padEnd(16)} ${hasContent ? 'published' : 'unpublished'}` +
        `  (${worlds} worlds, ${lessons} lessons, ${quizzes} quizzes)`
    );
    continue;
  }

  if (!DRY) {
    course.published = hasContent;
    await course.save();
  }
  say(
    `   ~ ${spec.title.padEnd(16)} → ${hasContent ? 'PUBLISHED' : 'unpublished'}` +
      `  (${worlds} worlds, ${lessons} lessons, ${quizzes} quizzes)`
  );
}

say(
  DRY
    ? '\nDry run complete — nothing written.\n'
    : '\nDone. Pupils now see the ladder; only courses with content are visible.\n'
);
await mongoose.disconnect();
