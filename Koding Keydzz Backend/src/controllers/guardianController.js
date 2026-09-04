import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as guardians from '../services/guardianService.js';

/**
 * A guardian's own view. Every handler resolves the children from
 * `req.user.guardianOf` — there is no id in any path that a guardian supplies
 * without it being checked against their own links first.
 */

export const myChildren = asyncHandler(async (req, res) => {
  const data = await guardians.listChildren(req.user);
  return sendSuccess(res, data, 'Your children');
});

export const childProgress = asyncHandler(async (req, res) => {
  const data = await guardians.childProgress({
    guardian: req.user,
    childId: req.params.id,
  });
  return sendSuccess(res, data, 'Progress');
});

export default { myChildren, childProgress };
