import { Router } from 'express';
import * as finalTestController from '../controllers/finalTestController.js';
import { protect, requireCapability } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  courseSlugParamSchema,
  attemptRouteSchema,
  submitAnswersSchema,
} from '../utils/validators.js';

const router = Router();

/**
 * THE FINAL TEST, for pupils.
 *
 * Student-only throughout. Staff read results through the admin reporting
 * surface — they must never be able to open a live paper, because the paper
 * carries the questions a pupil is being examined on.
 */
router.use(protect, requireCapability('learn:play'));

/** May I sit it, and if not, what is left to do? */
router.get(
  '/:slug/eligibility',
  validate({ params: courseSlugParamSchema }),
  finalTestController.getEligibility
);

/**
 * Start or resume. POST because the first call has a real side effect: it
 * draws a paper and burns one of three attempts. Resuming is idempotent.
 */
router.post(
  '/:slug/start',
  validate({ params: courseSlugParamSchema }),
  finalTestController.start
);

/** Save without submitting, so a long test survives a lost tab. */
router.patch(
  '/attempts/:attemptId',
  validate({ params: attemptRouteSchema, body: submitAnswersSchema }),
  finalTestController.save
);

/** Submit and mark. Passing is what unlocks the next course. */
router.post(
  '/attempts/:attemptId/submit',
  validate({ params: attemptRouteSchema, body: submitAnswersSchema }),
  finalTestController.submit
);

export default router;
