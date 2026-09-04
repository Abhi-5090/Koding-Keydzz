import mongoose from 'mongoose';
import { CHECK_KINDS } from '../services/taskGrader.js';
import { QUESTION_TYPES, DIFFICULTIES } from '../config/finalTest.js';
import { LANGUAGES } from '../config/courses.js';

/**
 * ONE QUESTION IN THE SUPERADMIN'S BANK.
 *
 * The bank is authored once, per course, by the platform owner. Final tests are
 * COMPOSED from it — a fresh draw per attempt, so a pupil retaking a test does
 * not see the same paper again. That is why questions live here rather than on
 * a test document: a test is a selection, not a container.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * -----------------------------
 * `points`. A question is worth what its blueprint SECTION is worth, not what
 * its author typed. Per-question marks would let one attempt total 200 and the
 * next 185 depending on the draw, so the 150 pass mark would mean something
 * different to each pupil. See config/finalTest.js.
 *
 * ANSWERS NEVER LEAVE THE SERVER
 * ------------------------------
 * `answerIndex`, `acceptedAnswers`, `testCases` and `expectedOutcome` are the
 * mark scheme. The student-facing serializer in services/finalTestService.js
 * strips every one of them; nothing here is safe to send to a pupil as-is.
 */

/** One hidden test case for a coding question. */
const testCaseSchema = new mongoose.Schema(
  {
    /** Fed to the program on stdin. Blank for questions that take no input. */
    stdin: { type: String, default: '' },
    /** Compared against stdout, trimmed, line by line. */
    expectedOutput: { type: String, required: true },
    /**
     * A visible case is shown to the pupil as an example. The rest are hidden,
     * so a solution has to generalise rather than print the one answer it was
     * shown.
     */
    visible: { type: Boolean, default: false },
  },
  { _id: false },
);

const questionSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    /** Denormalised so the bank can be filtered without a join. */
    courseSlug: { type: String, required: true, lowercase: true, index: true },

    type: { type: String, enum: QUESTION_TYPES, required: true, index: true },
    /**
     * `advanced` marks the single harder question in a section that carries
     * double marks — the thought-process coding question, and the larger
     * build task.
     */
    difficulty: {
      type: String,
      enum: DIFFICULTIES,
      default: 'basic',
      index: true,
    },

    prompt: { type: String, required: true, trim: true },
    /** Optional context shown above the prompt: a snippet, a diagram, a brief. */
    context: { type: String, default: '' },

    // ---- mcq ----
    options: { type: [String], default: [] },
    /** Index into `options`. MARK SCHEME — never sent to a pupil. */
    answerIndex: { type: Number, default: null },

    // ---- fillblank ----
    /**
     * Every spelling that counts as correct. MARK SCHEME.
     *
     * A list rather than one string because a child typing `True` should not
     * be marked wrong for `true`, and `3.0` should not fail against `3`.
     * Comparison is normalised (see finalTestService) but the author still has
     * to supply the genuine alternatives.
     */
    acceptedAnswers: { type: [String], default: [] },

    // ---- coding ----
    /**
     * Which language a coding answer is executed as.
     *
     * Denormalised from the course, like `courseSlug`: the grader only has the
     * question in hand when it runs a submission, and joining back to the
     * course for one string on every test case of every answer of every
     * attempt is a lot of queries for a value that cannot change.
     */
    language: { type: String, enum: LANGUAGES, default: 'python' },
    starterCode: { type: String, default: '' },
    /** MARK SCHEME. At least one is required for a coding question. */
    testCases: { type: [testCaseSchema], default: [] },

    // ---- task (HTML / AI) ----
    /**
     * What a correct submission achieves, in prose. MARK SCHEME.
     *
     * Used to grade the task — by a reviewer now, and by an LLM once that
     * integration lands. Kept as prose rather than a checklist because these
     * tasks are open-ended by design ("build a page that…").
     */
    expectedOutcome: { type: String, default: '' },

    /**
     * MACHINE-CHECKABLE CRITERIA for a `task` question.
     *
     * Without these a task cannot be marked automatically, and the build paper
     * (HTML and AI) becomes impossible to pass: its auto-markable questions
     * total 100 against a pass mark of 150. Each check is one objective thing
     * the work must contain; the award is the blueprint's points scaled by the
     * share of weight passed. See services/taskGrader.js.
     *
     * `weight` is RELATIVE ONLY. Points come from the blueprint, so no set of
     * checks can make a paper total more than 200.
     *
     * A task with no checks still grades as `needsReview` and waits for a
     * human — some work genuinely needs a person.
     */
    checks: {
      type: [
        new mongoose.Schema(
          {
            kind: { type: String, enum: CHECK_KINDS, required: true },
            /** What to look for: a string, a tag name, or a regex source. */
            value: { type: String, default: '' },
            /** For htmlTagWithAttr: the attribute that must be present. */
            attr: { type: String, default: '' },
            /** Minimum count, for htmlTag and minWords. */
            min: { type: Number, default: 1 },
            /** Relative importance. Defaults to 1. */
            weight: { type: Number, default: 1, min: 0.1 },
            /** Shown to the pupil when the check fails, so name it plainly. */
            label: { type: String, required: true },
            /** htmlTagWithAttr: accept an empty value such as alt="". */
            allowEmpty: { type: Boolean, default: false },
            flags: { type: String, default: '' },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    /**
     * OPT-IN to external grading for this task.
     *
     * Only meaningful alongside a configured validator — both are required.
     * Enabling it here sends the pupil's answer and this rubric to an outside
     * service, so it is per-question and off by default rather than a global
     * switch somebody forgets is on.
     */
    externalValidator: {
      enabled: { type: Boolean, default: false },
      /** What the grader should judge. Required when enabled. */
      rubric: { type: String, default: '' },
    },

    /** Free-text tags for the author's own filtering. Not used in grading. */
    tags: { type: [String], default: [] },

    /**
     * Inactive questions stay in the bank but are never drawn.
     *
     * Deleting a question that past attempts referenced would orphan those
     * records, so retiring one is a flag rather than a removal.
     */
    active: { type: Boolean, default: true, index: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

/** The draw query: active questions of a course, type and difficulty. */
questionSchema.index({ courseSlug: 1, type: 1, difficulty: 1, active: 1 });

/**
 * Reject a question that cannot be marked.
 *
 * A question with no mark scheme is worse than a missing question: it is drawn
 * into a real test and then scores every pupil zero, or crashes the grader
 * mid-exam. Caught on save, where the author can still fix it.
 */
/**
 * A QUESTION THAT CANNOT BE MARKED MUST NOT REACH THE BANK.
 *
 * It is worse than a missing question: it is drawn onto a real paper and then
 * cannot be marked, so a pupil loses marks for a mistake an adult made while
 * typing — on an attempt they cannot get back.
 *
 * Each problem is reported through `invalidate`, against the FIELD it belongs
 * to, rather than as one thrown Error. That matters for two reasons:
 *
 *   • A plain `Error` from a hook reaches the error handler unclassified and
 *     becomes a 500. The author then sees "something went wrong" instead of
 *     the sentence below telling them exactly what to fix — and a 500 also
 *     logs as a server fault, so a typo looks like an outage.
 *
 *   • Mongoose collects invalidations into a ValidationError, which the
 *     handler maps to 400 with a `details[]` of field/message pairs. That is
 *     the shape the portal's `formatApiError` reads to mark the offending
 *     field in the editor.
 */
questionSchema.pre('validate', function validateMarkScheme(next) {
  const cannotMark = (field, why) =>
    this.invalidate(field, `This question cannot be marked: ${why}`);

  if (this.type === 'mcq') {
    if (!Array.isArray(this.options) || this.options.length < 2) {
      cannotMark(
        'options',
        'a multiple-choice question needs at least two options',
      );
    }
    if (
      this.answerIndex == null ||
      !Number.isInteger(this.answerIndex) ||
      this.answerIndex < 0 ||
      this.answerIndex >= (this.options?.length || 0)
    ) {
      cannotMark('answerIndex', 'answerIndex must point at one of the options');
    }
  }

  if (this.type === 'fillblank') {
    const answers = (this.acceptedAnswers || []).filter((a) =>
      String(a).trim(),
    );
    if (answers.length === 0) {
      cannotMark(
        'acceptedAnswers',
        'a fill-in-the-blank question needs at least one accepted answer',
      );
    }
  }

  if (this.type === 'coding') {
    const cases = (this.testCases || []).filter((c) =>
      String(c.expectedOutput ?? '').trim(),
    );
    if (cases.length === 0) {
      cannotMark(
        'testCases',
        'a coding question needs at least one test case with expected output',
      );
    }
  }

  if (this.type === 'task') {
    /**
     * Each check must be answerable. A `contains` with no value, or an
     * `htmlTagWithAttr` with no attribute, silently passes every pupil — which
     * hands out marks for nothing and is harder to notice than a failure.
     */
    (this.checks || []).forEach((check, i) => {
      const needsValue = ['contains', 'notContains', 'regex', 'htmlTag', 'htmlTagWithAttr'];
      if (needsValue.includes(check.kind) && !String(check.value || '').trim()) {
        cannotMark(`checks.${i}.value`, `the "${check.label}" check has nothing to look for`);
      }
      if (check.kind === 'htmlTagWithAttr' && !String(check.attr || '').trim()) {
        cannotMark(`checks.${i}.attr`, `the "${check.label}" check names no attribute`);
      }
      if (check.kind === 'regex') {
        try {
          new RegExp(check.value, check.flags || 'i');
        } catch {
          cannotMark(`checks.${i}.value`, `the "${check.label}" check is not a valid pattern`);
        }
      }
    });
  }

  if (this.type === 'task' && this.externalValidator?.enabled) {
    // Grading against no rubric would be arbitrary, so an author cannot enable
    // external validation without saying what to judge.
    if (!String(this.externalValidator.rubric || '').trim()) {
      cannotMark(
        'externalValidator.rubric',
        'external grading is enabled but no rubric was given'
      );
    }
  }

  if (this.type === 'task' && !String(this.expectedOutcome || '').trim()) {
    cannotMark(
      'expectedOutcome',
      'a task needs an expected outcome, or it cannot be graded',
    );
  }

  return next();
});

export const Question = mongoose.model('Question', questionSchema);
export default Question;
