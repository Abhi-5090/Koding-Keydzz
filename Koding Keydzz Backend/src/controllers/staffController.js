import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as staffService from '../services/staffService.js';
import { recordAudit } from '../services/auditService.js';

/**
 * Organization staff (administrators and faculty).
 *
 * `req.orgId` is set by requireOrg, so every handler is automatically scoped
 * to the caller's own school. The superadmin manages staff through
 * /superadmin/orgs/:id/staff instead, where the org comes from the URL.
 */

export const listStaff = asyncHandler(async (req, res) => {
  const data = await staffService.listStaff({
    org: req.orgId,
    role: req.query.role || null,
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25,
  });
  return sendSuccess(res, data, 'Staff');
});

export const createStaff = asyncHandler(async (req, res) => {
  const data = await staffService.createStaff({ ...req.body, org: req.orgId });
  await recordAudit(req, {
    action: `staff.create.${req.body.role}`,
    targetType: 'User',
    targetId: data.staff.id,
    targetLabel: data.staff.name,
    meta: { role: data.staff.role },
  });
  return sendSuccess(res, data, 'Staff member added', 201);
});

export const getStaff = asyncHandler(async (req, res) => {
  const data = await staffService.getStaff({ org: req.orgId, id: req.params.id });
  return sendSuccess(res, data, 'Staff member');
});

export const updateStaff = asyncHandler(async (req, res) => {
  const data = await staffService.updateStaff({
    org: req.orgId,
    id: req.params.id,
    patch: req.body,
  });
  await recordAudit(req, {
    action: 'staff.update',
    targetType: 'User',
    targetId: req.params.id,
    targetLabel: data.name,
    meta: { fields: Object.keys(req.body || {}) },
  });
  return sendSuccess(res, data, 'Staff member updated');
});

export const suspendStaff = asyncHandler(async (req, res) => {
  const suspend = req.body?.suspend !== false;
  const data = await staffService.setStaffSuspension({
    org: req.orgId,
    id: req.params.id,
    suspend,
  });
  await recordAudit(req, {
    action: suspend ? 'staff.suspend' : 'staff.reactivate',
    targetType: 'User',
    targetId: req.params.id,
    targetLabel: data.name,
  });
  return sendSuccess(res, data, suspend ? 'Staff member suspended' : 'Staff member reactivated');
});

export const resetStaffPassword = asyncHandler(async (req, res) => {
  const data = await staffService.resetStaffPassword({
    org: req.orgId,
    id: req.params.id,
    password: req.body?.password || null,
  });
  await recordAudit(req, {
    action: 'staff.reset_password',
    targetType: 'User',
    targetId: req.params.id,
    targetLabel: data.staff.name,
    // Never the password itself.
    meta: { generated: !req.body?.password },
  });
  return sendSuccess(res, data, 'Password reset');
});

export const deleteStaff = asyncHandler(async (req, res) => {
  const data = await staffService.deleteStaff({ org: req.orgId, id: req.params.id });
  await recordAudit(req, {
    action: 'staff.delete',
    targetType: 'User',
    targetId: req.params.id,
    meta: { softDeleted: true, freed: data.freed },
  });
  return sendSuccess(res, { id: req.params.id }, 'Staff member removed');
});

export default {
  listStaff,
  createStaff,
  getStaff,
  updateStaff,
  suspendStaff,
  resetStaffPassword,
  deleteStaff,
};
