import { describe, it, expect } from 'vitest';
import {
  C_WORLDS,
  C_LESSON_CONTENT,
  C_QUIZ_BLUEPRINTS,
} from '../src/seed/cCourse.js';
import {
  HTML_WORLDS,
  HTML_LESSON_CONTENT,
  HTML_QUIZ_BLUEPRINTS,
} from '../src/seed/htmlCourse.js';
import {
  AI_WORLDS,
  AI_LESSON_CONTENT,
  AI_QUIZ_BLUEPRINTS,
} from '../src/seed/aiCourse.js';
import { COURSES, LANGUAGES } from '../src/config/courses.js';
import { BLUEPRINTS } from '../src/config/finalTest.js';

/**
 * THE WHOLE LADDER'S CONTENT, checked as one system.
 *
 * Four courses now carry authored content, and the failures that matter are the
 * ones that span them:
 *
 *   • A WORLD ORDER OR SLUG COLLISION. World slugs are globally unique in the
 *     database, and order decides the sequence a pupil walks. Two courses
 *     reusing either produces a duplicate-key error at seed time, or — worse —
 *     a silently interleaved journey.
 *
 *   • A COURSE WITH NO CONTENT, PUBLISHED. An empty course reads as 0-of-0 to
 *     the readiness check, and 0-of-0 counts as COMPLETE. That would hand out a
 *     final test for a course with nothing in it.
 *
 *   • AN HTML SNIPPET THAT IS NOT VALID HTML. The C course's code is compiled
 *     in CI, so a broken snippet cannot ship. HTML has no compiler here, so
 *     malformed markup would be taught silently — hence the tag-balance check
 *     below.
 */

const ALL_COURSES = [
  {
    slug: 'c',
    worlds: C_WORLDS,
    lessons: C_LESSON_CONTENT,
    quizzes: C_QUIZ_BLUEPRINTS,
    prefix: 'c-',
  },
  {
    slug: 'html',
    worlds: HTML_WORLDS,
    lessons: HTML_LESSON_CONTENT,
    quizzes: HTML_QUIZ_BLUEPRINTS,
    prefix: 'html-',
  },
  {
    slug: 'ai',
    worlds: AI_WORLDS,
    lessons: AI_LESSON_CONTENT,
    quizzes: AI_QUIZ_BLUEPRINTS,
    prefix: 'ai-',
  },
];

/** HTML elements that legitimately have no closing tag. */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

describe('the course ladder content', () => {
  it('covers every LANGUAGE course on the ladder (Python has its own file)', () => {
    /**
     * A games realm is excluded, and that is the point of it: Cognitive Games
     * has no worlds and no lesson content at all. Its content is four
     * mini-games that already existed, so there is nothing for this file to
     * author and nothing for the seed to write.
     *
     * Filtered by `kind` rather than by slug so a second games realm added
     * later is covered without anyone remembering to edit this list.
     */
    const authored = new Set(['python', ...ALL_COURSES.map((c) => c.slug)]);
    for (const course of COURSES.filter((c) => c.kind !== 'games')) {
      expect(
        authored.has(course.slug),
        `${course.slug} has no authored content`,
      ).toBe(true);
    }
  });

  it('gives every course five worlds', () => {
    for (const c of ALL_COURSES) {
      expect(c.worlds, `${c.slug} world count`).toHaveLength(5);
    }
  });

  it('NEVER reuses a world slug across courses', () => {
    /**
     * World slugs are globally unique in the database. A collision surfaces as
     * a duplicate-key error mid-seed, which leaves the database half-populated.
     */
    const seen = new Map();
    for (const c of ALL_COURSES) {
      for (const w of c.worlds) {
        const clash = seen.get(w.slug);
        expect(
          clash,
          `"${w.slug}" is used by both ${clash} and ${c.slug}`,
        ).toBeUndefined();
        seen.set(w.slug, c.slug);
      }
    }
  });

  it('prefixes every world slug with its course', () => {
    // The seed maps a world to its course BY PREFIX, so an unprefixed world
    // would silently be attached to Python.
    for (const c of ALL_COURSES) {
      for (const w of c.worlds) {
        expect(
          w.slug.startsWith(c.prefix),
          `"${w.slug}" lacks the ${c.prefix} prefix`,
        ).toBe(true);
      }
    }
  });

  it('NEVER reuses a world order across courses', () => {
    /**
     * Order decides the sequence a pupil walks. Two courses both numbering
     * their worlds 1-5 would interleave them — and nothing would error.
     * Python holds 1-5, so the others must start at 6.
     */
    const seen = new Map();
    for (const c of ALL_COURSES) {
      for (const w of c.worlds) {
        const clash = seen.get(w.order);
        expect(
          clash,
          `order ${w.order} used by both ${clash} and ${c.slug}`,
        ).toBeUndefined();
        seen.set(w.order, c.slug);
        // 1-5 belong to Python's own worlds.
        expect(w.order, `${w.slug} collides with Python's 1-5`).toBeGreaterThan(
          5,
        );
      }
    }
  });

  it('orders each course’s worlds in one contiguous band', () => {
    // So a pupil's journey through a course is a run, not a scatter.
    for (const c of ALL_COURSES) {
      const orders = c.worlds.map((w) => w.order).sort((a, b) => a - b);
      for (let i = 1; i < orders.length; i += 1) {
        expect(orders[i], `${c.slug} has a gap in its world order`).toBe(
          orders[i - 1] + 1,
        );
      }
    }
  });

  it('has lessons for every world, and no orphan lesson content', () => {
    // A world with no lessons reads as 0-of-0 to readiness, which counts as
    // COMPLETE — the exact bug the Python ladder shipped with.
    for (const c of ALL_COURSES) {
      const slugs = c.worlds.map((w) => w.slug).sort();
      expect(Object.keys(c.lessons).sort(), `${c.slug} lesson keys`).toEqual(
        slugs,
      );
      for (const slug of slugs) {
        expect(
          c.lessons[slug].length,
          `${slug} has no lessons`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('has quizzes for every world, and no orphan quiz blueprints', () => {
    for (const c of ALL_COURSES) {
      const slugs = c.worlds.map((w) => w.slug).sort();
      expect(Object.keys(c.quizzes).sort(), `${c.slug} quiz keys`).toEqual(
        slugs,
      );
    }
  });

  it('points every quiz at a lesson that actually exists in its own world', () => {
    /**
     * `topicLesson` is matched by title. A typo falls back to the world's first
     * lesson, so the quiz still seeds and quietly links to the wrong place —
     * which means a pupil who gets it wrong is sent to revise the wrong page.
     */
    for (const c of ALL_COURSES) {
      for (const [worldSlug, blueprints] of Object.entries(c.quizzes)) {
        const titles = new Set(
          (c.lessons[worldSlug] || []).map((l) => l.title),
        );
        for (const bp of blueprints) {
          expect(
            titles.has(bp.topicLesson),
            `${c.slug}: quiz "${bp.title}" points at "${bp.topicLesson}", which is not a lesson in ${worldSlug}`,
          ).toBe(true);
        }
      }
    }
  });

  it('gives every lesson the parts the renderer draws', () => {
    for (const c of ALL_COURSES) {
      for (const [world, lessons] of Object.entries(c.lessons)) {
        for (const l of lessons) {
          const where = `${world}/${l.title}`;
          expect(l.title, `${where}: no title`).toBeTruthy();
          expect(l.body.tagline, `${where}: no tagline`).toBeTruthy();
          expect(l.body.intro, `${where}: no intro`).toBeTruthy();
          expect(
            l.body.sections?.length,
            `${where}: no sections`,
          ).toBeGreaterThan(0);
          expect(
            l.body.takeaways?.length,
            `${where}: no takeaways`,
          ).toBeGreaterThan(0);
          expect(l.body.guide?.length, `${where}: no guide`).toBeGreaterThan(0);
          expect(
            l.body.tryIt?.challenge,
            `${where}: no challenge`,
          ).toBeTruthy();
          expect(
            l.body.snippet?.lines?.length,
            `${where}: no snippet`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('tags every lesson with a language the Lesson model accepts', () => {
    /**
     * The Lesson model enums `language` to the four COURSE languages. The
     * HTML course briefly tagged its CSS lessons `language: 'css'` and the AI
     * course used `'text'` — both seeded fine in testing and then failed
     * validation on a real seed. The snippet keeps its own language for
     * syntax highlighting; the LESSON carries its course's.
     */
    for (const c of ALL_COURSES) {
      for (const [world, lessons] of Object.entries(c.lessons)) {
        for (const l of lessons) {
          expect(
            LANGUAGES.includes(l.language),
            `${world}/${l.title}: language "${l.language}" is not one of ${LANGUAGES.join(', ')}`,
          ).toBe(true);
          expect(l.language, `${world}/${l.title} belongs to ${c.slug}`).toBe(
            c.slug,
          );
        }
      }
    }
  });

  it('numbers lessons from 1 within each world', () => {
    for (const c of ALL_COURSES) {
      for (const [world, lessons] of Object.entries(c.lessons)) {
        const orders = lessons.map((l) => l.order).sort((a, b) => a - b);
        expect(orders, `${world} lesson order`).toEqual(
          lessons.map((_, i) => i + 1),
        );
      }
    }
  });

  it('gives every quiz question a correct answer', () => {
    // A question with no answer cannot be marked, so a pupil loses a mark for
    // an adult's typo.
    for (const c of ALL_COURSES) {
      for (const [world, blueprints] of Object.entries(c.quizzes)) {
        for (const bp of blueprints) {
          expect(
            bp.questions.length,
            `${bp.title} has no questions`,
          ).toBeGreaterThan(0);
          for (const q of bp.questions) {
            const where = `${world}/${bp.title}: "${q.prompt}"`;
            expect(
              q.correctAnswer,
              `${where} has no correctAnswer`,
            ).toBeTruthy();
            expect(q.explanation, `${where} has no explanation`).toBeTruthy();
            if (q.type === 'mcq') {
              expect(
                q.options?.length,
                `${where} has no options`,
              ).toBeGreaterThan(1);
              expect(
                q.options.includes(q.correctAnswer),
                `${where}: correctAnswer is not one of the options`,
              ).toBe(true);
            }
          }
        }
      }
    }
  });

  it('never puts the correct answer first in every multiple-choice question', () => {
    /**
     * A pupil who notices the answer is always option A can score well without
     * reading anything. The practice quizzes do not shuffle, so the authoring
     * has to vary the position itself.
     */
    for (const c of ALL_COURSES) {
      const mcqs = Object.values(c.quizzes)
        .flat()
        .flatMap((bp) => bp.questions)
        .filter((q) => q.type === 'mcq');

      const firstCount = mcqs.filter(
        (q) => q.options[0] === q.correctAnswer,
      ).length;
      const share = firstCount / mcqs.length;
      expect(
        share,
        `${c.slug}: ${Math.round(share * 100)}% of MCQ answers are option A`,
      ).toBeLessThan(0.75);
    }
  });

  it('keeps every HTML snippet’s tags balanced', () => {
    /**
     * The C course's snippets are compiled in CI, so broken C cannot ship. HTML
     * has no compiler here, and malformed markup would be taught in a lesson
     * whose whole subject is correct markup.
     *
     * A simple stack check: every non-void opening tag must be closed, in
     * order. Comments and attributes are stripped first.
     */
    const htmlCourse = ALL_COURSES.find((c) => c.slug === 'html');
    const problems = [];

    for (const [world, lessons] of Object.entries(htmlCourse.lessons)) {
      for (const l of lessons) {
        if (l.body.snippet.language !== 'html') continue;
        const code = l.body.snippet.lines
          .join('\n')
          .replace(/<!--[\s\S]*?-->/g, '');
        const stack = [];

        for (const match of code.matchAll(
          /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g,
        )) {
          const [full, name, selfClose] = match;
          const tag = name.toLowerCase();
          if (
            VOID_ELEMENTS.has(tag) ||
            selfClose === '/' ||
            full.startsWith('<!')
          )
            continue;

          if (full.startsWith('</')) {
            const open = stack.pop();
            if (open !== tag) {
              problems.push(
                `${world}/${l.title}: </${tag}> closes ${open || 'nothing'}`,
              );
            }
          } else {
            stack.push(tag);
          }
        }

        if (stack.length) {
          problems.push(
            `${world}/${l.title}: unclosed <${stack.join('>, <')}>`,
          );
        }
      }
    }

    expect(
      problems,
      `malformed HTML in lessons:\n${problems.join('\n')}`,
    ).toEqual([]);
  });

  it('closes no void element, since the lessons teach that rule', () => {
    // A lesson stating that <img> has no closing tag, containing </img>, would
    // be teaching against its own example.
    const htmlCourse = ALL_COURSES.find((c) => c.slug === 'html');
    for (const [world, lessons] of Object.entries(htmlCourse.lessons)) {
      for (const l of lessons) {
        const code = l.body.snippet.lines.join('\n');
        for (const tag of ['img', 'br', 'meta', 'input', 'hr']) {
          expect(
            code.includes(`</${tag}>`),
            `${world}/${l.title} closes the void element <${tag}>`,
          ).toBe(false);
        }
      }
    }
  });

  it('teaches towards the paper each course actually sits', () => {
    /**
     * HTML and AI sit the BUILD paper — 20 knowledge questions plus three
     * tasks worth 30, 30 and 40. Python and C sit the CODE paper. A course
     * teaching towards the wrong shape of assessment would be a curriculum
     * bug rather than a code one, so the kinds are pinned here.
     */
    const kindBySlug = Object.fromEntries(COURSES.map((c) => [c.slug, c.kind]));
    expect(kindBySlug).toEqual({
      // Not a paper at all. A games realm is passed by playing it, so
      // `courseReadiness` never reports `finalTestUnlocked` for one — which
      // matters, because a realm with no content otherwise reads as 0-of-0
      // and therefore complete.
      'cognitive-games': 'games',
      python: 'code',
      c: 'code',
      html: 'build',
      ai: 'build',
    });

    // And the build paper is the 20 + 30/30/40 shape those two teach towards.
    const build = BLUEPRINTS.build;
    expect(build.find((s) => s.id === 'knowledge').count).toBe(20);
    expect(build.find((s) => s.id === 'tasks').pointsEach).toBe(30);
    expect(build.find((s) => s.id === 'bigTask').pointsEach).toBe(40);
  });
});
