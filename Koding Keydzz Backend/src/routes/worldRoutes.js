import { Router } from 'express';
import * as worldController from '../controllers/worldController.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParam } from '../utils/validators.js';

const router = Router();

// AUTHENTICATED. Worlds and their lessons are the authored curriculum; leaving
// them open let the whole course be scraped without an account.
router.get('/', protect, worldController.listWorlds);
router.get(
  '/:id/lessons',
  protect,
  validate({ params: idParam }),
  worldController.listWorldLessons
);

export default router;
