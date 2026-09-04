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
  // Authentication is mandatory: this board lists children by name, so it must
  // never answer an anonymous caller. The route enforces it too (protect), and
  // this is the defence in depth.
  if (!req.user) {
    throw ApiError.unauthorized('Authentication is required to view the leaderboard');
  }

  // `scope` is the current param; the legacy `type` param is still accepted.
  // The DEFAULT is now 'school' — a cross-tenant board has to be asked for
  // explicitly rather than being what you get by omitting a parameter.
  const requested = req.query.scope || req.query.type || 'school';
  const scope = requested === 'global' ? 'global' : 'school';

  const data = await leaderboardService.getLeaderboard({
    scope,
    org: req.user.org,
    userId: req.user._id,
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
