import { Router } from 'express';
import * as gameController from '../controllers/gameController.js';
import { protect, optionalAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { leaderboardQuerySchema } from '../utils/validators.js';

// Routes for achievements, leaderboards, and notifications.
const achievementsRouter = Router();
// Per-user achievements WITH progress (protected); the student app needs this.
achievementsRouter.get('/', protect, gameController.listAchievements);
// Unauthenticated catalog (no per-user progress).
achievementsRouter.get('/catalog', gameController.listAchievementCatalog);

const leaderboardRouter = Router();
// Public by default (scope=global). optionalAuth lets us attach the caller's own
// rank as `me` when a token is present; the controller enforces auth for
// scope=school (org-scoped).
leaderboardRouter.get(
  '/',
  optionalAuth,
  validate({ query: leaderboardQuerySchema }),
  gameController.getLeaderboard
);

const notificationRouter = Router();
notificationRouter.get('/', protect, gameController.listNotifications);

export { achievementsRouter, leaderboardRouter, notificationRouter };
