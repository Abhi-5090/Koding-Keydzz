import { Router } from 'express';
import * as studentController from '../controllers/studentController.js';
import { protect, requireCapability } from '../middlewares/auth.js';

const router = Router();

router.get('/dashboard', protect, requireCapability('learn:play'), studentController.getDashboard);

export default router;
