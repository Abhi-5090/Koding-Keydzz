import { Router } from 'express';
import authRoutes from './authRoutes.js';
import studentRoutes from './studentRoutes.js';
import worldRoutes from './worldRoutes.js';
import progressRoutes from './progressRoutes.js';
import challengeRoutes from './challengeRoutes.js';
import adminRoutes from './adminRoutes.js';
import superadminRoutes from './superadminRoutes.js';
import avatarRoutes from './avatarRoutes.js';
import shopRoutes from './shopRoutes.js';
import quizRoutes from './quizRoutes.js';
import gamesRoutes from './gamesRoutes.js';
import playgroundRoutes from './playgroundRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import {
  achievementsRouter,
  leaderboardRouter,
  notificationRouter,
} from './gameRoutes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' }, message: 'Healthy' });
});

router.use('/auth', authRoutes);
router.use('/student', studentRoutes);
router.use('/worlds', worldRoutes);
router.use('/progress', progressRoutes);
router.use('/challenges', challengeRoutes);
router.use('/achievements', achievementsRouter);
router.use('/leaderboards', leaderboardRouter);
router.use('/notifications', notificationRouter);
router.use('/avatar', avatarRoutes);
router.use('/shop', shopRoutes);
router.use('/quizzes', quizRoutes);
router.use('/games', gamesRoutes);
router.use('/playground', playgroundRoutes);
router.use('/uploads', uploadRoutes);
router.use('/admin', adminRoutes);
router.use('/superadmin', superadminRoutes);

export default router;
