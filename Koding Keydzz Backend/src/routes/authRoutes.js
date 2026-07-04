import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { authLimiter } from '../middlewares/rateLimit.js';
import {
  registerStudentSchema,
  loginSchema,
  refreshSchema,
} from '../utils/validators.js';

const router = Router();

router.use(authLimiter);

// Public student self-registration is DISABLED by default — students are
// provisioned by their organization admin (single add or Excel bulk upload).
// Set ALLOW_STUDENT_SIGNUP=true to re-enable public sign-up.
router.post(
  '/register/student',
  (req, res, next) => {
    if (process.env.ALLOW_STUDENT_SIGNUP !== 'true') {
      return res.status(403).json({
        success: false,
        message:
          'Public sign-up is disabled. Ask your organization admin to add your account.',
      });
    }
    return next();
  },
  validate({ body: registerStudentSchema }),
  authController.registerStudent
);
router.post('/login', validate({ body: loginSchema }), authController.login);
router.post('/refresh', validate({ body: refreshSchema }), authController.refresh);
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.me);

export default router;
