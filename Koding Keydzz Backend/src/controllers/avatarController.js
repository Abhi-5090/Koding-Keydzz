import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as avatarService from '../services/avatarService.js';

export const listItems = asyncHandler(async (_req, res) => {
  const items = await avatarService.getCatalog();
  return sendSuccess(res, items, 'Avatar catalog');
});

export const getMyAvatar = asyncHandler(async (req, res) => {
  const data = await avatarService.getMyAvatar(req.user._id);
  return sendSuccess(res, data, 'Current avatar');
});

export const equipItem = asyncHandler(async (req, res) => {
  const data = await avatarService.equipItem(req.user._id, req.body.key);
  return sendSuccess(res, data, 'Item equipped');
});

export default { listItems, getMyAvatar, equipItem };
