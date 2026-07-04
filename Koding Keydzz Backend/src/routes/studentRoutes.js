import { Router } from 'express';
import * as studentController from '../controllers/studentController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/dashboard', protect, authorize('student'), studentController.getDashboard);

export default router;
