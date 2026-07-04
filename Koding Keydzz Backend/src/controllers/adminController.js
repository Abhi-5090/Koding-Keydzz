import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import * as adminService from '../services/adminService.js';
import * as studentBulkService from '../services/studentBulkService.js';

export const getStats = asyncHandler(async (req, res) => {
  const data = await adminService.getStats(req.user.org);
  return sendSuccess(res, data, 'Admin stats');
});

export const listStudents = asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;
  const data = await adminService.listStudents({
    search,
    page: Number(page),
    limit: Number(limit),
    org: req.user.org,
  });
  return sendSuccess(res, data, 'Students');
});

export const createStudent = asyncHandler(async (req, res) => {
  const data = await studentBulkService.createStudent(req.body, req.user.org);
  return sendSuccess(res, data, 'Student created', 201);
});

export const bulkUploadStudents = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    throw ApiError.badRequest('No file provided (field name: "file")');
  }
  const password = req.body?.password;
  if (!password || String(password).length < 6) {
    throw ApiError.badRequest('A common password (field "password", min 6) is required');
  }
  const data = await studentBulkService.bulkCreateStudents(req.file.buffer, {
    org: req.user.org,
    commonPassword: String(password),
  });
  return sendSuccess(res, data, 'Bulk upload processed', 201);
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
  const data = await adminService.setStudentSuspension(
    req.params.id,
    suspend,
    req.user.org
  );
  return sendSuccess(res, data, suspend ? 'Student suspended' : 'Student reactivated');
});

export const resetStudentPassword = asyncHandler(async (req, res) => {
  const data = await adminService.resetStudentPassword(
    req.params.id,
    req.body?.password,
    req.user.org
  );
  return sendSuccess(res, data, 'Student password reset');
});

export const exportStudents = asyncHandler(async (req, res) => {
  const { csv, filename } = await adminService.exportRoster(req.user.org);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
});

export const broadcastNotification = asyncHandler(async (req, res) => {
  const data = await adminService.broadcastNotification(req.body);
  return sendSuccess(res, data, 'Broadcast sent');
});

/* ---- Generic CRUD controller factory ---- */
function crudController(crud, label) {
  return {
    list: asyncHandler(async (_req, res) => {
      const data = await crud.list();
      return sendSuccess(res, data, `${label} list`);
    }),
    get: asyncHandler(async (req, res) => {
      const data = await crud.get(req.params.id);
      return sendSuccess(res, data, label);
    }),
    create: asyncHandler(async (req, res) => {
      const data = await crud.create(req.body);
      return sendSuccess(res, data, `${label} created`, 201);
    }),
    update: asyncHandler(async (req, res) => {
      const data = await crud.update(req.params.id, req.body);
      return sendSuccess(res, data, `${label} updated`);
    }),
    remove: asyncHandler(async (req, res) => {
      const data = await crud.remove(req.params.id);
      return sendSuccess(res, data, `${label} deleted`);
    }),
  };
}

export const coursesController = crudController(adminService.coursesCrud, 'Course');
export const lessonsController = crudController(adminService.lessonsCrud, 'Lesson');
export const challengesController = crudController(adminService.challengesCrud, 'Challenge');
export const achievementsController = crudController(
  adminService.achievementsCrud,
  'Achievement'
);

export default {
  getStats,
  listStudents,
  createStudent,
  bulkUploadStudents,
  studentsTemplate,
  suspendStudent,
  resetStudentPassword,
  exportStudents,
  broadcastNotification,
  coursesController,
  lessonsController,
  challengesController,
  achievementsController,
};
