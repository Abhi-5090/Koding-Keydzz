import { describe, it, expect } from 'vitest';
import { C_WORLDS, C_LESSON_CONTENT } from '../src/seed/cCourse.js';
import { runCode, availableRunners } from '../src/services/codeExecutionService.js';

/**
 * THE C COURSE'S OWN CODE MUST COMPILE.
 *
 * Every lesson shows a snippet and hands the pupil a starter program. If any of
 * them does not build, the platform is teaching broken C — and it does so
 * silently, because nothing else in the system ever compiles lesson content.
 * A child would meet the error, assume they had mistyped, and lose the thread
 * of the lesson.
 *
 * So the content is compiled here, with the platform's OWN compiler and the
 * same `-std=c11` flags the runner uses. A lesson that showed code this
 * platform rejects would be wrong twice over.
 *
 * One starter is deliberately broken — see DELIBERATELY_BROKEN below.
 */

const hasCompiler = Boolean(availableRunners().c);

/**
 * Starters that are SUPPOSED to fail to compile.
 *
 * "What the Compiler Does" teaches a pupil to read a compiler error, so its
 * starter has a missing semicolon on purpose and its challenge is to fix it.
 * Listed explicitly rather than skipped by a pattern, so a snippet that breaks
 * by accident can never hide in here.
 */
const DELIBERATELY_BROKEN = new Set(['What the Compiler Does::tryIt']);

/** Every compilable fragment in the course, flattened. */
function fragments() {
  const out = [];
  for (const [world, lessons] of Object.entries(C_LESSON_CONTENT)) {
    for (const lesson of lessons) {
      const snippet = (lesson.body.snippet?.lines || []).join('\n');
      if (snippet.trim()) {
        out.push({ world, title: lesson.title, kind: 'snippet', code: snippet });
      }
      const starter = lesson.body.tryIt?.starter || '';
      if (starter.trim()) {
        out.push({ world, title: lesson.title, kind: 'tryIt', code: starter });
      }
    }
  }
  return out;
}

describe('the C course content', () => {
  it('covers five worlds in ladder order, after Python’s five', () => {
    expect(C_WORLDS).toHaveLength(5);
    // Orders 6-10: appended rather than renumbering Python's existing worlds,
    // which would rewrite content pupils are already partway through.
    expect(C_WORLDS.map((w) => w.order)).toEqual([6, 7, 8, 9, 10]);
  });

  it('prefixes every world slug, so it can never collide with Python’s', () => {
    // World slugs are globally unique in the database. A C world called
    // 'workshop' would be one careless Python world away from a clash that
    // only shows up as a duplicate-key error during a seed.
    for (const w of C_WORLDS) {
      expect(w.slug.startsWith('c-'), `"${w.slug}" is not prefixed`).toBe(true);
    }
    expect(new Set(C_WORLDS.map((w) => w.slug)).size).toBe(5);
  });

  it('has lesson content for every world, and no orphan content', () => {
    // A world with no lessons reads as 0-of-0 to the readiness check, which
    // counts as COMPLETE — the exact bug that shipped on the Python ladder.
    const worldSlugs = C_WORLDS.map((w) => w.slug).sort();
    expect(Object.keys(C_LESSON_CONTENT).sort()).toEqual(worldSlugs);

    for (const slug of worldSlugs) {
      expect(C_LESSON_CONTENT[slug].length, `${slug} has no lessons`).toBeGreaterThan(0);
    }
  });

  it('gives every lesson the parts the renderer draws', () => {
    for (const [world, lessons] of Object.entries(C_LESSON_CONTENT)) {
      for (const l of lessons) {
        const where = `${world}/${l.title}`;
        expect(l.title, `${where}: no title`).toBeTruthy();
        expect(l.language, `${where}: wrong language`).toBe('c');
        expect(l.body.tagline, `${where}: no tagline`).toBeTruthy();
        expect(l.body.intro, `${where}: no intro`).toBeTruthy();
        expect(l.body.sections?.length, `${where}: no sections`).toBeGreaterThan(0);
        expect(l.body.takeaways?.length, `${where}: no takeaways`).toBeGreaterThan(0);
        expect(l.body.guide?.length, `${where}: no guide`).toBeGreaterThan(0);
        expect(l.body.tryIt?.challenge, `${where}: no challenge`).toBeTruthy();
      }
    }
  });

  it('numbers lessons from 1 within each world', () => {
    for (const [world, lessons] of Object.entries(C_LESSON_CONTENT)) {
      const orders = lessons.map((l) => l.order).sort((a, b) => a - b);
      expect(orders, `${world} lesson order`).toEqual(
        lessons.map((_, i) => i + 1)
      );
    }
  });

  it.skipIf(!hasCompiler)(
    'compiles every snippet and starter with the platform’s own compiler',
    async () => {
      /**
       * The test that earns its runtime.
       *
       * Compiled with the same toolchain and flags the runner uses, so a
       * snippet cannot be correct in the lesson and rejected in the exercise.
       */
      const broken = [];

      for (const f of fragments()) {
        const key = `${f.title}::${f.kind}`;
        const res = await runCode({ language: 'c', code: f.code });
        const shouldFail = DELIBERATELY_BROKEN.has(key);

        if (shouldFail) {
          // A starter that is meant to teach error-reading must actually fail.
          // If someone "fixes" it, the lesson's whole challenge evaporates.
          expect(
            res.compileFailed,
            `${key} is listed as deliberately broken but now compiles`
          ).toBe(true);
          continue;
        }

        if (res.compileFailed) {
          broken.push(`${f.world}/${key}: ${(res.stderr || '').split('\n')[0]}`);
        }
      }

      expect(broken, `lesson code that does not compile:\n${broken.join('\n')}`).toEqual([]);
    },
    120_000
  );

  it.skipIf(!hasCompiler)('runs every snippet without crashing', async () => {
    /**
     * Compiling is not enough — a snippet that builds and then segfaults would
     * be shown to pupils as exemplary code. Runtime failure is checked apart
     * from compile failure because it is a different kind of wrong.
     *
     * Snippets are fed STDIN. Several of them demonstrate scanf, and a correct
     * scanf program given no input rightly reports "that was not a number" and
     * exits non-zero — so running them dry would flag good teaching code as
     * broken. (That is exactly what this test did on first run.)
     *
     * Starters are excluded: a starter is an unfinished exercise and is
     * allowed to be incomplete.
     */
    const STDIN = '7\n11\n';
    const crashed = [];

    for (const f of fragments().filter((x) => x.kind === 'snippet')) {
      const res = await runCode({ language: 'c', code: f.code, stdin: STDIN });
      if (res.compileFailed) continue; // reported by the test above
      if (res.exitCode !== 0) {
        crashed.push(
          `${f.world}/${f.title}: exit ${res.exitCode} ${(res.stderr || '').slice(0, 120)}`
        );
      }
    }

    expect(crashed, `snippets that fail at runtime:\n${crashed.join('\n')}`).toEqual([]);
  }, 120_000);
});
