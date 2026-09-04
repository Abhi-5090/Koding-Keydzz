import { describe, it, expect } from 'vitest';
import {
  BLUEPRINTS,
  QUESTION_TYPES,
  blueprintFor,
  blueprintTotal,
  blueprintQuestionCount,
  assertBlueprintTotals,
  sectionTypes,
} from '../src/config/finalTest.js';
import {
  COURSES,
  FINAL_TEST_PASS_MARK,
  FINAL_TEST_TOTAL,
} from '../src/config/courses.js';

/**
 * THE BLUEPRINT ARITHMETIC.
 *
 * The pass mark is an ABSOLUTE score, not a percentage of whatever the paper
 * happened to total. So a blueprint that adds to 185 silently makes the test
 * harder for everyone who sits it, and one that adds to 215 makes it easier —
 * and neither is visible from the outside. A pupil just sees a mark.
 *
 * These are cheap checks on the one invariant the whole exam rests on.
 */

describe('every blueprint totals exactly 200', () => {
  it.each(Object.keys(BLUEPRINTS))('%s adds up', (kind) => {
    expect(blueprintTotal(kind)).toBe(FINAL_TEST_TOTAL);
  });

  it('the boot assertion accepts the shipped blueprints', () => {
    // Called at module load, so a bad edit fails at boot rather than at the
    // end of a child's exam.
    expect(assertBlueprintTotals()).toBe(true);
  });

  it('matches the specified code paper: 10 + 10 + 3x20 + 1x40', () => {
    const s = Object.fromEntries(BLUEPRINTS.code.map((x) => [x.id, x]));
    expect(s.mcq).toMatchObject({ count: 10, pointsEach: 5 });
    expect(s.fillblank).toMatchObject({ count: 10, pointsEach: 5 });
    expect(s.coding).toMatchObject({ count: 3, pointsEach: 20, difficulty: 'basic' });
    expect(s.thinking).toMatchObject({ count: 1, pointsEach: 40, difficulty: 'advanced' });
    expect(10 * 5 + 10 * 5 + 3 * 20 + 1 * 40).toBe(200);
  });

  it('matches the specified build paper: 20 knowledge + 2x30 + 1x40', () => {
    const s = Object.fromEntries(BLUEPRINTS.build.map((x) => [x.id, x]));
    expect(s.knowledge).toMatchObject({ count: 20, pointsEach: 5 });
    expect(s.tasks).toMatchObject({ count: 2, pointsEach: 30, difficulty: 'basic' });
    expect(s.bigTask).toMatchObject({ count: 1, pointsEach: 40, difficulty: 'advanced' });
    expect(20 * 5 + 2 * 30 + 1 * 40).toBe(200);
  });

  it('the pass mark is three quarters of the paper', () => {
    expect(FINAL_TEST_PASS_MARK).toBe(150);
    expect(FINAL_TEST_PASS_MARK / FINAL_TEST_TOTAL).toBe(0.75);
  });
});

describe('every course maps to a blueprint', () => {
  it.each(COURSES.map((c) => [c.slug, c.kind]))(
    '%s uses the %s paper',
    (_slug, kind) => {
      expect(() => blueprintFor(kind)).not.toThrow();
      expect(blueprintTotal(kind)).toBe(FINAL_TEST_TOTAL);
    }
  );

  it('throws loudly for a course kind with no blueprint', () => {
    // Better than silently drawing an empty paper worth zero.
    expect(() => blueprintFor('essay')).toThrow(/no final-test blueprint/i);
  });
});

describe('blueprint sections are well formed', () => {
  const allSections = Object.entries(BLUEPRINTS).flatMap(([kind, secs]) =>
    secs.map((s) => [`${kind}.${s.id}`, s])
  );

  it.each(allSections)('%s declares a real question type', (_name, section) => {
    for (const type of sectionTypes(section)) {
      expect(QUESTION_TYPES, `unknown type "${type}"`).toContain(type);
    }
  });

  it.each(allSections)('%s asks for at least one question worth at least one mark', (_n, s) => {
    expect(s.count).toBeGreaterThanOrEqual(1);
    expect(s.pointsEach).toBeGreaterThanOrEqual(1);
  });

  it.each(allSections)('%s tells the pupil what to do', (_n, s) => {
    // The instruction is shown above the section. A blank one leaves a child
    // guessing what kind of answer is wanted.
    expect(s.label).toBeTruthy();
    expect(s.instructions).toBeTruthy();
  });

  it('gives each section a unique id within its paper', () => {
    for (const [kind, secs] of Object.entries(BLUEPRINTS)) {
      const ids = secs.map((s) => s.id);
      expect(new Set(ids).size, `${kind} has duplicate section ids`).toBe(ids.length);
    }
  });

  it('weights the one advanced question above the basic ones', () => {
    // The thought-process question and the larger build task are the point of
    // having two difficulties; equal weighting would make the split cosmetic.
    for (const [kind, secs] of Object.entries(BLUEPRINTS)) {
      const advanced = secs.filter((s) => s.difficulty === 'advanced');
      const basic = secs.filter((s) => s.difficulty === 'basic');
      if (!advanced.length || !basic.length) continue;
      const maxBasic = Math.max(...basic.map((s) => s.pointsEach));
      for (const a of advanced) {
        expect(a.pointsEach, `${kind}.${a.id}`).toBeGreaterThan(maxBasic);
      }
    }
  });
});

describe('paper sizes are sane for a child', () => {
  it.each(Object.keys(BLUEPRINTS))('%s asks a reasonable number of questions', (kind) => {
    const n = blueprintQuestionCount(kind);
    // 24 and 23 as specified. A guard rather than a restatement: a blueprint
    // edit that ballooned a paper to 60 questions would pass the totals check
    // by dropping the points per question, and nothing else would notice.
    expect(n).toBeGreaterThanOrEqual(10);
    expect(n).toBeLessThanOrEqual(30);
  });
});
