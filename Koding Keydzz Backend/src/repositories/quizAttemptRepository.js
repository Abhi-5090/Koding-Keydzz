import { BaseRepository } from './BaseRepository.js';
import { QuizAttempt } from '../models/QuizAttempt.js';

class QuizAttemptRepository extends BaseRepository {
  constructor() {
    super(QuizAttempt);
  }

  findByUserAndQuiz(userId, quizId) {
    return this.model.findOne({ user: userId, quiz: quizId });
  }
}

export const quizAttemptRepository = new QuizAttemptRepository();
export default quizAttemptRepository;
