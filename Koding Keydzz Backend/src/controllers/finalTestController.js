import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Course } from '../models/Course.js';
import { userRepository } from '../repositories/userRepository.js';
import {
  finalTestEligibility,
  startFinalTest,
  saveProgress,
  submitFinalTest,
} from '../services/finalTestService.js';

/**
 * The final test, from a pupil's side.
 *
 * The user is re-read from the database rather than taken from `req.user`:
 * eligibility counts `completedLessons` and `gameProgress`, and the
 * token-derived user is a lean projection without them — using it would report
 * every pupil as having finished nothing and refuse them the test.
 */
async function loadFullUser(req) {
  const user = await userRepository.findById(req.user._id);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

/** May this pupil sit the test, and if not, what is left to do? */
export const getEligibility = asyncHandler(async (req, res) => {
  const user = await loadFullUser(req);
  const course = await Course.findOne({ slug: req.params.slug, published: true }).lean();
  if (!course) throw ApiError.notFound('Course not found');

  const eligibility = await finalTestEligibility(user, course);
  return sendSuccess(res, eligibility, `${course.title} final test`);
});

/**
 * Start or resume an attempt.
 *
 * POST rather than GET because it has a real side effect the first time — it
 * draws a paper and burns one of three attempts. Resuming is idempotent and
 * returns the same frozen paper.
 */
export const start = asyncHandler(async (req, res) => {
  const user = await loadFullUser(req);
  const paper = await startFinalTest(user, req.params.slug);
  return sendSuccess(
    res,
    paper,
    paper.resumed ? 'Picking up where you left off' : 'Good luck!'
  );
});

/** Save answers without submitting, so a long test survives a lost tab. */
export const save = asyncHandler(async (req, res) => {
  const user = await loadFullUser(req);
  const result = await saveProgress(user, req.params.attemptId, req.body.answers);
  return sendSuccess(res, result, 'Saved');
});

/** Submit and mark. Passing this is what unlocks the next course. */
export const submit = asyncHandler(async (req, res) => {
  const user = await loadFullUser(req);
  const result = await submitFinalTest(user, req.params.attemptId, req.body.answers);
  return sendSuccess(
    res,
    result,
    result.passed
      ? `You passed with ${result.score} of ${result.total}!`
      : `You scored ${result.score} of ${result.total}. ${result.passMark} needed to pass.`
  );
});

export default { getEligibility, start, save, submit };
