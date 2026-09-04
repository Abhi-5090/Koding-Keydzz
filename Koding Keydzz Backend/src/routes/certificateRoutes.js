import { Router } from 'express';
import * as certificateController from '../controllers/certificateController.js';
import { protect, requireCapability } from '../middlewares/auth.js';

const router = Router();

/**
 * CERTIFICATE VERIFICATION IS PUBLIC AND MOUNTED FIRST.
 *
 * A certificate that leaves the school can only be checked by someone who is
 * not logged in — a parent, another school, an employer. So this route sits
 * ABOVE `protect`, which is why it is registered before it rather than being
 * given an exemption inside the guarded block.
 *
 * It returns the achievement and nothing else. See certificateService.
 */
router.get('/verify/:code', certificateController.verifyCertificate);

/* ---- everything below is a pupil's own ---- */
router.use(protect, requireCapability('learn:play'));

router.get('/', certificateController.myCertificates);
router.get('/:code', certificateController.myCertificate);

export default router;
