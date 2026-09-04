import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as analyticsService from '../services/analyticsService.js';
import { studentIdsInScope } from '../services/classroomService.js';

/** Clamp the reporting window so a caller cannot ask for an unbounded scan. */
function windowDays(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 30;
  return Math.max(7, Math.min(365, Math.round(n)));
}

/** Platform-wide analytics (superadmin). */
export const getPlatformAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getPlatformAnalytics({
    days: windowDays(req.query.days),
  });
  return sendSuccess(res, data, 'Platform analytics');
});

/**
 * Organization analytics.
 *
 * An admin gets the whole school. A faculty member gets exactly the students
 * in the classrooms they teach — resolved here from req.classroomScope so the
 * same endpoint serves both without leaking.
 */
export const getOrgAnalytics = asyncHandler(async (req, res) => {
  const studentIds = await studentIdsInScope({
    org: req.orgId,
    classroomScope: req.classroomScope,
  });
  const data = await analyticsService.getOrgAnalytics({
    org: req.orgId,
    studentIds,
    days: windowDays(req.query.days),
  });
  return sendSuccess(res, data, 'Organization analytics');
});

/** Analytics for one classroom. */
export const getClassroomAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getClassroomAnalytics({
    org: req.orgId,
    classroomId: req.params.id,
    classroomScope: req.classroomScope,
    days: windowDays(req.query.days),
  });
  return sendSuccess(res, data, 'Classroom analytics');
});

/** Analytics for ONE organization, viewed by the superadmin. */
export const getOrgAnalyticsForSuperadmin = asyncHandler(async (req, res) => {
  const data = await analyticsService.getOrgAnalytics({
    org: req.params.id,
    studentIds: null,
    days: windowDays(req.query.days),
  });
  return sendSuccess(res, data, 'Organization analytics');
});

export default {
  getPlatformAnalytics,
  getOrgAnalytics,
  getClassroomAnalytics,
  getOrgAnalyticsForSuperadmin,
};
