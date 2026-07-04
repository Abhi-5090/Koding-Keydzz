import { Router } from 'express';
import * as worldController from '../controllers/worldController.js';
import { validate } from '../middlewares/validate.js';
import { idParam } from '../utils/validators.js';

const router = Router();

router.get('/', worldController.listWorlds);
router.get('/:id/lessons', validate({ params: idParam }), worldController.listWorldLessons);

export default router;
