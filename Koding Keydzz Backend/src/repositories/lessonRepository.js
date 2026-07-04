import { BaseRepository } from './BaseRepository.js';
import { Lesson } from '../models/Lesson.js';

class LessonRepository extends BaseRepository {
  constructor() {
    super(Lesson);
  }

  findByWorld(worldId) {
    return this.model.find({ world: worldId }).sort({ order: 1 });
  }
}

export const lessonRepository = new LessonRepository();
export default lessonRepository;
