import { Router } from 'express';
import * as gameController from '../controllers/gameController.js';
import * as progressController from '../controllers/progressController.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParam } from '../utils/validators.js';

const router = Router();

router.get('/daily', gameController.listDailyChallenges);
router.post(
  '/:id/complete',
  protect,
  validate({ params: idParam }),
  progressController.completeChallenge
);

export default router;
