import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { gradeTask } from '../src/services/taskGrader.js';
import * as validator from '../src/services/externalValidator.js';

/**
 * EXTERNAL TASK GRADING.
 *
 * Sending a child's examined work to a third party is the most consequential
 * thing in this codebase after wiping a database, so the tests here are almost
 * entirely about what must NOT happen:
 *
 *   • it must not happen by default;
 *   • it must not happen because one of the two keys is set;
 *   • it must not send anything identifying about the pupil;
 *   • it must not be able to award more than the question is worth;
 *   • and its failure must never cost a pupil marks.
 *
 * That last one is the reason every failure path is tested individually: a
 * grader that fails closed (scoring 0) would fail children for an outage.
 */

const RUBRIC = { enabled: true, rubric: 'Judge whether the explanation is clear.' };

describe('when external grading may happen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TASK_VALIDATOR_URL;
    delete process.env.TASK_VALIDATOR_API_KEY;
  });

  it('is NOT configured by default', () => {
    // The safe path is what you get by doing nothing.
    expect(validator.isConfigured()).toBe(false);
  });

  it('does not call out when only the question opted in', async () => {
    /**
     * One key is not enough. An author enabling it on a question must not be
     * able to start sending work off the machine — that is the operator's
     * decision.
     */
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const verdict = await validator.validate({
      question: { prompt: 'p', externalValidator: RUBRIC },
      response: 'my work',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('not-enabled');
  });

  it('does not call out when only the operator configured it', async () => {
    // The other key. A configured validator must not grade questions that
    // never asked for it.
    process.env.TASK_VALIDATOR_URL = 'https://grader.example/score';
    process.env.TASK_VALIDATOR_API_KEY = 'k'.repeat(20);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await validator.validate({
      question: { prompt: 'p', externalValidator: { enabled: false, rubric: 'x' } },
      response: 'my work',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

/**
 * The grading path, with a stubbed transport.
 *
 * `shouldValidateExternally` is stubbed rather than the env, because the point
 * under test is what happens once both keys are turned — not how they are read.
 */
describe('grading through an external validator', () => {
  let fetchMock;

  beforeEach(() => {
    // Both keys turned: the operator's config, and each question opts in via
    // its own `externalValidator.enabled` below.
    process.env.TASK_VALIDATOR_URL = 'https://grader.example/score';
    process.env.TASK_VALIDATOR_API_KEY = 'k'.repeat(20);
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TASK_VALIDATOR_URL;
    delete process.env.TASK_VALIDATOR_API_KEY;
  });

  const ok = (body) => ({
    ok: true,
    status: 200,
    json: async () => body,
  });

  it('sends the rubric, prompt and answer — and NOTHING about the pupil', async () => {
    /**
     * The privacy property. The grader is told what to judge and nothing about
     * whom, so a compromised or chatty service cannot learn who is being
     * examined.
     */
    fetchMock.mockResolvedValue(ok({ score: 1, feedback: 'Clear.' }));

    await validator.validate({
      question: { prompt: 'Explain your layout', externalValidator: RUBRIC },
      response: 'I used flexbox because...',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(Object.keys(body).sort()).toEqual(['answer', 'prompt', 'rubric']);
    // No pupil, no school, no marks allowance.
    for (const forbidden of ['name', 'email', 'userId', 'user', 'org', 'points', 'maxFraction']) {
      expect(body, `sent "${forbidden}" to the grader`).not.toHaveProperty(forbidden);
    }
  });

  it('scales the grader’s fraction by the blueprint’s points', async () => {
    // Marks come from this side. The grader returns a fraction only.
    fetchMock.mockResolvedValue(ok({ score: 0.5, feedback: 'Half there.' }));

    const result = await gradeTask({
      question: { prompt: 'p', externalValidator: RUBRIC, checks: [] },
      response: 'work',
      points: 40,
    });

    expect(result.awarded).toBe(20);
    expect(result.gradedExternally).toBe(true);
    expect(result.feedback).toBe('Half there.');
  });

  it('CLAMPS a grader that returns more than 1', async () => {
    /**
     * The guard that keeps a paper worth 200. A grader returning 1.4 — through
     * a bug, a different scale, or compromise — must not award 140% of the
     * marks.
     */
    fetchMock.mockResolvedValue(ok({ score: 1.4 }));

    const result = await gradeTask({
      question: { prompt: 'p', externalValidator: RUBRIC, checks: [] },
      response: 'work',
      points: 40,
    });

    expect(result.awarded).toBe(40);
  });

  it('clamps a negative score to zero rather than subtracting marks', async () => {
    fetchMock.mockResolvedValue(ok({ score: -2 }));

    const result = await gradeTask({
      question: { prompt: 'p', externalValidator: RUBRIC, checks: [] },
      response: 'work',
      points: 40,
    });

    expect(result.awarded).toBe(0);
  });

  it('falls back to a human on a non-numeric score', async () => {
    // "excellent" is not a mark. Guessing what it means would be worse than
    // admitting the response was unusable.
    fetchMock.mockResolvedValue(ok({ score: 'excellent' }));

    const result = await gradeTask({
      question: { prompt: 'p', externalValidator: RUBRIC, checks: [] },
      response: 'work',
      points: 40,
    });

    expect(result.needsReview).toBe(true);
    expect(result.awarded).toBe(0);
  });

  it('falls back to a human when the service is down', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    const result = await gradeTask({
      question: { prompt: 'p', externalValidator: RUBRIC, checks: [] },
      response: 'work',
      points: 40,
    });

    // NOT zero-as-a-mark: flagged, so a teacher decides.
    expect(result.needsReview).toBe(true);
  });

  it('falls back to a human when the request throws', async () => {
    fetchMock.mockRejectedValue(new Error('socket hang up'));

    const result = await gradeTask({
      question: { prompt: 'p', externalValidator: RUBRIC, checks: [] },
      response: 'work',
      points: 40,
    });

    expect(result.needsReview).toBe(true);
  });

  it('refuses to grade against an empty rubric', async () => {
    // Enabled without saying what to judge. Grading would be arbitrary.
    const verdict = await validator.validate({
      question: { prompt: 'p', externalValidator: { enabled: true, rubric: '   ' } },
      response: 'work',
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('no-rubric');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('USES THE STRUCTURAL CHECKS when the grader is unavailable', async () => {
    /**
     * The degradation that matters most. A task with both a rubric and
     * structural checks should still be graded on its checks if the service is
     * unreachable — a pupil loses nothing to an outage.
     */
    fetchMock.mockRejectedValue(new Error('down'));

    const result = await gradeTask({
      question: {
        prompt: 'p',
        externalValidator: RUBRIC,
        checks: [{ kind: 'htmlTag', value: 'header', label: 'uses a <header>' }],
      },
      response: '<header>My school</header>',
      points: 30,
    });

    expect(result.awarded).toBe(30);
    expect(result.needsReview).toBeFalsy();
  });

  it('flags partial credit that arrives with no explanation', async () => {
    // Open work marked down without a reason is not something to hand a child.
    fetchMock.mockResolvedValue(ok({ score: 0.6 }));

    const result = await gradeTask({
      question: { prompt: 'p', externalValidator: RUBRIC, checks: [] },
      response: 'work',
      points: 40,
    });

    expect(result.awarded).toBe(24);
    expect(result.needsReview).toBe(true);
  });
});
