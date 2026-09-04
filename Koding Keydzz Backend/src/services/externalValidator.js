import { env } from '../config/env.js';

/**
 * EXTERNAL TASK VALIDATION — grading open work with an outside service.
 *
 * Some tasks cannot be graded by structural checks. "Explain why you chose this
 * layout" has no tag to look for; judging it needs a reader. An external
 * grading service (an LLM, or a school's own marking API) can do that, and this
 * is the integration point.
 *
 * TWO KEYS, SAME AS CODE EXECUTION
 * --------------------------------
 * Sending a child's examined work to a third party is a decision, not a
 * fallback. It requires BOTH:
 *
 *   1. THE OPERATOR configured a validator — `TASK_VALIDATOR_URL` and
 *      `TASK_VALIDATOR_API_KEY` are set;
 *   2. THE QUESTION opted in — its `externalValidator.enabled` is true, with a
 *      rubric the author wrote.
 *
 * Neither alone is enough. This mirrors the rule added to code execution after
 * finding that exam answers could reach Piston by default, and for the same
 * reason: the safe path has to be what you get by doing nothing.
 *
 * WHAT IS SENT
 * ------------
 * The rubric, the prompt and the pupil's answer. Never a name, an id, an email,
 * a school, or anything else about the child. The grader is told what to judge
 * and nothing about whom.
 *
 * FAILURE NEVER COSTS A PUPIL MARKS
 * ---------------------------------
 * A timeout, a bad response, a service outage or a malformed score all return
 * `unavailable`, and the caller flags the answer for a human. Scoring 0 for a
 * network problem would fail a child for something they could not affect; and
 * scoring full marks would make the task decorative.
 */

/** How long to wait. An exam submission is synchronous — a pupil is watching. */
const TIMEOUT_MS = 12_000;

/**
 * The configured endpoint and key, read AT CALL TIME.
 *
 * Deliberately not captured at import: reading them when they are used means
 * an operator can turn this on or off without a code change, and it makes the
 * two-key rule directly testable. `env` is still the source of the validated
 * defaults; process.env wins so a deployment can override.
 */
function config() {
  return {
    url: process.env.TASK_VALIDATOR_URL || env.taskValidatorUrl || '',
    key: process.env.TASK_VALIDATOR_API_KEY || env.taskValidatorApiKey || '',
  };
}

/** Is a validator configured at all? */
export function isConfigured() {
  const { url, key } = config();
  return Boolean(url && key);
}

/**
 * Does this question want external grading, and may it have it?
 *
 * Both halves, in one place, so no call site can accidentally check only one.
 */
export function shouldValidateExternally(question) {
  return Boolean(isConfigured() && question?.externalValidator?.enabled);
}

/**
 * Grade one answer against its rubric.
 *
 * @returns {Promise<{ ok: boolean, fraction?: number, feedback?: string, reason?: string }>}
 *   `ok: false` means "could not grade" — never "scored zero".
 */
export async function validate({ question, response }) {
  if (!shouldValidateExternally(question)) {
    return { ok: false, reason: 'not-enabled' };
  }

  const rubric = String(question.externalValidator?.rubric || '').trim();
  if (!rubric) {
    // An author enabled it without saying what to judge. Refusing is right:
    // grading against no rubric would be arbitrary.
    return { ok: false, reason: 'no-rubric' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const { url, key } = config();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      /**
       * Nothing identifying is sent. The grader judges the WORK.
       *
       * `maxFraction` is not sent either — the marks are the blueprint's
       * business and are applied on this side, so a compromised or
       * misconfigured grader cannot award more than the question is worth.
       */
      body: JSON.stringify({
        rubric,
        prompt: String(question.prompt || ''),
        answer: String(response ?? ''),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, reason: `http-${res.status}` };
    }

    const data = await res.json();

    /**
     * The score must be a fraction between 0 and 1, and is CLAMPED.
     *
     * A grader returning 1.4, "excellent", or null must not become 140% of the
     * marks or NaN. Validating the response shape here is the difference
     * between an integration and a trust relationship.
     */
    const raw = Number(data?.score);
    if (!Number.isFinite(raw)) {
      return { ok: false, reason: 'bad-score' };
    }
    const fraction = Math.max(0, Math.min(1, raw));

    return {
      ok: true,
      fraction,
      feedback: typeof data?.feedback === 'string' ? data.feedback.slice(0, 1000) : '',
    };
  } catch (err) {
    // Includes the abort on timeout. Deliberately indistinguishable to the
    // caller: every failure mode ends in "a human should look at this".
    return {
      ok: false,
      reason: err?.name === 'AbortError' ? 'timeout' : 'unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}

export default { isConfigured, shouldValidateExternally, validate };
