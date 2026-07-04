import { Router } from 'express';
import * as quizController from '../controllers/quizController.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParam, quizSubmitSchema } from '../utils/validators.js';

const router = Router();

router.get('/', quizController.listQuizzes);
router.get('/:id', validate({ params: idParam }), quizController.getQuiz);
router.post(
  '/:id/submit',
  protect,
  validate({ params: idParam, body: quizSubmitSchema }),
  quizController.submitQuiz
);

export default router;
