import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as shopService from '../services/shopService.js';

export const listItems = asyncHandler(async (req, res) => {
  const items = await shopService.getShopItems(req.user._id);
  return sendSuccess(res, items, 'Shop items');
});

export const purchase = asyncHandler(async (req, res) => {
  const data = await shopService.purchaseItem(req.user._id, req.body.itemKey);
  return sendSuccess(res, data, 'Purchase successful');
});

export const listPurchases = asyncHandler(async (req, res) => {
  const purchases = await shopService.getPurchaseHistory(req.user._id);
  return sendSuccess(res, purchases, 'Purchase history');
});

export default { listItems, purchase, listPurchases };
