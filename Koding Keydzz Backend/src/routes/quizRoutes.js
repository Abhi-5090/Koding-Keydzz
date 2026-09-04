import { Router } from 'express';
import * as quizController from '../controllers/quizController.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParam, quizSubmitSchema } from '../utils/validators.js';

const router = Router();

// AUTHENTICATED. The quiz catalogue and question set are authored curriculum —
// the platform's core IP — and used to be readable by anyone with the URL.
router.get('/', protect, quizController.listQuizzes);
router.get('/:id', protect, validate({ params: idParam }), quizController.getQuiz);

// A student's own attempt history for one quiz. Retries are credited on the
// first PASS, so the history is what shows the improvement.
router.get(
  '/:id/attempts',
  protect,
  validate({ params: idParam }),
  quizController.getMyAttempts
);
router.post(
  '/:id/submit',
  protect,
  validate({ params: idParam, body: quizSubmitSchema }),
  quizController.submitQuiz
);

export default router;
