import { Router } from 'express';
import * as gameController from '../controllers/gameController.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { leaderboardQuerySchema } from '../utils/validators.js';

// Routes for achievements, leaderboards, and notifications.
const achievementsRouter = Router();
// Per-user achievements WITH progress (protected); the student app needs this.
achievementsRouter.get('/', protect, gameController.listAchievements);
// Catalog without per-user progress. Authenticated: the achievement list is
// authored curriculum content, not public marketing material.
achievementsRouter.get('/catalog', protect, gameController.listAchievementCatalog);

const leaderboardRouter = Router();
// AUTHENTICATED. This board lists children by name; it used to be readable with
// no token at all, which published minors' full names to the open internet.
// Scope defaults to the caller's own school (see the controller).
leaderboardRouter.get(
  '/',
  protect,
  validate({ query: leaderboardQuerySchema }),
  gameController.getLeaderboard
);

const notificationRouter = Router();
notificationRouter.get('/', protect, gameController.listNotifications);

export { achievementsRouter, leaderboardRouter, notificationRouter };
