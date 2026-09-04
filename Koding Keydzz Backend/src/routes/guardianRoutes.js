import { Router } from 'express';
import * as guardianController from '../controllers/guardianController.js';
import { protect, requireCapability } from '../middlewares/auth.js';

/**
 * PARENT AND CARER ROUTES.
 *
 * `child:read` is held by the guardian role alone, and the service resolves
 * which children from the signed-in account's own links. So there is no
 * classroom scope to attach and no org parameter to pass — a guardian can only
 * ever ask about a child they are linked to, and an unlinked child answers 404
 * rather than 403 so they cannot discover that a pupil exists.
 *
 * READ ONLY. There is deliberately no write route in this file: a guardian
 * cannot reset a password, change a class or alter progress. Those stay with
 * the school, where the audit trail is.
 */
const router = Router();

router.use(protect, requireCapability('child:read'));

router.get('/children', guardianController.myChildren);
router.get('/children/:id', guardianController.childProgress);

export default router;
