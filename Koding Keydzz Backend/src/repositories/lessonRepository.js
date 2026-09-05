import { BaseRepository } from './BaseRepository.js';
import { Lesson } from '../models/Lesson.js';

class LessonRepository extends BaseRepository {
  constructor() {
    super(Lesson);
  }

  findByWorld(worldId) {
    /**
     * `_id` breaks ties, and that matters more than it looks.
     *
     * `order` defaults to 0, so any world whose lessons were authored without
     * one has every lesson at the same rank — and Mongo is then free to return
     * them in any order, differing between calls. The sequence gate reads
     * "the first lesson is open", so on such a world a DIFFERENT topic would
     * be the open one on each request, and the one the pupil expects to start
     * with could appear locked.
     *
     * An ObjectId embeds its creation time, so this falls back to authoring
     * order — which is the order the seed wrote them in.
     */
    return this.model.find({ world: worldId }).sort({ order: 1, _id: 1 });
  }
}

export const lessonRepository = new LessonRepository();
export default lessonRepository;
