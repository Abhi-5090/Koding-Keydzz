import { worldRepository } from '../repositories/worldRepository.js';
import { lessonRepository } from '../repositories/lessonRepository.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * The worlds a pupil may see.
 *
 * SCOPED TO THEIR CURRENT COURSE. Before the ladder there was one language and
 * "every world" was the right answer; now it would show a Python pupil the C
 * and HTML worlds they have not unlocked — the map would advertise content
 * they cannot open, and the world count on their dashboard would be wrong.
 *
 * `user` is optional so staff and internal callers (achievements, analytics)
 * can still ask for the whole set; only the student surface passes one.
 */
export async function listWorlds(user = null) {
  if (!user) return worldRepository.findAllOrdered();

  // Imported here rather than at module scope: courseService imports the World
  // model, and a top-level import in both directions is a cycle.
  const { resolveCurrentCourse } = await import('./courseService.js');
  try {
    const course = await resolveCurrentCourse(user);
    return worldRepository.findByCourse(course.id);
  } catch {
    // No published course yet (a fresh platform, or content still being
    // authored). An empty map is the honest answer — better than falling back
    // to every world, which would silently undo the scoping.
    return [];
  }
}

export async function listLessonsForWorld(worldId, user = null) {
  const world = await worldRepository.findById(worldId);
  if (!world) {
    throw ApiError.notFound('World not found');
  }

  /**
   * A pupil may only read lessons from a world in a course they have
   * unlocked.
   *
   * Without this the scoping above is cosmetic: the world list would hide C
   * worlds while their lesson URLs stayed readable to anyone who guessed an
   * id — and world ids are handed out by the map.
   */
  if (user && world.course) {
    const { resolveCurrentCourse } = await import('./courseService.js');
    const course = await resolveCurrentCourse(user);
    if (String(world.course) !== String(course.id)) {
      // 404, not 403: a world in a course they have not reached is not
      // something they should learn the existence of from this endpoint.
      throw ApiError.notFound('World not found');
    }
  }

  return lessonRepository.findByWorld(worldId);
}

export default { listWorlds, listLessonsForWorld };
