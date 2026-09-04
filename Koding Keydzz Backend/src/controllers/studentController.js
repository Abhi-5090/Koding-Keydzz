import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as studentService from '../services/studentService.js';
import * as assignments from '../services/assignmentService.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const data = await studentService.getDashboard(req.user._id);
  return sendSuccess(res, data, 'Dashboard');
});

/**
 * The work this pupil has been set.
 *
 * Their own only — derived from the classrooms they are a member of, never
 * from a parameter, so there is nothing to tamper with. A pupil in no class
 * gets an empty list rather than an error.
 */
export const getMyAssignments = asyncHandler(async (req, res) => {
  const data = await assignments.listForPupil({
    userId: req.user._id,
    org: req.user.org,
  });
  return sendSuccess(res, data, 'Your assignments');
});

export default { getDashboard, getMyAssignments };
