import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as gameProgressService from '../services/gameProgressService.js';
import * as gameLeaderboardService from '../services/gameLeaderboardService.js';

export const completeGameLevel = asyncHandler(async (req, res) => {
  const result = await gameProgressService.completeGameLevel(req.user._id, req.body);
  return sendSuccess(res, result, 'Game level completed');
});

export const getGameLeaderboard = asyncHandler(async (req, res) => {
  const data = await gameLeaderboardService.getGameLeaderboard({
    gameKey: req.params.gameKey,
    userId: req.user._id,
    org: req.user.org,
    scope: req.query.scope,
    limit: req.query.limit,
  });
  return sendSuccess(res, data, 'Game leaderboard');
});

export const getLevelLeaderboard = asyncHandler(async (req, res) => {
  const data = await gameLeaderboardService.getLevelLeaderboard({
    gameKey: req.params.gameKey,
    levelId: req.params.levelId,
    userId: req.user._id,
    org: req.user.org,
    scope: req.query.scope,
    limit: req.query.limit,
  });
  return sendSuccess(res, data, 'Level leaderboard');
});

export default { completeGameLevel, getGameLeaderboard, getLevelLeaderboard };
