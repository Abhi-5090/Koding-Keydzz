import { Router } from 'express';
import authRoutes from './authRoutes.js';
import studentRoutes from './studentRoutes.js';
import courseRoutes from './courseRoutes.js';
import finalTestRoutes from './finalTestRoutes.js';
import certificateRoutes from './certificateRoutes.js';
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

/**
 * LIVENESS. Kept trivial and dependency-free on purpose — a load balancer asks
 * this constantly and it must never touch the database.
 */
router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' }, message: 'Healthy' });
});

/**
 * READINESS — can this instance actually do its job?
 *
 * Distinct from liveness, and the distinction matters here. A process can be
 * alive, serving pages, and unable to mark an exam because no interpreter is
 * installed: coding answers then grade as `needsReview` and a whole cohort's
 * papers land silently in a marking queue.
 *
 * Returns 503 when a hard dependency is missing, so an orchestrator can refuse
 * to route to it. A MISSING RUNNER IS REPORTED BUT NOT FATAL: an instance with
 * no compiler can still serve lessons, quizzes and games perfectly well, so
 * taking it out of rotation would be a worse outcome than flagging it.
 */
router.get('/ready', async (_req, res) => {
  const mongoose = (await import('mongoose')).default;
  const { availableRunners } = await import('../config/gameCatalog.js').then(
    () => import('../services/codeExecutionService.js')
  );

  const dbConnected = mongoose.connection.readyState === 1;
  const runners = availableRunners();
  const missingRunners = Object.entries(runners)
    .filter(([, bin]) => !bin)
    .map(([language]) => language);

  const status = dbConnected ? 200 : 503;
  return res.status(status).json({
    success: dbConnected,
    data: {
      database: dbConnected ? 'connected' : 'disconnected',
      runners,
      missingRunners,
      // Named plainly, because this is the sentence an operator needs to read.
      warning: missingRunners.length
        ? `No toolchain for: ${missingRunners.join(', ')}. Coding answers in those ` +
          'languages will be flagged for manual marking instead of graded.'
        : null,
    },
    message: dbConnected ? 'Ready' : 'Not ready — database unavailable',
  });
});

/**
 * METRICS. `?format=prometheus` for a scraper, JSON by default for a human.
 */
router.get('/metrics', async (req, res) => {
  const mongoose = (await import('mongoose')).default;
  const { snapshot, prometheusText } = await import('../middlewares/metrics.js');
  const { availableRunners } = await import('../services/codeExecutionService.js');

  const extra = {
    runners: availableRunners(),
    dbConnected: mongoose.connection.readyState === 1,
  };

  if (req.query.format === 'prometheus') {
    res.set('Content-Type', 'text/plain; version=0.0.4');
    return res.send(prometheusText(extra));
  }
  return res.json({
    success: true,
    data: { ...snapshot(), ...extra },
    message: 'Metrics',
  });
});

router.use('/auth', authRoutes);
router.use('/student', studentRoutes);
// The course ladder: Python -> C -> HTML -> AI, gated by each final test.
router.use('/courses', courseRoutes);
// The final test that gates each course. Student-only.
router.use('/final-test', finalTestRoutes);
router.use('/certificates', certificateRoutes);
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
