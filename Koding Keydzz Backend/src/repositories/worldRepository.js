import { BaseRepository } from './BaseRepository.js';
import { World } from '../models/World.js';

class WorldRepository extends BaseRepository {
  constructor() {
    super(World);
  }

  findAllOrdered() {
    return this.model.find().sort({ order: 1 });
  }

  /**
   * Worlds belonging to ONE course, in order.
   *
   * This is what the student surface uses. `findAllOrdered` returns every
   * world on the platform, which was correct when there was one language and
   * is now a cross-course leak: a pupil on Python would be shown C and HTML
   * worlds they have not unlocked.
   */
  findByCourse(courseId) {
    return this.model.find({ course: courseId }).sort({ order: 1 });
  }

  findBySlug(slug) {
    return this.model.findOne({ slug });
  }
}

export const worldRepository = new WorldRepository();
export default worldRepository;
