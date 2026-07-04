import { Router } from 'express';
import * as progressController from '../controllers/progressController.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParam } from '../utils/validators.js';

const router = Router();

router.post(
  '/lesson/:id/complete',
  protect,
  validate({ params: idParam }),
  progressController.completeLesson
);

export default router;
