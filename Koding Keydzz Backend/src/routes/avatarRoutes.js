import { Router } from 'express';
import * as avatarController from '../controllers/avatarController.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { equipAvatarSchema } from '../utils/validators.js';

const router = Router();

// AUTHENTICATED — the item catalogue drives the shop economy.
router.get('/items', protect, avatarController.listItems);
router.get('/me', protect, avatarController.getMyAvatar);
router.put(
  '/me',
  protect,
  validate({ body: equipAvatarSchema }),
  avatarController.equipItem
);

export default router;
