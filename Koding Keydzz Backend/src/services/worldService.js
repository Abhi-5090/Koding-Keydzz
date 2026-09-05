import { worldRepository } from '../repositories/worldRepository.js';
import { lessonRepository } from '../repositories/lessonRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { decorateWorlds, decorateLessons } from './progressionService.js';

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
export async function listWorlds(user = null, courseSlug = null) {
  if (!user) return worldRepository.findAllOrdered();

  // Imported here rather than at module scope: courseService imports the World
  // model, and a top-level import in both directions is a cycle.
  const { resolveCurrentCourse } = await import('./courseService.js');
  try {
    /**
     * `courseSlug` lets the map ask for a NAMED course rather than only the
     * pupil's current one.
     *
     * The map now shows all four courses and lets a pupil open the ones they
     * have unlocked, so "which worlds are in Python?" is a question the client
     * legitimately asks about a course that is not the one they are furthest
     * through. `resolveCurrentCourse` still refuses a course they have not
     * unlocked, so this widens what can be asked for, not what can be reached.
     */
    const course = await resolveCurrentCourse(user, courseSlug);
    const worlds = await worldRepository.findByCourse(course.id);
    return decorateWorlds(worlds, user);
  } catch (err) {
    /**
     * A LOCKED course is a real answer and must reach the caller as one — the
     * map asks about courses the pupil has not unlocked, and "403, here is
     * why" is what it renders.
     *
     * Only 403, though. "No course is published at all" is a different
     * situation with a different right answer: an empty map. Re-throwing that
     * too turned a fresh platform, and any moment when content is being
     * re-authored, into a 404 on the pupil's home screen.
     */
    if (err instanceof ApiError && err.statusCode === 403) throw err;
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

  const lessons = await lessonRepository.findByWorld(worldId);

  /**
   * Staff and internal callers get the raw list; a pupil gets it with the
   * sequence applied, so the client never has to work out for itself which
   * topic is next — and cannot get that answer wrong in the pupil's favour.
   */
  return user ? decorateLessons(lessons, user) : lessons;
}

export default { listWorlds, listLessonsForWorld };
