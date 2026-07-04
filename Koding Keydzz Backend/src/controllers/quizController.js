import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as quizService from '../services/quizService.js';

export const listQuizzes = asyncHandler(async (_req, res) => {
  const quizzes = await quizService.listQuizzes();
  return sendSuccess(res, quizzes, 'Quizzes');
});

export const getQuiz = asyncHandler(async (req, res) => {
  const quiz = await quizService.getQuizForClient(req.params.id);
  return sendSuccess(res, quiz, 'Quiz');
});

export const submitQuiz = asyncHandler(async (req, res) => {
  const result = await quizService.submitQuiz(
    req.user._id,
    req.params.id,
    req.body.answers || {}
  );
  return sendSuccess(res, result, 'Quiz submitted');
});

export default { listQuizzes, getQuiz, submitQuiz };
