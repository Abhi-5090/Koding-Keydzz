import { Router } from 'express';
import * as courseController from '../controllers/courseController.js';
import { protect, requireCapability } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { courseSlugParamSchema } from '../utils/validators.js';

const router = Router();

/**
 * THE COURSE LADDER, for pupils.
 *
 * Every route is student-scoped: the ladder is a per-pupil view (what is
 * locked, what is in progress, how much is left), so there is no unscoped
 * "list all courses" here. Staff read courses through the admin surface, where
 * they see the content rather than one child's standing in it.
 */
router.use(protect);

/** The whole ladder with this pupil's standing in each course. */
router.get('/', requireCapability('learn:play'), courseController.listCourses);

/**
 * One course, with readiness detail.
 *
 * Returns 403 rather than 404 for a locked course: it is plainly listed as
 * locked in the ladder above, so hiding it here would only confuse.
 */
router.get(
  '/:slug',
  requireCapability('learn:play'),
  validate({ params: courseSlugParamSchema }),
  courseController.getCourse
);

/**
 * Mark a course started. Idempotent, and safe to call on every open — the
 * pupil's own action is what sets "in progress", rather than an admin having
 * to remember to.
 */
router.post(
  '/:slug/start',
  requireCapability('learn:play'),
  validate({ params: courseSlugParamSchema }),
  courseController.startCourse
);

export default router;
