import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as studentService from '../services/studentService.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const data = await studentService.getDashboard(req.user._id);
  return sendSuccess(res, data, 'Dashboard');
});

export default { getDashboard };
