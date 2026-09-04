import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as codeExecutionService from '../services/codeExecutionService.js';

/**
 * THE PLAYGROUND RUNNER — practice code, not examined work.
 *
 * This whole route is off unless ENABLE_SERVER_CODE_EXEC=true (see
 * playgroundRoutes.js); the playground normally runs code in the browser.
 *
 * When an operator does turn it on, this is the ONE call site allowed to use a
 * remote runner, and only if they also set CODE_RUNNER to 'auto' or 'piston'.
 * Practice code is not examined work, so an operator who has no local
 * interpreter may reasonably choose a remote sandbox for it — but it stays
 * their explicit choice twice over.
 *
 * Final-test marking passes `allowRemote: false` and always will.
 */
export const run = asyncHandler(async (req, res) => {
  const { language, code, stdin } = req.body;
  const result = await codeExecutionService.runCode({
    language,
    code,
    stdin,
    allowRemote: true,
  });
  return sendSuccess(res, result, 'Execution complete');
});

export default { run };
