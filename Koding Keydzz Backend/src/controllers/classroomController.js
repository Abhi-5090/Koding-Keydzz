import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as classroomService from '../services/classroomService.js';
import { recordAudit } from '../services/auditService.js';

/**
 * Classrooms.
 *
 * `req.classroomScope` is set by withClassroomScope: null for an admin (the
 * whole school) or an array of classroom ids for a faculty member. Passing it
 * through is what makes "faculty see only their own classes" hold without
 * every handler re-deriving it.
 */

export const listClassrooms = asyncHandler(async (req, res) => {
  const data = await classroomService.listClassrooms({
    org: req.orgId,
    classroomScope: req.classroomScope,
    search: req.query.search || '',
    includeArchived: req.query.includeArchived === 'true',
  });
  return sendSuccess(res, data, 'Classrooms');
});

export const getClassroom = asyncHandler(async (req, res) => {
  const data = await classroomService.getClassroom({
    org: req.orgId,
    id: req.params.id,
    classroomScope: req.classroomScope,
  });
  return sendSuccess(res, data, 'Classroom');
});

export const createClassroom = asyncHandler(async (req, res) => {
  const data = await classroomService.createClassroom({
    ...req.body,
    org: req.orgId,
    createdBy: req.user._id,
  });
  await recordAudit(req, {
    action: 'classroom.create',
    targetType: 'Classroom',
    targetId: data.id,
    targetLabel: data.name,
  });
  return sendSuccess(res, data, 'Class created', 201);
});

export const updateClassroom = asyncHandler(async (req, res) => {
  const data = await classroomService.updateClassroom({
    org: req.orgId,
    id: req.params.id,
    patch: req.body,
    classroomScope: req.classroomScope,
  });
  await recordAudit(req, {
    action: 'classroom.update',
    targetType: 'Classroom',
    targetId: req.params.id,
    targetLabel: data.name,
    meta: { fields: Object.keys(req.body || {}) },
  });
  return sendSuccess(res, data, 'Class updated');
});

export const updateRoster = asyncHandler(async (req, res) => {
  const data = await classroomService.updateRoster({
    org: req.orgId,
    id: req.params.id,
    add: req.body.add || [],
    remove: req.body.remove || [],
    classroomScope: req.classroomScope,
  });
  await recordAudit(req, {
    action: 'classroom.roster',
    targetType: 'Classroom',
    targetId: req.params.id,
    targetLabel: data.name,
    meta: { added: (req.body.add || []).length, removed: (req.body.remove || []).length },
  });
  return sendSuccess(res, data, 'Class roster updated');
});

export const updateFaculty = asyncHandler(async (req, res) => {
  const data = await classroomService.updateFaculty({
    org: req.orgId,
    id: req.params.id,
    add: req.body.add || [],
    remove: req.body.remove || [],
  });
  await recordAudit(req, {
    action: 'classroom.faculty',
    targetType: 'Classroom',
    targetId: req.params.id,
    targetLabel: data.name,
    meta: { added: (req.body.add || []).length, removed: (req.body.remove || []).length },
  });
  return sendSuccess(res, data, 'Class teachers updated');
});

export const archiveClassroom = asyncHandler(async (req, res) => {
  const archive = req.body?.archive !== false;
  const data = await classroomService.archiveClassroom({
    org: req.orgId,
    id: req.params.id,
    archive,
  });
  await recordAudit(req, {
    action: archive ? 'classroom.archive' : 'classroom.restore',
    targetType: 'Classroom',
    targetId: req.params.id,
    targetLabel: data.name,
  });
  return sendSuccess(res, data, archive ? 'Class archived' : 'Class restored');
});

export default {
  listClassrooms,
  getClassroom,
  createClassroom,
  updateClassroom,
  updateRoster,
  updateFaculty,
  archiveClassroom,
};
