import { Router } from 'express';
import * as playgroundController from '../controllers/playgroundController.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { playgroundLimiter } from '../middlewares/rateLimit.js';
import { playgroundRunSchema } from '../utils/validators.js';

const router = Router();

// Server-side code execution is DISABLED by default. The Playground now runs
// user code entirely client-side (in the browser), so the server no longer
// needs to spawn interpreters — this closes the local child_process RCE surface.
// Set ENABLE_SERVER_CODE_EXEC=true to re-enable the server-side runner (only do
// this behind a real sandbox, e.g. self-hosted Piston or a jailed container).
const requireServerExecEnabled = (_req, res, next) => {
  if (process.env.ENABLE_SERVER_CODE_EXEC !== 'true') {
    return res.status(501).json({
      success: false,
      message: 'Server-side code execution is disabled; code runs in your browser.',
    });
  }
  return next();
};

router.post(
  '/run',
  requireServerExecEnabled,
  protect,
  playgroundLimiter,
  validate({ body: playgroundRunSchema }),
  playgroundController.run
);

export default router;
