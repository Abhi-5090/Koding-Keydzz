import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import * as superadminService from '../services/superadminService.js';
import * as studentBulkService from '../services/studentBulkService.js';
import { recordAudit } from '../services/auditService.js';
import * as questionBank from '../services/questionBankService.js';

export const createOrg = asyncHandler(async (req, res) => {
  const data = await superadminService.createOrg(req.body, req.user._id);
  return sendSuccess(res, data, 'Organization created', 201);
});

export const listOrgs = asyncHandler(async (_req, res) => {
  const data = await superadminService.listOrgs();
  return sendSuccess(res, data, 'Organizations');
});

export const getOrg = asyncHandler(async (req, res) => {
  const data = await superadminService.getOrg(req.params.id);
  return sendSuccess(res, data, 'Organization');
});

export const updateOrg = asyncHandler(async (req, res) => {
  const data = await superadminService.updateOrg(req.params.id, req.body);
  return sendSuccess(res, data, 'Organization updated');
});

export const updateOrgAdmin = asyncHandler(async (req, res) => {
  const data = await superadminService.updateOrgAdmin(req.params.id, req.body);
  return sendSuccess(res, data, 'Organization admin updated');
});

export const deleteOrg = asyncHandler(async (req, res) => {
  const data = await superadminService.deleteOrg(req.params.id);
  return sendSuccess(res, data, 'Organization deleted');
});

export const getStats = asyncHandler(async (_req, res) => {
  const data = await superadminService.getStats();
  return sendSuccess(res, data, 'Super admin stats');
});

export const getAnalytics = asyncHandler(async (_req, res) => {
  const data = await superadminService.getAnalytics();
  return sendSuccess(res, data, 'Platform analytics');
});

/**
 * Users who belong to no organization.
 *
 * A tenant orphan can still sign in but is owned by no school, so no admin can
 * see them and every org-scoped query filters them out. This is the only place
 * in the product they are visible.
 */
export const listUnassignedUsers = asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 25 } = req.query;
  const data = await superadminService.listUnassignedUsers({
    search,
    page: Number(page),
    limit: Number(limit),
  });
  return sendSuccess(res, data, 'Users without an organization');
});

/**
 * Put a user into an organization, or move them between organizations.
 *
 * Audited rather than silent: this changes which school owns a person's data,
 * which is exactly the class of action a school will later ask to see a record
 * of.
 */
export const assignUserOrganization = asyncHandler(async (req, res) => {
  const result = await superadminService.assignUserOrganization(req.params.id, req.body.org);

  await recordAudit(req, {
    action: result.from ? 'user.org.moved' : 'user.org.assigned',
    targetType: 'user',
    targetId: result.id,
    targetLabel: result.name,
    meta: {
      role: result.role,
      fromOrg: result.from,
      toOrg: result.to.id,
      toOrgName: result.to.name,
      // Recorded because a move silently drops classroom membership, and
      // "why did this pupil vanish from my class?" is the question this
      // answers six months later.
      classroomsLeft: result.classroomsLeft,
    },
  });

  return sendSuccess(
    res,
    result,
    result.from
      ? `Moved ${result.name} to ${result.to.name}`
      : `${result.name} is now part of ${result.to.name}`
  );
});

/* -------------------------------------------------------------------------- */
/* The question bank                                                          */
/* -------------------------------------------------------------------------- */

export const listQuestions = asyncHandler(async (req, res) => {
  const data = await questionBank.listQuestions(req.query);
  return sendSuccess(res, data, 'Questions');
});

export const createQuestion = asyncHandler(async (req, res) => {
  const data = await questionBank.createQuestion(req.body, req.user._id);
  await recordAudit(req, {
    action: 'question.create',
    targetType: 'Question',
    targetId: data.id,
    targetLabel: data.prompt.slice(0, 80),
    meta: { courseSlug: data.courseSlug, type: data.type, difficulty: data.difficulty },
  });
  return sendSuccess(res, data, 'Question added', 201);
});

export const updateQuestion = asyncHandler(async (req, res) => {
  const data = await questionBank.updateQuestion(req.params.id, req.body);
  await recordAudit(req, {
    action: 'question.update',
    targetType: 'Question',
    targetId: data.id,
    targetLabel: data.prompt.slice(0, 80),
  });
  return sendSuccess(res, data, 'Question updated');
});

/**
 * Retire rather than delete.
 *
 * Past attempts store the question ids they drew, so removing the document
 * would leave a pupil unable to see the paper they sat.
 */
export const retireQuestion = asyncHandler(async (req, res) => {
  const data = await questionBank.retireQuestion(req.params.id);
  await recordAudit(req, {
    action: 'question.retire',
    targetType: 'Question',
    targetId: data.id,
    targetLabel: data.prompt.slice(0, 80),
  });
  return sendSuccess(res, data, 'Question retired — it will not be drawn again');
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  const data = await questionBank.deleteQuestion(req.params.id);
  await recordAudit(req, {
    action: 'question.delete',
    targetType: 'Question',
    targetId: data.id,
  });
  return sendSuccess(res, data, 'Question deleted');
});

/**
 * Whether a course's bank can produce a final test, and where it is short.
 *
 * The failure this prevents is invisible until the worst moment: a pupil who
 * has finished an entire course pressing "Start test" and being told the bank
 * is too small.
 */
export const getBankCoverage = asyncHandler(async (req, res) => {
  const data = await questionBank.bankCoverage(req.params.slug);
  return sendSuccess(res, data, `${data.courseTitle} question bank`);
});

export const listStudents = asyncHandler(async (req, res) => {
  const { search = '', org = '', page = 1, limit = 20 } = req.query;
  const data = await superadminService.listAllStudents({
    search,
    org: org || null,
    page: Number(page),
    limit: Number(limit),
  });
  return sendSuccess(res, data, 'Students');
});

export const getStudentDetail = asyncHandler(async (req, res) => {
  const data = await superadminService.getStudentDetail(req.params.id);
  return sendSuccess(res, data, 'Student detail');
});

export const getOrgStudentDetail = asyncHandler(async (req, res) => {
  const data = await superadminService.getOrgStudentDetail(
    req.params.id,
    req.params.studentId
  );
  return sendSuccess(res, data, 'Student detail');
});

export const listOrgStudents = asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;
  const data = await superadminService.listOrgStudents(req.params.id, {
    search,
    page: Number(page),
    limit: Number(limit),
  });
  return sendSuccess(res, data, 'Students');
});

export const bulkUploadOrgStudents = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    throw ApiError.badRequest('No file provided (field name: "file")');
  }
  const password = req.body?.password;
  if (!password || String(password).length < 6) {
    throw ApiError.badRequest('A common password (field "password", min 6) is required');
  }
  const data = await superadminService.bulkCreateOrgStudents(
    req.params.id,
    req.file.buffer,
    String(password)
  );
  return sendSuccess(res, data, 'Bulk upload processed', 201);
});

export const createOrgStudent = asyncHandler(async (req, res) => {
  const data = await superadminService.createOrgStudent(req.params.id, req.body);
  return sendSuccess(res, data, 'Student created', 201);
});

export const studentsTemplate = asyncHandler(async (_req, res) => {
  const buffer = studentBulkService.buildTemplateBuffer();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="students_template.xlsx"'
  );
  return res.status(200).send(buffer);
});

export const suspendStudent = asyncHandler(async (req, res) => {
  const suspend = req.body?.suspend !== false; // default true
  const data = await superadminService.suspendStudentGlobal(req.params.id, suspend);
  return sendSuccess(res, data, suspend ? 'Student suspended' : 'Student reactivated');
});

export const resetStudentPassword = asyncHandler(async (req, res) => {
  const data = await superadminService.resetStudentPasswordGlobal(
    req.params.id,
    req.body?.password
  );
  return sendSuccess(res, data, 'Student password reset');
});

export const updateStudent = asyncHandler(async (req, res) => {
  const data = await superadminService.updateStudentGlobal(req.params.id, req.body);
  return sendSuccess(res, data, 'Student updated');
});

export const deleteStudent = asyncHandler(async (req, res) => {
  await superadminService.deleteStudentGlobal(req.params.id);
  return sendSuccess(res, { id: req.params.id }, 'Student deleted');
});


/* ---------------------------------------------------------------------------
 * Per-organization staff and classrooms, viewed by the platform owner.
 *
 * The /admin/* equivalents use requireOrg, which deliberately rejects the
 * tenant-less superadmin. These take the organization from the URL instead, so
 * support can act on a school's behalf.
 * ------------------------------------------------------------------------- */

export const listOrgStaff = asyncHandler(async (req, res) => {
  const staffService = await import('../services/staffService.js');
  const data = await staffService.listStaff({
    org: req.params.id,
    role: req.query.role || null,
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25,
  });
  return sendSuccess(res, data, 'Organization staff');
});

export const createOrgStaff = asyncHandler(async (req, res) => {
  const staffService = await import('../services/staffService.js');
  const data = await staffService.createStaff({ ...req.body, org: req.params.id });
  return sendSuccess(res, data, 'Staff member added', 201);
});

export const updateOrgStaff = asyncHandler(async (req, res) => {
  const staffService = await import('../services/staffService.js');
  const data = await staffService.updateStaff({
    org: req.params.id,
    id: req.params.staffId,
    patch: req.body,
  });
  return sendSuccess(res, data, 'Staff member updated');
});

export const resetOrgStaffPassword = asyncHandler(async (req, res) => {
  const staffService = await import('../services/staffService.js');
  const data = await staffService.resetStaffPassword({
    org: req.params.id,
    id: req.params.staffId,
    password: req.body?.password || null,
  });
  return sendSuccess(res, data, 'Password reset');
});

export const deleteOrgStaff = asyncHandler(async (req, res) => {
  const staffService = await import('../services/staffService.js');
  await staffService.deleteStaff({ org: req.params.id, id: req.params.staffId });
  return sendSuccess(res, { id: req.params.staffId }, 'Staff member removed');
});

export const listOrgClassrooms = asyncHandler(async (req, res) => {
  const classroomService = await import('../services/classroomService.js');
  const data = await classroomService.listClassrooms({
    org: req.params.id,
    classroomScope: null,
    search: req.query.search || '',
    includeArchived: req.query.includeArchived === 'true',
  });
  return sendSuccess(res, data, 'Organization classrooms');
});

/** Platform-wide audit trail (every tenant). Superadmin only. */
export const getAuditLog = asyncHandler(async (req, res) => {
  const { listAudit } = await import('../services/auditService.js');
  const data = await listAudit({
    org: null,
    action: req.query.action,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 50,
  });
  return sendSuccess(res, data, 'Audit log');
});

export const broadcastPlatform = asyncHandler(async (req, res) => {
  const { title, body, scope, org } = req.body;
  const data = await superadminService.broadcastPlatform({ title, body, scope, org });
  return sendSuccess(res, data, 'Broadcast sent');
});

export default {
  broadcastPlatform,
  getAuditLog,
  listOrgStaff,
  createOrgStaff,
  updateOrgStaff,
  resetOrgStaffPassword,
  deleteOrgStaff,
  listOrgClassrooms,
  createOrg,
  listOrgs,
  getOrg,
  updateOrg,
  updateOrgAdmin,
  deleteOrg,
  getStats,
  getAnalytics,
  listStudents,
  getStudentDetail,
  getOrgStudentDetail,
  listOrgStudents,
  bulkUploadOrgStudents,
  createOrgStudent,
  studentsTemplate,
  suspendStudent,
  resetStudentPassword,
  updateStudent,
  deleteStudent,
};
