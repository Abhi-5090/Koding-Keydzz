import { FINAL_TEST_PASS_MARK, FINAL_TEST_TOTAL } from './courses.js';

/**
 * THE FINAL TEST BLUEPRINTS.
 *
 * Every course ends in a 200-point test; 150 passes. There are two shapes,
 * chosen by the course's `kind`:
 *
 *   code  (Python, C)      knowledge + coding questions run against test cases
 *   build (HTML/CSS, AI)   knowledge + build tasks graded against an outcome
 *
 * WHY THE POINTS LIVE HERE AND NOT ON EACH QUESTION
 * -------------------------------------------------
 * A question is worth what its SECTION is worth, not what its author typed.
 * Per-question points would let one attempt total 200 and the next 185 purely
 * because of which questions were drawn — so two pupils sitting "the same"
 * test would be marked against different denominators, and the 150 pass mark
 * would mean different things to each of them.
 *
 * The blueprint fixes the denominator. `assertBlueprintTotals()` is called at
 * module load, so a blueprint that does not add to 200 fails at boot rather
 * than at the end of a child's exam.
 */

/**
 * A section is `{ id, label, type, difficulty?, count, pointsEach }`.
 *
 * `type` may be an array — the build test's knowledge section mixes multiple
 * choice and fill-in-the-blank in one 20-question pool, which is how it was
 * specified.
 *
 * `difficulty` splits the coding and task sections: three straightforward
 * questions and one harder one that asks for a thought process, weighted twice
 * as heavily.
 */
export const BLUEPRINTS = {
  code: [
    {
      id: 'mcq',
      label: 'Multiple choice',
      type: 'mcq',
      count: 10,
      pointsEach: 5,
      instructions: 'Choose the one correct answer.',
    },
    {
      id: 'fillblank',
      label: 'Fill in the blank',
      type: 'fillblank',
      count: 10,
      pointsEach: 5,
      instructions: 'Type the missing word or value.',
    },
    {
      id: 'coding',
      label: 'Coding',
      type: 'coding',
      difficulty: 'basic',
      count: 3,
      pointsEach: 20,
      instructions: 'Write code that produces the expected output.',
    },
    {
      id: 'thinking',
      label: 'Problem solving',
      type: 'coding',
      difficulty: 'advanced',
      count: 1,
      pointsEach: 40,
      instructions:
        'A harder problem. Think it through before you start — this one is worth the most.',
    },
  ],

  build: [
    {
      id: 'knowledge',
      label: 'Knowledge',
      // One pool of 20 mixing both question styles, as specified.
      type: ['mcq', 'fillblank'],
      count: 20,
      pointsEach: 5,
      instructions: 'Answer each question.',
    },
    {
      id: 'tasks',
      label: 'Build tasks',
      type: 'task',
      difficulty: 'basic',
      count: 2,
      pointsEach: 30,
      instructions: 'Build what each task asks for.',
    },
    {
      id: 'bigTask',
      label: 'Final build',
      type: 'task',
      difficulty: 'advanced',
      count: 1,
      pointsEach: 40,
      instructions: 'A larger build. Take your time — this one is worth the most.',
    },
  ],
};

/** Every question type the bank can hold. */
export const QUESTION_TYPES = ['mcq', 'fillblank', 'coding', 'task'];

/**
 * `basic` is the default weight; `advanced` marks the single harder question
 * in a section that carries double marks.
 */
export const DIFFICULTIES = ['basic', 'advanced'];

/** How a section's answers are marked. */
export const GRADING = {
  mcq: 'exact',        // the chosen option index must match
  fillblank: 'text',   // normalised text against a list of accepted answers
  coding: 'tests',     // executed against hidden test cases
  task: 'review',      // graded against a stored expected outcome
};

/** The total a blueprint adds up to. */
export function blueprintTotal(kind) {
  const sections = BLUEPRINTS[kind];
  if (!sections) return 0;
  return sections.reduce((sum, s) => sum + s.count * s.pointsEach, 0);
}

/** How many questions a blueprint needs in total. */
export function blueprintQuestionCount(kind) {
  const sections = BLUEPRINTS[kind];
  if (!sections) return 0;
  return sections.reduce((sum, s) => sum + s.count, 0);
}

/**
 * Fail at BOOT if a blueprint does not add up to the advertised total.
 *
 * This is the one invariant the whole test rests on: the pass mark is an
 * absolute score, so a blueprint totalling 185 silently makes the test harder
 * for everyone who sits it, and one totalling 215 makes it easier. Neither is
 * visible from the outside — a pupil just sees a mark.
 *
 * Checking at load means a bad edit cannot reach a child's exam.
 */
export function assertBlueprintTotals() {
  const problems = [];
  for (const kind of Object.keys(BLUEPRINTS)) {
    const total = blueprintTotal(kind);
    if (total !== FINAL_TEST_TOTAL) {
      problems.push(
        `blueprint "${kind}" totals ${total}, expected ${FINAL_TEST_TOTAL} ` +
          `(sections: ${BLUEPRINTS[kind]
            .map((s) => `${s.count}x${s.pointsEach}=${s.count * s.pointsEach}`)
            .join(' + ')})`
      );
    }
  }
  if (FINAL_TEST_PASS_MARK >= FINAL_TEST_TOTAL) {
    problems.push(
      `pass mark ${FINAL_TEST_PASS_MARK} is not below the total ${FINAL_TEST_TOTAL} — nobody could pass`
    );
  }
  if (problems.length) {
    throw new Error(`Final-test blueprint is invalid:\n  - ${problems.join('\n  - ')}`);
  }
  return true;
}

assertBlueprintTotals();

/** The blueprint for a course, by its `kind`. */
export function blueprintFor(kind) {
  const sections = BLUEPRINTS[kind];
  if (!sections) throw new Error(`No final-test blueprint for course kind "${kind}"`);
  return sections;
}

/** Section types as an array, whether the blueprint declared one or many. */
export const sectionTypes = (section) =>
  Array.isArray(section.type) ? section.type : [section.type];

export default {
  BLUEPRINTS,
  QUESTION_TYPES,
  DIFFICULTIES,
  GRADING,
  blueprintFor,
  blueprintTotal,
  blueprintQuestionCount,
  assertBlueprintTotals,
  sectionTypes,
};
