import { Router } from 'express';
import * as studentController from '../controllers/studentController.js';
import { protect, requireCapability } from '../middlewares/auth.js';

const router = Router();

router.get('/dashboard', protect, requireCapability('learn:play'), studentController.getDashboard);

/**
 * What this pupil has been set. `assignment:read` includes students, and the
 * service resolves the audience from their own classroom memberships — there
 * is no id in the path, so a pupil cannot ask about anybody else's work.
 */
router.get(
  '/assignments',
  protect,
  requireCapability('assignment:read'),
  studentController.getMyAssignments
);

export default router;
