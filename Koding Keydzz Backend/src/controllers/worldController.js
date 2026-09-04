import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as worldService from '../services/worldService.js';

export const listWorlds = asyncHandler(async (req, res) => {
  // Pupils get their current course's worlds; staff get the whole curriculum.
  const scopeToCourse = req.user?.role === 'student';
  const worlds = await worldService.listWorlds(scopeToCourse ? req.user : null);
  return sendSuccess(res, worlds, 'Worlds');
});

export const listWorldLessons = asyncHandler(async (req, res) => {
  const scopeToCourse = req.user?.role === 'student';
  const lessons = await worldService.listLessonsForWorld(
    req.params.id,
    scopeToCourse ? req.user : null
  );
  return sendSuccess(res, lessons, 'Lessons');
});

export default { listWorlds, listWorldLessons };
