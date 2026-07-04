import { worldRepository } from '../repositories/worldRepository.js';
import { lessonRepository } from '../repositories/lessonRepository.js';
import { ApiError } from '../utils/ApiError.js';

export function listWorlds() {
  return worldRepository.findAllOrdered();
}

export async function listLessonsForWorld(worldId) {
  const world = await worldRepository.findById(worldId);
  if (!world) {
    throw ApiError.notFound('World not found');
  }
  return lessonRepository.findByWorld(worldId);
}

export default { listWorlds, listLessonsForWorld };
