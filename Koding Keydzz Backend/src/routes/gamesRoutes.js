import { Router } from 'express';
import * as gameProgressController from '../controllers/gameProgressController.js';
import { protect, requireCapability } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { gameCompleteLimiter } from '../middlewares/rateLimit.js';
import {
  gameCompleteSchema,
  gameKeyParamSchema,
  gameLevelParamSchema,
  gameLeaderboardQuerySchema,
} from '../utils/validators.js';

const router = Router();

// Only STUDENTS earn XP. Admin accounts posting completions polluted the
// leaderboards and the analytics with staff progress.
router.post(
  '/complete',
  protect,
  requireCapability('learn:play'),
  gameCompleteLimiter,
  validate({ body: gameCompleteSchema }),
  gameProgressController.completeGameLevel
);

// Aggregate leaderboard for a game (students + admins may read).
router.get(
  '/:gameKey/leaderboard',
  protect,
  requireCapability('game:catalog'),
  validate({ params: gameKeyParamSchema, query: gameLeaderboardQuerySchema }),
  gameProgressController.getGameLeaderboard
);

// Per-level ranking for a game.
router.get(
  '/:gameKey/levels/:levelId/leaderboard',
  protect,
  requireCapability('game:catalog'),
  validate({ params: gameLevelParamSchema, query: gameLeaderboardQuerySchema }),
  gameProgressController.getLevelLeaderboard
);

export default router;
