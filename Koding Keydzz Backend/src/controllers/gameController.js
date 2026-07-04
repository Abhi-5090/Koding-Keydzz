import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import * as achievementService from '../services/achievementService.js';
import * as challengeService from '../services/challengeService.js';
import * as leaderboardService from '../services/leaderboardService.js';
import * as notificationService from '../services/notificationService.js';

// Per-user achievements with progress (protected). The student app uses this
// to render progress bars and unlocked state.
export const listAchievements = asyncHandler(async (req, res) => {
  const data = await achievementService.listAchievementsForUser(req.user);
  return sendSuccess(res, data, 'Achievements');
});

// Unauthenticated catalog variant (no per-user progress) for shared content.
export const listAchievementCatalog = asyncHandler(async (_req, res) => {
  const data = await achievementService.listAchievements();
  return sendSuccess(res, data, 'Achievement catalog');
});

export const listDailyChallenges = asyncHandler(async (_req, res) => {
  const data = await challengeService.listDailyChallenges();
  return sendSuccess(res, data, 'Daily challenges');
});

export const getLeaderboard = asyncHandler(async (req, res) => {
  // New param is `scope` ('global' | 'school'); the legacy `type` param is kept
  // for back-compat (unknown types fall through to 'global').
  const requested = req.query.scope || req.query.type || 'global';
  const scope = requested === 'school' ? 'school' : 'global';

  // The school board is org-scoped and therefore requires authentication.
  if (scope === 'school' && !req.user) {
    throw ApiError.unauthorized('Authentication is required for the school leaderboard');
  }

  const data = await leaderboardService.getLeaderboard({
    scope,
    org: scope === 'school' ? req.user.org : null,
    userId: req.user ? req.user._id : null,
  });
  return sendSuccess(res, data, 'Leaderboard');
});

export const listNotifications = asyncHandler(async (req, res) => {
  const data = await notificationService.listNotifications(req.user._id);
  return sendSuccess(res, data, 'Notifications');
});

export default {
  listAchievements,
  listAchievementCatalog,
  listDailyChallenges,
  getLeaderboard,
  listNotifications,
};
