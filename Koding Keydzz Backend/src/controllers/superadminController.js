import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import * as superadminService from '../services/superadminService.js';
import * as studentBulkService from '../services/studentBulkService.js';

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

export default {
  createOrg,
  listOrgs,
  getOrg,
  updateOrg,
  updateOrgAdmin,
  deleteOrg,
  getStats,
  getAnalytics,
  listStudents,
  listOrgStudents,
  bulkUploadOrgStudents,
  createOrgStudent,
  studentsTemplate,
  suspendStudent,
  resetStudentPassword,
};
