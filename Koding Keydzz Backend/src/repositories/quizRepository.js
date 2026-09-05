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
    return (
      this.model
        .find({})
        .sort({ createdAt: -1 })
        .populate({
          path: 'lesson',
          select: 'title world order',
          populate: { path: 'world', select: 'name slug order course' },
        })
        /**
         * The quiz's OWN world ref, as well as the one reached through its
         * lesson. A quiz pinned straight to a world carries no lesson, and
         * reading the world only through `lesson.world` dropped those from
         * every grouping — they appeared in the arena with no section, which
         * is exactly the "everything in one pile" the categories fix.
         */
        .populate({ path: 'world', select: 'name slug order course' })
    );
  }

  // Admin listing: also populate the quiz's direct world ref (a stand-alone quiz
  // may be pinned to a world without a lesson).
  listForAdmin() {
    return this.model
      .find({})
      .sort({ createdAt: -1 })
      .populate({ path: 'lesson', select: 'title world', populate: { path: 'world', select: 'name slug' } })
      .populate({ path: 'world', select: 'name slug' });
  }

  // A single quiz with its lesson/world context populated (admin detail view).
  findByIdPopulated(id) {
    return this.model
      .findById(id)
      .populate({ path: 'lesson', select: 'title world', populate: { path: 'world', select: 'name slug' } })
      .populate({ path: 'world', select: 'name slug' });
  }
}

export const quizRepository = new QuizRepository();
export default quizRepository;
