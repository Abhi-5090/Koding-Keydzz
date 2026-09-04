import { BaseRepository } from './BaseRepository.js';
import { QuizAttempt } from '../models/QuizAttempt.js';

class QuizAttemptRepository extends BaseRepository {
  constructor() {
    super(QuizAttempt);
  }

  /** Most recent attempt for this user on this quiz (null if never attempted). */
  findLatestByUserAndQuiz(userId, quizId) {
    return this.model.findOne({ user: userId, quiz: quizId }).sort({ createdAt: -1 });
  }

  /**
   * The attempt that already paid out XP/coins, if any. Its existence is what
   * makes the award idempotent across retries.
   */
  findAwardedByUserAndQuiz(userId, quizId) {
    return this.model.findOne({ user: userId, quiz: quizId, awarded: true });
  }

  /** How many times this user has attempted this quiz. */
  countByUserAndQuiz(userId, quizId) {
    return this.model.countDocuments({ user: userId, quiz: quizId });
  }

  /** Full attempt history, oldest first — what a teacher wants to see. */
  listByUserAndQuiz(userId, quizId) {
    return this.model.find({ user: userId, quiz: quizId }).sort({ createdAt: 1 });
  }

  /** Every attempt by one user across all quizzes (newest first). */
  listByUser(userId, limit = 200) {
    return this.model
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('quiz', 'title');
  }

  /** Every attempt for one quiz — class-level reporting. */
  listByQuiz(quizId) {
    return this.model.find({ quiz: quizId }).sort({ createdAt: -1 });
  }
}

export const quizAttemptRepository = new QuizAttemptRepository();
export default quizAttemptRepository;
