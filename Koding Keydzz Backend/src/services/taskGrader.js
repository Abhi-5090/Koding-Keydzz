/**
 * GRADING AN OPEN-ENDED TASK.
 *
 * The HTML and AI courses sit a "build" paper: 20 knowledge questions worth 100
 * marks, plus three tasks worth 30, 30 and 40. Tasks used to award zero and set
 * `needsReview`, on the reasoning that open work cannot be auto-marked.
 *
 * That made both courses IMPOSSIBLE TO PASS. Auto-markable marks totalled 100
 * against a pass mark of 150, and no endpoint existed for a teacher to mark the
 * rest — so `needsReview` was a state nothing could ever clear.
 *
 * THE FIX: MACHINE-CHECKABLE CRITERIA
 * -----------------------------------
 * A task question carries `checks` — a list of specific, objective things the
 * submitted work must contain. "Uses a <header> element", "every <img> has an
 * alt attribute", "sets a flex-direction". Each check has a weight, and the
 * award is the blueprint's points scaled by the share of weight passed.
 *
 * This is not a compromise. It is how a marking rubric works, and it has three
 * properties a human marker does not:
 *   • it is identical for every pupil;
 *   • it is instant, so a child learns while they still care;
 *   • it can be shown to them as feedback, naming what was missing.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It does not judge quality, elegance or intent. A task with no `checks` still
 * returns `needsReview` and awaits a human — that path stays, because some work
 * genuinely needs a person, and pretending otherwise would be worse than
 * admitting it. See adminService's marking surface for how a human resolves it.
 *
 * POINTS COME FROM THE BLUEPRINT, NOT FROM THE CHECKS. Check weights are
 * relative only, so an author cannot accidentally make a paper total 210.
 */

import {
  shouldValidateExternally,
  validate as validateExternally,
} from './externalValidator.js';

/** The kinds of check a task question may carry. */
export const CHECK_KINDS = [
  'contains',
  'notContains',
  'regex',
  'htmlTag',
  'htmlTagWithAttr',
  'minWords',
];

/* -------------------------------------------------------------------------- */
/* HTML inspection                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Strip comments before looking for tags.
 *
 * Otherwise a pupil earns the "uses a <nav>" mark by writing
 * `<!-- <nav> goes here -->`, which is the first thing anyone tries.
 */
function withoutComments(html) {
  return String(html || '').replace(/<!--[\s\S]*?-->/g, '');
}

/** Every opening tag of `name`, with its raw attribute text. */
function findTags(html, name) {
  const pattern = new RegExp(`<${name}\\b([^>]*)>`, 'gi');
  return [...withoutComments(html).matchAll(pattern)].map((m) => m[1] || '');
}

/**
 * Does an attribute appear, with a NON-EMPTY value?
 *
 * Emptiness matters for the case this exists to check: `alt=""` is legitimate
 * on a decorative image, but a task asking for descriptive alt text is not
 * satisfied by it. Authors who want to allow empty values say so with
 * `allowEmpty`.
 */
function hasAttribute(attrText, attr, allowEmpty = false) {
  const match = new RegExp(`\\b${attr}\\s*=\\s*(".*?"|'.*?'|[^\\s>]+)`, 'i').exec(attrText);
  if (!match) return false;
  if (allowEmpty) return true;
  const value = match[1].replace(/^['"]|['"]$/g, '').trim();
  return value !== '';
}

/* -------------------------------------------------------------------------- */
/* Running one check                                                          */
/* -------------------------------------------------------------------------- */

/**
 * @returns {{ passed: boolean, label: string }}
 */
export function runCheck(check, answer) {
  const text = String(answer ?? '');
  const label = check.label || check.kind;

  switch (check.kind) {
    case 'contains': {
      // Case-insensitive: a pupil writing FLEX or Flex has met the requirement.
      const needle = String(check.value ?? '');
      return { passed: needle !== '' && text.toLowerCase().includes(needle.toLowerCase()), label };
    }

    case 'notContains': {
      const needle = String(check.value ?? '');
      return { passed: needle === '' || !text.toLowerCase().includes(needle.toLowerCase()), label };
    }

    case 'regex': {
      try {
        return { passed: new RegExp(check.value, check.flags || 'i').test(text), label };
      } catch {
        // A malformed pattern is the author's error. Failing the pupil for it
        // would be unjust, so it passes and the question is flagged instead.
        return { passed: true, label, authorError: true };
      }
    }

    case 'htmlTag': {
      const min = Number.isFinite(check.min) ? check.min : 1;
      return { passed: findTags(text, check.value).length >= min, label };
    }

    case 'htmlTagWithAttr': {
      /**
       * EVERY occurrence must carry the attribute, and there must be at least
       * one occurrence.
       *
       * "All" rather than "any" on purpose: the point of "every image has alt
       * text" is that no image lacks it. An `any` reading would pass work with
       * one described image and nine undescribed ones — which is the actual
       * accessibility failure the task is teaching against.
       */
      const tags = findTags(text, check.value);
      if (tags.length === 0) return { passed: false, label };
      return {
        passed: tags.every((attrs) => hasAttribute(attrs, check.attr, check.allowEmpty)),
        label,
      };
    }

    case 'minWords': {
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      return { passed: words >= (check.min || 1), label };
    }

    default:
      // An unknown kind is an author error, not a pupil error.
      return { passed: true, label, authorError: true };
  }
}

/* -------------------------------------------------------------------------- */
/* Grading a whole task                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Mark one task answer.
 *
 * @param {{ checks?: Array, expectedOutcome?: string }} question
 * @param {*} response  what the pupil submitted
 * @param {number} points  the blueprint's marks for this question
 */
export async function gradeTask({ question, response, points }) {
  const submitted = String(response ?? '').trim();

  if (!submitted) {
    return {
      awarded: 0,
      correct: false,
      feedback: 'Nothing submitted for this task.',
      breakdown: [],
    };
  }

  const checks = Array.isArray(question.checks) ? question.checks : [];

  /**
   * EXTERNAL GRADING, when the question opted in and a validator is configured.
   *
   * Tried before the structural checks because a task that wants a reader
   * usually has no useful structure to check — "explain your choices" has no
   * tag to look for. If it succeeds, that is the mark.
   *
   * Every failure mode (timeout, outage, malformed score, no rubric) falls
   * through to the checks below and then to `needsReview`. A pupil is never
   * penalised for an integration problem.
   */
  if (shouldValidateExternally(question)) {
    const verdict = await validateExternally({ question, response: submitted });
    if (verdict.ok) {
      const awarded = Math.min(points, Math.round(verdict.fraction * points));
      return {
        awarded,
        correct: awarded >= points,
        // Flagged when the grader gave partial credit with no explanation, so
        // a pupil is never left with an unexplained mark on open work.
        needsReview: awarded < points && !verdict.feedback,
        feedback:
          verdict.feedback || `${awarded} of ${points}, graded against the task's rubric.`,
        breakdown: [],
        gradedExternally: true,
      };
    }
  }

  /**
   * NO CHECKS MEANS A HUMAN MUST LOOK.
   *
   * Withheld rather than guessed: awarding 0 fails a pupil for work nobody
   * read, and awarding full marks makes the task decorative. `needsReview`
   * puts it in the marking queue, where a teacher resolves it.
   */
  if (checks.length === 0) {
    return {
      awarded: 0,
      correct: false,
      needsReview: true,
      feedback: 'Submitted — a teacher will mark this task.',
      breakdown: [],
    };
  }

  const results = checks.map((check) => ({
    ...runCheck(check, submitted),
    weight: Number.isFinite(check.weight) && check.weight > 0 ? check.weight : 1,
  }));

  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
  const passedWeight = results
    .filter((r) => r.passed)
    .reduce((sum, r) => sum + r.weight, 0);

  // Rounded to a whole mark, and never above the blueprint's allowance —
  // a paper must still total exactly 200.
  const awarded = totalWeight === 0 ? 0 : Math.min(points, Math.round((passedWeight / totalWeight) * points));

  const missed = results.filter((r) => !r.passed).map((r) => r.label);
  const authorErrors = results.filter((r) => r.authorError).length;

  return {
    awarded,
    correct: awarded >= points,
    // A task where the author's own criteria could not be evaluated is flagged
    // for a human, even though the pupil was not penalised for it.
    needsReview: authorErrors > 0,
    /**
     * Feedback NAMES what was missing.
     *
     * This is the whole educational argument for auto-marking a build task:
     * "you scored 20 of 30; the page had no <nav> and one image without alt
     * text" teaches something. A silent mark does not.
     */
    feedback: missed.length
      ? `${awarded} of ${points}. Still needed: ${missed.join('; ')}.`
      : `All criteria met — ${awarded} of ${points}.`,
    breakdown: results.map((r) => ({ label: r.label, passed: r.passed })),
  };
}

export default { gradeTask, runCheck, CHECK_KINDS };
