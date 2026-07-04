import { Router } from 'express';
import * as gameProgressController from '../controllers/gameProgressController.js';
import { protect, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  gameCompleteSchema,
  gameKeyParamSchema,
  gameLevelParamSchema,
  gameLeaderboardQuerySchema,
} from '../utils/validators.js';

const router = Router();

router.post(
  '/complete',
  protect,
  validate({ body: gameCompleteSchema }),
  gameProgressController.completeGameLevel
);

// Aggregate leaderboard for a game (students + admins may read).
router.get(
  '/:gameKey/leaderboard',
  protect,
  authorize('student', 'admin', 'superadmin'),
  validate({ params: gameKeyParamSchema, query: gameLeaderboardQuerySchema }),
  gameProgressController.getGameLeaderboard
);

// Per-level ranking for a game.
router.get(
  '/:gameKey/levels/:levelId/leaderboard',
  protect,
  authorize('student', 'admin', 'superadmin'),
  validate({ params: gameLevelParamSchema, query: gameLeaderboardQuerySchema }),
  gameProgressController.getLevelLeaderboard
);

export default router;
