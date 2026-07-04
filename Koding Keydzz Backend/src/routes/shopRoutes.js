import { Router } from 'express';
import * as shopController from '../controllers/shopController.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { purchaseSchema } from '../utils/validators.js';

const router = Router();

router.get('/items', protect, shopController.listItems);
router.post(
  '/purchase',
  protect,
  validate({ body: purchaseSchema }),
  shopController.purchase
);
router.get('/purchases', protect, shopController.listPurchases);

export default router;
