import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as quizService from '../services/quizService.js';

export const listQuizzes = asyncHandler(async (req, res) => {
  // A pupil gets the arena grouped by course and section with the ladder's
  // lock state applied; staff get the flat list they had before.
  const forPupil = req.user?.role === 'student';
  const quizzes = await quizService.listQuizzes(forPupil ? req.user : null);
  return sendSuccess(res, quizzes, 'Quizzes');
});

export const getQuiz = asyncHandler(async (req, res) => {
  /**
   * A locked quiz must not open just because its id was typed.
   *
   * The arena greys out the sections a pupil has not reached, but quiz ids are
   * in the page. Without this the categories would be a filing system rather
   * than a gate, and every quiz in every course would stay playable on day
   * one — which is what this work set out to stop.
   */
  if (req.user?.role === 'student') {
    await quizService.assertQuizOpen(req.user, req.params.id);
  }
  const quiz = await quizService.getQuizForClient(req.params.id);
  return sendSuccess(res, quiz, 'Quiz');
});

export const submitQuiz = asyncHandler(async (req, res) => {
  // Reading a locked quiz is refused above; scoring one has to be refused too,
  // or the XP could still be claimed by posting answers straight to this route.
  if (req.user?.role === 'student') {
    await quizService.assertQuizOpen(req.user, req.params.id);
  }
  const result = await quizService.submitQuiz(
    req.user._id,
    req.params.id,
    req.body.answers || {}
  );
  return sendSuccess(res, result, 'Quiz submitted');
});

export const getMyAttempts = asyncHandler(async (req, res) => {
  const attempts = await quizService.getAttemptHistory(req.user._id, req.params.id);
  return sendSuccess(res, { attempts }, 'Quiz attempts');
});

export default { listQuizzes, getQuiz, submitQuiz, getMyAttempts };
