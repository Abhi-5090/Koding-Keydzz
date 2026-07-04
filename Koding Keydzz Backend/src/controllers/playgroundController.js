import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as codeExecutionService from '../services/codeExecutionService.js';

export const run = asyncHandler(async (req, res) => {
  const { language, code, stdin } = req.body;
  const result = await codeExecutionService.runCode({ language, code, stdin });
  return sendSuccess(res, result, 'Execution complete');
});

export default { run };
