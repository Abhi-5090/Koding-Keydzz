import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as progressService from '../services/progressService.js';

export const completeLesson = asyncHandler(async (req, res) => {
  const result = await progressService.completeLesson(req.user._id, req.params.id);
  return sendSuccess(res, result, 'Lesson completed');
});

export const completeChallenge = asyncHandler(async (req, res) => {
  const result = await progressService.completeChallenge(req.user._id, req.params.id);
  return sendSuccess(res, result, 'Challenge completed');
});

export default { completeLesson, completeChallenge };
