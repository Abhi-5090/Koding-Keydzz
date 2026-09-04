/**
 * THE COURSE LADDER — the single source of truth for the four language tracks.
 *
 * A pupil works one language at a time. Python is open from day one; each
 * later course unlocks only when the previous one's final test is passed. That
 * ordering is the product's core progression, so it lives in one file rather
 * than being implied by scattered `order` columns and enum lists.
 *
 * WHY A CONFIG FILE AND NOT JUST DATABASE ROWS
 * --------------------------------------------
 * The rows ARE the source for titles and descriptions — an admin can edit
 * those. But three things must never drift, and would if they were only data:
 *
 *   1. the SLUGS, because content, the game catalogue and the frontend routes
 *      all key off them;
 *   2. the ORDER, because it defines the unlock chain — a mis-ordered row
 *      would either lock a pupil out of everything or open all four at once;
 *   3. the LANGUAGE list, because the compiler, the validators and the lesson
 *      snippets each have to agree on what a valid language is.
 *
 * `npm run seed:courses` reconciles the database with this file.
 *
 * JAVASCRIPT WAS REMOVED. It used to be a second playground language and a
 * value in several enums. The product is now a Python-first ladder, and a
 * language that belongs to no course would appear in the compiler picker while
 * having no lessons, quizzes or games behind it.
 */

/** Every language the platform teaches, in ladder order. */
export const LANGUAGES = ['python', 'c', 'html', 'ai'];

/**
 * The four courses.
 *
 * `order` is 1-based and contiguous — the unlock chain walks it directly, so a
 * gap would strand every course after it.
 *
 * `kind` decides how the final test is built and how work is graded:
 *   'code'  -> MCQs + fill-in-blanks + coding questions run against test cases
 *   'build' -> MCQs + fill-in-blanks + tasks graded against a stored outcome
 * See docs/COURSES.md for the point tables.
 */
export const COURSES = [
  {
    slug: 'python',
    language: 'python',
    order: 1,
    title: 'Python',
    tagline: 'Where every coder starts',
    description:
      'Variables, loops, functions and logic — the foundations, taught through ' +
      'games and real code you run in the browser.',
    icon: 'terminal',
    tint: '#34D399',
    kind: 'code',
  },
  {
    slug: 'c',
    language: 'c',
    order: 2,
    title: 'C Programming',
    tagline: 'Closer to the machine',
    description:
      'The same ideas you learned in Python, now with types, memory and ' +
      'compilation — so you can see what the computer is really doing.',
    icon: 'cpu',
    tint: '#47A6F0',
    kind: 'code',
  },
  {
    slug: 'html',
    language: 'html',
    order: 3,
    title: 'HTML & CSS',
    tagline: 'Build things people can see',
    description:
      'Structure a page, style it, and lay it out. Everything you make here ' +
      'shows up instantly in a live preview beside your code.',
    icon: 'layout',
    tint: '#E8A63D',
    kind: 'build',
  },
  {
    slug: 'ai',
    language: 'ai',
    order: 4,
    title: 'AI & Prompting',
    tagline: 'Work with the new tools',
    description:
      'How large language models actually work, how to prompt them well, and ' +
      'which tool to reach for — with real tasks to prove it.',
    icon: 'sparkles',
    tint: '#9E86F5',
    kind: 'build',
  },
];

/** Pass mark for every final test: 150 of 200 points. */
export const FINAL_TEST_TOTAL = 200;
export const FINAL_TEST_PASS_MARK = 150;
/** A pupil gets three tries; questions are redrawn from the bank each time. */
export const FINAL_TEST_MAX_ATTEMPTS = 3;

const BY_SLUG = new Map(COURSES.map((c) => [c.slug, c]));

/** @returns {object|undefined} */
export const courseBySlug = (slug) => BY_SLUG.get(String(slug || '').toLowerCase());

/** Is this a language the platform teaches? */
export const isKnownLanguage = (lang) => LANGUAGES.includes(String(lang || '').toLowerCase());

/** The course a pupil should be offered first. */
export const firstCourse = () => COURSES[0];

/**
 * The course that must be completed before `slug` unlocks.
 * @returns {object|null} null for the first course, which is always open.
 */
export function prerequisiteOf(slug) {
  const course = courseBySlug(slug);
  if (!course || course.order <= 1) return null;
  return COURSES.find((c) => c.order === course.order - 1) || null;
}

/** The course unlocked by completing `slug`, if any. */
export function nextAfter(slug) {
  const course = courseBySlug(slug);
  if (!course) return null;
  return COURSES.find((c) => c.order === course.order + 1) || null;
}

export default {
  LANGUAGES,
  COURSES,
  FINAL_TEST_TOTAL,
  FINAL_TEST_PASS_MARK,
  FINAL_TEST_MAX_ATTEMPTS,
  courseBySlug,
  isKnownLanguage,
  firstCourse,
  prerequisiteOf,
  nextAfter,
};
