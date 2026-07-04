import { BaseRepository } from './BaseRepository.js';
import { Quiz } from '../models/Quiz.js';

class QuizRepository extends BaseRepository {
  constructor() {
    super(Quiz);
  }

  findByLesson(lessonId) {
    return this.model.find({ lesson: lessonId });
  }

  // Quizzes with their lesson (and the lesson's world) populated, newest first.
  listWithLessonWorld() {
    return this.model
      .find({})
      .sort({ createdAt: -1 })
      .populate({ path: 'lesson', select: 'title world', populate: { path: 'world', select: 'name slug' } });
  }
}

export const quizRepository = new QuizRepository();
export default quizRepository;
