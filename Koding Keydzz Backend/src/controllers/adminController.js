import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import * as realmGrantService from '../services/realmGrantService.js';
import * as adminService from '../services/adminService.js';
import { recordAudit, listAudit } from '../services/auditService.js';
import * as studentBulkService from '../services/studentBulkService.js';
import * as reportService from '../services/reportService.js';
import { studentIdsInScope } from '../services/classroomService.js';
import * as testResults from '../services/testResultsService.js';
import * as marking from '../services/markingService.js';
import * as insights from '../services/teachingInsightsService.js';
import * as assignments from '../services/assignmentService.js';
import * as guardianAdmin from '../services/guardianService.js';

/**
 * Resolve the caller's student scope.
 *
 * Returns null for an admin/superadmin (the whole organization) and an array
 * of ids for a faculty member (the pupils in their own classrooms). Every
 * student read/write below passes it through, so granting faculty
 * `student:read` cannot expose the rest of the school.
 */
async function scopeFor(req) {
  return studentIdsInScope({ org: req.orgId ?? req.user.org, classroomScope: req.classroomScope });
}

export const getStats = asyncHandler(async (req, res) => {
  const data = await adminService.getStats(req.user.org, await scopeFor(req));
  return sendSuccess(res, data, 'Admin stats');
});

export const listStudents = asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;
  const data = await adminService.listStudents({
    search,
    page: Number(page),
    limit: Number(limit),
    org: req.user.org,
    studentIds: await scopeFor(req),
  });
  return sendSuccess(res, data, 'Students');
});

export const createStudent = asyncHandler(async (req, res) => {
  const data = await studentBulkService.createStudent(req.body, req.user.org);
  await recordAudit(req, {
    action: 'student.create',
    targetType: 'User',
    targetId: data?.student?._id,
    targetLabel: data?.student?.name,
    meta: { username: data?.username },
  });
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
  await recordAudit(req, {
    action: 'student.bulk_import',
    targetType: 'Organization',
    targetId: req.user.org,
    meta: { created: data?.createdCount, skipped: data?.skippedCount },
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
  await recordAudit(req, {
    action: suspend ? 'student.suspend' : 'student.reactivate',
    targetType: 'User',
    targetId: req.params.id,
    targetLabel: data?.name,
  });
  return sendSuccess(res, data, suspend ? 'Student suspended' : 'Student reactivated');
});

export const resetStudentPassword = asyncHandler(async (req, res) => {
  const data = await adminService.resetStudentPassword(
    req.params.id,
    req.body?.password,
    req.user.org,
    await scopeFor(req)
  );
  await recordAudit(req, {
    action: 'student.reset_password',
    targetType: 'User',
    targetId: req.params.id,
    targetLabel: data?.student?.name,
    // Deliberately no password in the audit record.
    meta: { generated: !req.body?.password },
  });
  return sendSuccess(res, data, 'Student password reset');
});

export const updateStudent = asyncHandler(async (req, res) => {
  const data = await adminService.updateStudent(req.params.id, req.body, req.user.org);
  await recordAudit(req, {
    action: 'student.update',
    targetType: 'User',
    targetId: req.params.id,
    targetLabel: data?.name,
    meta: { fields: Object.keys(req.body || {}) },
  });
  return sendSuccess(res, data, 'Student updated');
});

export const deleteStudent = asyncHandler(async (req, res) => {
  const result = await adminService.deleteStudent(req.params.id, req.user.org);
  await recordAudit(req, {
    action: 'student.delete',
    targetType: 'User',
    targetId: req.params.id,
    // Keep the freed login ids so the action is traceable after the fact.
    meta: { softDeleted: true, freed: result?.freed },
  });
  return sendSuccess(res, { id: req.params.id }, 'Student deleted');
});

export const exportStudents = asyncHandler(async (req, res) => {
  const { csv, filename } = await adminService.exportRoster(
    req.user.org,
    await scopeFor(req)
  );
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
});

export const broadcastNotification = asyncHandler(async (req, res) => {
  // req.orgId is set by requireOrg. Passing it is what keeps a school's
  // announcement inside that school.
  const data = await adminService.broadcastNotification({
    ...req.body,
    org: req.orgId,
  });
  await recordAudit(req, {
    action: 'notification.broadcast',
    targetType: 'Organization',
    targetId: req.orgId,
    meta: { recipients: data?.count, scope: data?.scope },
  });
  return sendSuccess(res, data, 'Broadcast sent');
});

/**
 * Class report: per-student coverage, average score and an explicit
 * "needs attention" list. The question a teacher actually has.
 */
/**
 * Announce to one class.
 *
 * `scopeFor(req)` carries the caller's classroom scope, so a faculty member is
 * confined to the classes they teach and an administrator is not.
 */
export const announceToClassroom = asyncHandler(async (req, res) => {
  const data = await adminService.announceToClassroom({
    title: req.body.title,
    body: req.body.body,
    org: req.orgId,
    classroomId: req.params.id,
    classroomScope: req.classroomScope ?? null,
  });
  await recordAudit(req, {
    action: 'notification.classroom',
    targetType: 'Classroom',
    targetId: req.params.id,
    meta: { recipients: data?.count },
  });
  return sendSuccess(res, data, 'Announcement sent to the class');
});

/* ---- Assignments ---- */

export const createAssignment = asyncHandler(async (req, res) => {
  const data = await assignments.createAssignment({
    org: req.orgId,
    classroomId: req.params.id,
    classroomScope: req.classroomScope ?? null,
    createdBy: req.user._id,
    ...req.body,
  });
  await recordAudit(req, {
    action: 'assignment.create',
    targetType: 'Assignment',
    targetId: data.id,
    meta: { classroom: String(req.params.id), title: data.title },
  });
  return sendSuccess(res, data, 'Assignment set', 201);
});

export const listClassroomAssignments = asyncHandler(async (req, res) => {
  const data = await assignments.listForClassroom({
    org: req.orgId,
    classroomId: req.params.id,
    classroomScope: req.classroomScope ?? null,
    includeArchived: req.query.includeArchived === 'true',
  });
  return sendSuccess(res, data, 'Assignments');
});

export const updateAssignment = asyncHandler(async (req, res) => {
  const data = await assignments.updateAssignment({
    org: req.orgId,
    id: req.params.id,
    classroomScope: req.classroomScope ?? null,
    patch: req.body,
  });
  await recordAudit(req, {
    action: 'assignment.update',
    targetType: 'Assignment',
    targetId: data.id,
  });
  return sendSuccess(res, data, 'Assignment updated');
});

export const archiveAssignment = asyncHandler(async (req, res) => {
  const data = await assignments.archiveAssignment({
    org: req.orgId,
    id: req.params.id,
    classroomScope: req.classroomScope ?? null,
    archive: req.body?.archive !== false,
  });
  await recordAudit(req, {
    action: data.archivedAt ? 'assignment.archive' : 'assignment.restore',
    targetType: 'Assignment',
    targetId: data.id,
  });
  return sendSuccess(res, data, data.archivedAt ? 'Assignment archived' : 'Assignment restored');
});

/* ---- Guardians ---- */

/**
 * Link a guardian to a pupil.
 *
 * ADMIN ONLY, and this is the consent gate for the whole parent feature: a
 * guardian can never claim a child, because the school is the only party that
 * knows who a child's guardian is. Audited, because it grants a person sight
 * of a named child's record.
 */
export const linkGuardian = asyncHandler(async (req, res) => {
  const data = await guardianAdmin.linkGuardian({
    org: req.orgId,
    guardianId: req.params.id,
    studentId: req.body.studentId,
  });
  await recordAudit(req, {
    action: 'guardian.link',
    targetType: 'User',
    targetId: req.params.id,
    meta: { student: data.student },
  });
  return sendSuccess(res, data, 'Guardian linked');
});

export const unlinkGuardian = asyncHandler(async (req, res) => {
  const data = await guardianAdmin.unlinkGuardian({
    org: req.orgId,
    guardianId: req.params.id,
    studentId: req.body.studentId,
  });
  await recordAudit(req, {
    action: 'guardian.unlink',
    targetType: 'User',
    targetId: req.params.id,
    meta: { student: String(req.body.studentId) },
  });
  return sendSuccess(res, data, 'Guardian unlinked');
});

export const listGuardians = asyncHandler(async (req, res) => {
  const data = await guardianAdmin.listGuardians({ org: req.orgId });
  return sendSuccess(res, data, 'Guardians');
});

export const getClassReport = asyncHandler(async (req, res) => {
  const data = await reportService.getClassReport({
    org: req.user.org,
    grade: req.query.grade,
    studentIds: await scopeFor(req),
  });
  return sendSuccess(res, data, 'Class report');
});

/** Per-question / per-student breakdown for one quiz across the school. */
export const getQuizReport = asyncHandler(async (req, res) => {
  const data = await reportService.getQuizReport({
    org: req.user.org,
    quizId: req.params.id,
    studentIds: await scopeFor(req),
  });
  return sendSuccess(res, data, 'Quiz report');
});

/** CSV of the class report — printable, or for a parent meeting. */
export const exportClassReport = asyncHandler(async (req, res) => {
  const { csv, filename } = await reportService.exportClassReport({
    org: req.user.org,
    grade: req.query.grade,
    studentIds: await scopeFor(req),
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
});

/** This school's audit trail. Scoped to the admin's own organization. */
/* ---- Opening a realm by hand ---------------------------------------------
 * The grant only ever ADDS access; the derived ladder still opens a realm a
 * pupil has earned. See services/realmGrantService.js.
 * ------------------------------------------------------------------------ */

export const getRealmRoster = asyncHandler(async (req, res) => {
  const data = await realmGrantService.realmRoster({
    org: req.user.org,
    // A teacher sees their own classes; an administrator sees the school.
    scopeIds: await scopeFor(req),
    slug: req.params.slug,
  });
  return sendSuccess(res, data, 'Realm roster');
});

export const grantRealm = asyncHandler(async (req, res) => {
  const data = await realmGrantService.grantRealm({
    pupilId: req.params.id,
    slug: req.params.slug,
    org: req.user.org,
    scopeIds: await scopeFor(req),
    grantedBy: req.user._id,
  });
  return sendSuccess(res, data, 'Realm opened');
});

export const revokeRealm = asyncHandler(async (req, res) => {
  const data = await realmGrantService.revokeRealm({
    pupilId: req.params.id,
    slug: req.params.slug,
    org: req.user.org,
    scopeIds: await scopeFor(req),
  });
  return sendSuccess(res, data, 'Realm grant withdrawn');
});

export const getAuditLog = asyncHandler(async (req, res) => {
  const data = await listAudit({
    org: req.user.org,
    action: req.query.action,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 50,
  });
  return sendSuccess(res, data, 'Audit log');
});

export const getStudentDetail = asyncHandler(async (req, res) => {
  const data = await adminService.getStudentDetail(
    req.params.id,
    req.user.org,
    await scopeFor(req)
  );
  return sendSuccess(res, data, 'Student detail');
});

/* ---- Quiz management (custom CRUD — nested questions, answers exposed) ---- */
export const quizzesController = {
  list: asyncHandler(async (_req, res) => {
    const data = await adminService.listQuizzes();
    return sendSuccess(res, data, 'Quiz list');
  }),
  get: asyncHandler(async (req, res) => {
    const data = await adminService.getQuiz(req.params.id);
    return sendSuccess(res, data, 'Quiz');
  }),
  create: asyncHandler(async (req, res) => {
    const data = await adminService.createQuiz(req.body);
    await recordAudit(req, {
      action: 'quiz.create',
      targetType: 'Quiz',
      targetId: data?._id,
      targetLabel: data?.title,
    });
    return sendSuccess(res, data, 'Quiz created', 201);
  }),
  update: asyncHandler(async (req, res) => {
    const data = await adminService.updateQuiz(req.params.id, req.body);
    await recordAudit(req, {
      action: 'quiz.update',
      targetType: 'Quiz',
      targetId: req.params.id,
      targetLabel: data?.title,
    });
    return sendSuccess(res, data, 'Quiz updated');
  }),
  remove: asyncHandler(async (req, res) => {
    const data = await adminService.removeQuiz(req.params.id);
    await recordAudit(req, {
      action: 'quiz.delete',
      targetType: 'Quiz',
      targetId: req.params.id,
    });
    return sendSuccess(res, data, 'Quiz deleted');
  }),
};

/* ---- Generic CRUD controller factory ---- */
function crudController(crud, label) {
  // Content records are GLOBAL (shared by every tenant), so each write is
  // audited: "which account changed the curriculum?" was previously
  // unanswerable.
  const slug = label.toLowerCase().replace(/\s+/g, '_');
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
      await recordAudit(req, {
        action: `${slug}.create`,
        targetType: label,
        targetId: data?._id,
        targetLabel: data?.title || data?.name || data?.key,
      });
      return sendSuccess(res, data, `${label} created`, 201);
    }),
    update: asyncHandler(async (req, res) => {
      const data = await crud.update(req.params.id, req.body);
      await recordAudit(req, {
        action: `${slug}.update`,
        targetType: label,
        targetId: req.params.id,
        targetLabel: data?.title || data?.name || data?.key,
        meta: { fields: Object.keys(req.body || {}) },
      });
      return sendSuccess(res, data, `${label} updated`);
    }),
    remove: asyncHandler(async (req, res) => {
      const data = await crud.remove(req.params.id);
      await recordAudit(req, {
        action: `${slug}.delete`,
        targetType: label,
        targetId: req.params.id,
      });
      return sendSuccess(res, data, `${label} deleted`);
    }),
  };
}

export const coursesController = crudController(adminService.coursesCrud, 'Course');
export const lessonsController = crudController(adminService.lessonsCrud, 'Lesson');
export const worldsController = crudController(adminService.worldsCrud, 'World');
export const challengesController = crudController(adminService.challengesCrud, 'Challenge');
export const achievementsController = crudController(
  adminService.achievementsCrud,
  'Achievement'
);
export const shopItemsController = crudController(adminService.shopItemsCrud, 'Shop item');

export default {
  getStats,
  listStudents,
  createStudent,
  bulkUploadStudents,
  studentsTemplate,
  suspendStudent,
  resetStudentPassword,
  updateStudent,
  deleteStudent,
  exportStudents,
  broadcastNotification,
  announceToClassroom,
  createAssignment,
  listClassroomAssignments,
  updateAssignment,
  archiveAssignment,
  linkGuardian,
  unlinkGuardian,
  listGuardians,
  getStudentDetail,
  getAuditLog,
  getClassReport,
  getQuizReport,
  exportClassReport,
  getRealmRoster,
  grantRealm,
  revokeRealm,
  coursesController,
  lessonsController,
  worldsController,
  challengesController,
  achievementsController,
  shopItemsController,
  quizzesController,
};

/**
 * Final-test results for a course, scoped to this school — and, for a teacher,
 * to their own classes.
 *
 * READ ONLY. Staff track and support; they never mark or change a score. The
 * paper itself is deliberately not returned: it carries the questions pupils
 * are examined on.
 */
/* ---- Teaching insights ----
 *
 * The platform already stored all of this and surfaced none of it. A teacher
 * could see WHO was stuck but not WHAT was stopping them — which is the more
 * actionable question.
 */

export const getHardestQuestions = asyncHandler(async (req, res) => {
  const data = await insights.hardestQuestions({
    org: req.user.org,
    courseSlug: req.query.courseSlug || null,
    classroomScope: req.classroomScope,
    limit: Math.min(100, Number(req.query.limit) || 20),
  });
  return sendSuccess(res, data, 'Hardest questions');
});

export const getHardestQuizzes = asyncHandler(async (req, res) => {
  const data = await insights.hardestQuizzes({
    org: req.user.org,
    classroomScope: req.classroomScope,
    limit: Math.min(100, Number(req.query.limit) || 20),
  });
  return sendSuccess(res, data, 'Hardest quizzes');
});

export const getStallPoints = asyncHandler(async (req, res) => {
  const data = await insights.stallPoints({
    org: req.user.org,
    classroomScope: req.classroomScope,
  });
  return sendSuccess(res, data, 'Where pupils are stalling');
});

/**
 * The marking queue: answers the machine could not mark.
 *
 * Scoped like every other student read — to the school, and for a teacher to
 * their own classes. This is the only surface that shows a mark scheme to
 * staff, because a marker cannot judge work without knowing what was asked.
 */
export const getReviewQueue = asyncHandler(async (req, res) => {
  const data = await marking.reviewQueue({
    org: req.user.org,
    classroomScope: req.classroomScope,
    limit: Math.min(200, Number(req.query.limit) || 50),
  });
  return sendSuccess(res, data, 'Marking queue');
});

/** Award marks to one flagged answer. Audited. */
export const markTestAnswer = asyncHandler(async (req, res) => {
  const data = await marking.markAnswer({
    req,
    org: req.user.org,
    classroomScope: req.classroomScope,
    attemptId: req.params.attemptId,
    questionId: req.body.questionId,
    marks: req.body.marks,
    comment: req.body.comment || '',
  });
  return sendSuccess(res, data, 'Marked');
});

export const getTestResults = asyncHandler(async (req, res) => {
  const data = await testResults.courseResults({
    org: req.user.org,
    courseSlug: req.params.slug,
    classroomScope: req.classroomScope,
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25,
  });
  return sendSuccess(res, data, data.course ? `${data.course.title} results` : 'Results');
});
