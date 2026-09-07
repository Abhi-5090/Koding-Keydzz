import { Router } from 'express';
import multer from 'multer';
import * as adminController from '../controllers/adminController.js';
import * as certificateController from '../controllers/certificateController.js';
import * as staffController from '../controllers/staffController.js';
import * as classroomController from '../controllers/classroomController.js';
import * as analyticsController from '../controllers/analyticsController.js';
import {
  protect,
  requireOrg,
  requireCapability,
  withClassroomScope,
} from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { accountCreationLimiter } from '../middlewares/rateLimit.js';
import {
  idParam,
  studentsQuerySchema,
  suspendSchema,
  broadcastSchema,
  classroomAnnounceSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  guardianLinkSchema,
  createStudentSchema,
  updateStudentSchema,
  courseSchema,
  lessonSchema,
  worldSchema,
  challengeSchema,
  achievementSchema,
  quizSchema,
  avatarItemSchema,
  resetPasswordSchema,
  auditQuerySchema,
  classReportQuerySchema,
  createStaffSchema,
  updateStaffSchema,
  staffQuerySchema,
  staffPasswordSchema,
  createClassroomSchema,
  updateClassroomSchema,
  rosterSchema,
  archiveSchema,
  classroomQuerySchema,
  analyticsQuerySchema,
  courseSlugParamSchema,
  markAnswerSchema,
  attemptParamSchema,
  realmGrantParams,
  realmSlugParam,
} from '../utils/validators.js';

// In-memory storage so we can parse the spreadsheet buffer directly.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname || '');
    if (ok) return cb(null, true);
    return cb(new Error('Only .xlsx, .xls or .csv files are allowed'));
  },
});

const router = Router();

// All admin routes require authentication.
router.use(protect);

/* ---------------------------------------------------------------------------
 * Org-scoped routes.
 *
 * Guards are declared as CAPABILITIES rather than role strings — see
 * src/config/permissions.js. That is what let a fourth role (faculty) be
 * introduced without editing every route in this file.
 *
 *   orgScoped        any org member with the capability, tenant-bound
 *   withClassroomScope  resolves req.classroomScope so faculty are narrowed
 *                       to the classes they actually teach
 * ------------------------------------------------------------------------- */
const orgScoped = [requireOrg];

// Reading students: admins see the whole school, faculty only their classes.
const readStudents = [requireOrg, requireCapability('student:read'), withClassroomScope];
const writeStudents = [requireOrg, requireCapability('student:write')];
const readStaff = [requireOrg, requireCapability('staff:read')];
const writeStaff = [requireOrg, requireCapability('staff:write')];
const readClassrooms = [requireOrg, requireCapability('classroom:read'), withClassroomScope];
const writeClassrooms = [requireOrg, requireCapability('classroom:write')];
const manageRoster = [
  requireOrg,
  requireCapability('classroom:manage_roster'),
  withClassroomScope,
];

router.get('/stats', readStudents, adminController.getStats);

/* ---------------------------------------------------------------------------
 * ANALYTICS — the dashboard data source.
 *
 * One endpoint serves both roles: an admin gets the whole school, a faculty
 * member gets exactly the students in their classrooms (resolved from
 * req.classroomScope), so the client does not need two code paths.
 * ------------------------------------------------------------------------- */
router.get(
  '/analytics',
  readStudents,
  validate({ query: analyticsQuerySchema }),
  analyticsController.getOrgAnalytics
);

router.get(
  '/analytics/classrooms/:id',
  readClassrooms,
  validate({ params: idParam, query: analyticsQuerySchema }),
  analyticsController.getClassroomAnalytics
);

/* ---------------------------------------------------------------------------
 * STAFF — administrators and faculty. Admin-only.
 *
 * This is the half of the tenancy model that did not exist: an organization
 * got exactly one admin at creation, with no way to add a co-administrator and
 * no concept of a teacher.
 * ------------------------------------------------------------------------- */
router.get(
  '/staff',
  readStaff,
  validate({ query: staffQuerySchema }),
  staffController.listStaff
);
router.post(
  '/staff',
  writeStaff,
  accountCreationLimiter,
  validate({ body: createStaffSchema }),
  staffController.createStaff
);
router.get('/staff/:id', readStaff, validate({ params: idParam }), staffController.getStaff);
router.patch(
  '/staff/:id',
  writeStaff,
  validate({ params: idParam, body: updateStaffSchema }),
  staffController.updateStaff
);
router.patch(
  '/staff/:id/suspend',
  writeStaff,
  validate({ params: idParam, body: suspendSchema }),
  staffController.suspendStaff
);
router.post(
  '/staff/:id/reset-password',
  writeStaff,
  validate({ params: idParam, body: staffPasswordSchema }),
  staffController.resetStaffPassword
);
router.delete(
  '/staff/:id',
  writeStaff,
  validate({ params: idParam }),
  staffController.deleteStaff
);

/* ---------------------------------------------------------------------------
 * CLASSROOMS — the faculty↔student link.
 *
 * Admins create and delete classes; faculty may adjust the roster of a class
 * they teach but not create or remove classes.
 * ------------------------------------------------------------------------- */
router.get(
  '/classrooms',
  readClassrooms,
  validate({ query: classroomQuerySchema }),
  classroomController.listClassrooms
);
router.post(
  '/classrooms',
  writeClassrooms,
  validate({ body: createClassroomSchema }),
  classroomController.createClassroom
);
router.get(
  '/classrooms/:id',
  readClassrooms,
  validate({ params: idParam }),
  classroomController.getClassroom
);
router.patch(
  '/classrooms/:id',
  writeClassrooms,
  validate({ params: idParam, body: updateClassroomSchema }),
  classroomController.updateClassroom
);
router.post(
  '/classrooms/:id/roster',
  manageRoster,
  validate({ params: idParam, body: rosterSchema }),
  classroomController.updateRoster
);
router.post(
  '/classrooms/:id/faculty',
  writeClassrooms,
  validate({ params: idParam, body: rosterSchema }),
  classroomController.updateFaculty
);
router.patch(
  '/classrooms/:id/archive',
  writeClassrooms,
  validate({ params: idParam, body: archiveSchema }),
  classroomController.archiveClassroom
);

/* ---- Teacher reporting (org-scoped) ---- */
router.get(
  '/reports/class',
  readStudents,
  validate({ query: classReportQuerySchema }),
  adminController.getClassReport
);
/* ---- Opening a realm by hand -------------------------------------------- */

/**
 * Who is ready for a realm, and who has been given it.
 *
 * `realm:grant` rather than `student:read`: this screen exists to make the
 * grant decision, and the two should not drift apart — a teacher who can see
 * the roster here is a teacher who can act on it.
 */
/**
 * `requireOrg` and `withClassroomScope` alongside the capability, mirroring
 * `readStudents`. Without the scope middleware `req.classroomScope` is unset,
 * so a teacher would be handed the whole school instead of their own classes.
 */
const realmGrants = [requireOrg, requireCapability('realm:grant'), withClassroomScope];

router.get(
  '/realms/:slug/roster',
  realmGrants,
  validate({ params: realmSlugParam }),
  adminController.getRealmRoster
);

router.post(
  '/realms/:slug/grant/:id',
  realmGrants,
  validate({ params: realmGrantParams }),
  adminController.grantRealm
);

router.delete(
  '/realms/:slug/grant/:id',
  realmGrants,
  validate({ params: realmGrantParams }),
  adminController.revokeRealm
);

router.get(
  '/reports/class/export',
  readStudents,
  validate({ query: classReportQuerySchema }),
  adminController.exportClassReport
);
router.get(
  '/reports/quiz/:id',
  readStudents,
  validate({ params: idParam }),
  adminController.getQuizReport
);

// Audit trail for THIS school's privileged actions.
router.get(
  '/audit',
  requireOrg,
  requireCapability('audit:org'),
  validate({ query: auditQuerySchema }),
  adminController.getAuditLog
);

/**
 * Final-test results. Uses `readStudents`, so it inherits the org guard, the
 * student:read capability and the classroom narrowing that scopes a teacher to
 * their own pupils — the same three checks every other student read gets.
 */
/**
 * GUARDIANS — parent and carer accounts, and who they may see.
 *
 * Gated on `staff:write` (administrators only), NOT on anything a teacher
 * holds. Linking a guardian grants a person sight of a named child's record,
 * which is a safeguarding decision and belongs with the school office rather
 * than with whoever happens to teach that class this term.
 */
router.get('/guardians', readStaff, adminController.listGuardians);
router.post(
  '/guardians/:id/link',
  writeStaff,
  validate({ params: idParam, body: guardianLinkSchema }),
  adminController.linkGuardian
);
router.post(
  '/guardians/:id/unlink',
  writeStaff,
  validate({ params: idParam, body: guardianLinkSchema }),
  adminController.unlinkGuardian
);

/**
 * ASSIGNMENTS — the primitive the product did not have.
 *
 * Everything a pupil did was pupil-initiated; there was no way for a teacher to
 * say "finish this by Friday". Faculty hold `assignment:write` deliberately,
 * and `withClassroomScope` confines them to classes they actually teach.
 *
 * Completion is DERIVED from progress the pupil already recorded, so there is
 * no submission endpoint here and never will be — see assignmentService.js.
 */
const readAssignments = [requireOrg, requireCapability('assignment:read'), withClassroomScope];
const writeAssignments = [requireOrg, requireCapability('assignment:write'), withClassroomScope];

router.get(
  '/classrooms/:id/assignments',
  readAssignments,
  validate({ params: idParam }),
  adminController.listClassroomAssignments
);
router.post(
  '/classrooms/:id/assignments',
  writeAssignments,
  validate({ params: idParam, body: createAssignmentSchema }),
  adminController.createAssignment
);
router.patch(
  '/assignments/:id',
  writeAssignments,
  validate({ params: idParam, body: updateAssignmentSchema }),
  adminController.updateAssignment
);
router.post(
  '/assignments/:id/archive',
  writeAssignments,
  validate({ params: idParam }),
  adminController.archiveAssignment
);

/* ---- Teaching insights ----
 *
 * Same capability and scope as the class report: a teacher sees their own
 * classes, an admin the whole school. `report:class` rather than a new
 * capability, because this IS reporting — it changes nothing.
 */
router.get(
  '/insights/questions',
  readStudents,
  requireCapability('report:class'),
  adminController.getHardestQuestions
);
router.get(
  '/insights/quizzes',
  readStudents,
  requireCapability('report:class'),
  adminController.getHardestQuizzes
);
router.get(
  '/insights/stalls',
  readStudents,
  requireCapability('report:class'),
  adminController.getStallPoints
);

/* ---- Certificates ----
 *
 * Read and withdraw only. Staff never ISSUE one: a certificate follows a pass,
 * and a pass is earned on the paper. Issuing by hand would make the certificate
 * a statement about who a teacher likes rather than what a pupil did.
 */
router.get('/certificates', readStudents, certificateController.orgCertificates);

router.post(
  '/certificates/:code/revoke',
  readStudents,
  requireCapability('student:write'),
  certificateController.revokeCertificate
);

/**
 * Re-issue any certificate a passed course should have but does not.
 *
 * Needed because issuance is best-effort at pass time — a failure there must
 * not cost a pupil their pass, which means a transient error can leave a gap.
 * Safe to run repeatedly.
 */
router.post(
  '/certificates/reconcile',
  readStudents,
  requireCapability('student:write'),
  certificateController.backfillCertificates
);

/**
 * THE MARKING QUEUE.
 *
 * Gated on `final_test:mark` and narrowed by `readStudents`' classroom scope,
 * so a teacher sees and marks only their own pupils. Deliberately separate
 * from the read-only results surface: results report, marking changes.
 */
router.get(
  '/review-queue',
  readStudents,
  requireCapability('final_test:mark'),
  adminController.getReviewQueue
);

router.post(
  '/review-queue/:attemptId',
  readStudents,
  requireCapability('final_test:mark'),
  validate({ params: attemptParamSchema, body: markAnswerSchema }),
  adminController.markTestAnswer
);

router.get(
  '/test-results/:slug',
  readStudents,
  validate({ params: courseSlugParamSchema }),
  adminController.getTestResults
);

router.get(
  '/students',
  readStudents,
  validate({ query: studentsQuerySchema }),
  adminController.listStudents
);
router.get('/students/template', writeStudents, adminController.studentsTemplate);
router.get('/students/export', readStudents, adminController.exportStudents);
router.post(
  '/students/bulk',
  requireOrg,
  requireCapability('student:import'),
  upload.single('file'),
  adminController.bulkUploadStudents
);
router.post(
  '/students',
  writeStudents,
  // Per-ADMIN, not per-IP: an admin and their whole school share one address.
  // Counts requests rather than pupils, so the bulk roster import above (one
  // request for a whole class) is unaffected.
  accountCreationLimiter,
  validate({ body: createStudentSchema }),
  adminController.createStudent
);
router.patch(
  '/students/:id/suspend',
  writeStudents,
  validate({ params: idParam, body: suspendSchema }),
  adminController.suspendStudent
);
// Faculty may reset a pupil's password — the most common classroom support
// task — but not create or delete accounts.
router.post(
  '/students/:id/reset-password',
  requireOrg,
  requireCapability('student:reset_password'),
  withClassroomScope,
  validate({ params: idParam, body: resetPasswordSchema }),
  adminController.resetStudentPassword
);
// Single student profile + progress (org-scoped: 404 outside the admin's org).
// Registered after the literal /students/* routes so those still match first.
router.get(
  '/students/:id',
  readStudents,
  validate({ params: idParam }),
  adminController.getStudentDetail
);
router.patch(
  '/students/:id',
  writeStudents,
  validate({ params: idParam, body: updateStudentSchema }),
  adminController.updateStudent
);
router.delete(
  '/students/:id',
  writeStudents,
  validate({ params: idParam }),
  adminController.deleteStudent
);

/* ---------------------------------------------------------------------------
 * Platform-level content (worlds, courses, lessons, quizzes, challenges,
 * achievements, shop items).
 *
 * These records are GLOBAL — one shared set backing every tenant. Granting org
 * admins write access therefore meant any single school could rename a world,
 * delete a quiz or re-price the shop for every other school on the platform.
 *
 * So the permissions are split:
 *   contentRead  — org admins AND superadmin may READ the curriculum.
 *   contentWrite — ONLY superadmin may create/update/delete it.
 *
 * If per-school authoring becomes a product requirement, add an `org` field to
 * these models and scope reads to (global OR own-org) rather than widening this
 * guard back out.
 * ------------------------------------------------------------------------- */
const contentRead = requireCapability('content:read');
const contentWrite = requireCapability('content:write');

/**
 * SCHOOL-WIDE announcement. Administrators only.
 *
 * This was gated on `announce:class`, which FACULTY hold — so a teacher could
 * message every active member of the organization, other staff included, from
 * a route whose capability name claimed to mean "one class". The capability
 * read as the opposite of what the endpoint did.
 *
 * It now requires `announce:org`, which is administrators only and was until
 * now declared in the permission map with no route behind it: a head teacher
 * could message one class or nothing. Both halves of that are fixed here.
 *
 * `requireOrg` keeps it tenant-scoped and rejects the tenant-less superadmin —
 * platform-wide announcements belong on /superadmin.
 */
router.post(
  '/notifications/broadcast',
  requireOrg,
  requireCapability('announce:org'),
  validate({ body: broadcastSchema }),
  adminController.broadcastNotification
);

/**
 * ONE CLASS. What `announce:class` actually buys.
 *
 * `withClassroomScope` confines a faculty member to the classes they are
 * assigned to; an administrator may address any class in their school.
 */
router.post(
  '/classrooms/:id/announce',
  requireOrg,
  requireCapability('announce:class'),
  withClassroomScope,
  validate({ params: idParam, body: classroomAnnounceSchema }),
  adminController.announceToClassroom
);

/* ---- CRUD resource registrar (read: org admin + superadmin, write: superadmin) ---- */
function registerCrud(path, controller, bodySchema) {
  // Updates accept partial payloads, so validate the body against a partial()
  // variant of the create schema (unknown fields are still stripped by zod).
  const updateBodySchema = bodySchema.partial();
  router.get(path, contentRead, controller.list);
  router.get(`${path}/:id`, contentRead, validate({ params: idParam }), controller.get);
  router.post(path, contentWrite, validate({ body: bodySchema }), controller.create);
  router.put(
    `${path}/:id`,
    contentWrite,
    validate({ params: idParam, body: updateBodySchema }),
    controller.update
  );
  router.patch(
    `${path}/:id`,
    contentWrite,
    validate({ params: idParam, body: updateBodySchema }),
    controller.update
  );
  router.delete(
    `${path}/:id`,
    contentWrite,
    validate({ params: idParam }),
    controller.remove
  );
}

registerCrud('/worlds', adminController.worldsController, worldSchema);
registerCrud('/courses', adminController.coursesController, courseSchema);
registerCrud('/lessons', adminController.lessonsController, lessonSchema);
registerCrud('/challenges', adminController.challengesController, challengeSchema);
registerCrud('/achievements', adminController.achievementsController, achievementSchema);
// Shop items are AvatarItem docs; the generic CRUD is sufficient.
registerCrud('/shop-items', adminController.shopItemsController, avatarItemSchema);

/* ---- Quizzes (custom CRUD — nested questions; GET :id exposes answers) ---- */
const quizUpdateSchema = quizSchema.partial();
router.get('/quizzes', contentRead, adminController.quizzesController.list);
router.get(
  '/quizzes/:id',
  contentRead,
  validate({ params: idParam }),
  adminController.quizzesController.get
);
router.post(
  '/quizzes',
  contentWrite,
  validate({ body: quizSchema }),
  adminController.quizzesController.create
);
router.put(
  '/quizzes/:id',
  contentWrite,
  validate({ params: idParam, body: quizUpdateSchema }),
  adminController.quizzesController.update
);
router.patch(
  '/quizzes/:id',
  contentWrite,
  validate({ params: idParam, body: quizUpdateSchema }),
  adminController.quizzesController.update
);
router.delete(
  '/quizzes/:id',
  contentWrite,
  validate({ params: idParam }),
  adminController.quizzesController.remove
);

export default router;
