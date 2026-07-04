import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as worldService from '../services/worldService.js';

export const listWorlds = asyncHandler(async (_req, res) => {
  const worlds = await worldService.listWorlds();
  return sendSuccess(res, worlds, 'Worlds');
});

export const listWorldLessons = asyncHandler(async (req, res) => {
  const lessons = await worldService.listLessonsForWorld(req.params.id);
  return sendSuccess(res, lessons, 'Lessons');
});

export default { listWorlds, listWorldLessons };
