import { Router } from 'express';
import multer from 'multer';
import * as superadminController from '../controllers/superadminController.js';
import * as certificateController from '../controllers/certificateController.js';
import * as analyticsController from '../controllers/analyticsController.js';
import { protect, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  idParam,
  orgStudentParams,
  orgStaffParams,
  createOrgSchema,
  updateOrgSchema,
  updateOrgAdminSchema,
  superadminStudentsQuerySchema,
  studentsQuerySchema,
  createStudentSchema,
  updateStudentSchema,
  suspendSchema,
  resetPasswordSchema,
  platformBroadcastSchema,
  auditQuerySchema,
  analyticsQuerySchema,
  createStaffSchema,
  updateStaffSchema,
  staffQuerySchema,
  staffPasswordSchema,
  classroomQuerySchema,
  assignOrgSchema,
  unassignedUsersQuerySchema,
  questionSchema,
  questionUpdateSchema,
  questionQuerySchema,
  courseSlugParamSchema,
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

// All super admin routes require an authenticated superadmin.
router.use(protect, authorize('superadmin'));

router.get('/stats', superadminController.getStats);

// Platform-wide (or org-targeted) announcement. The only unscoped broadcast.
router.post(
  '/notifications/broadcast',
  validate({ body: platformBroadcastSchema }),
  superadminController.broadcastPlatform
);
// Legacy analytics payload, kept so an older console keeps working.
router.get('/analytics', superadminController.getAnalytics);

/* ---------------------------------------------------------------------------
 * PLATFORM ANALYTICS — the superadmin dashboard data source.
 *
 * Scale, growth, engagement (DAU/WAU/MAU + stickiness), per-tenant health with
 * an actionable at-risk list, distributions and content coverage — everything
 * the platform owner needs on one screen.
 * ------------------------------------------------------------------------- */
router.get(
  '/analytics/platform',
  validate({ query: analyticsQuerySchema }),
  analyticsController.getPlatformAnalytics
);

// Drill into ONE organization with the same shape the admin dashboard uses,
// so the superadmin sees exactly what that school's administrator sees.
router.get(
  '/orgs/:id/analytics',
  validate({ params: idParam, query: analyticsQuerySchema }),
  analyticsController.getOrgAnalyticsForSuperadmin
);

// Platform-wide audit trail across every organization.
router.get(
  '/audit',
  validate({ query: auditQuerySchema }),
  superadminController.getAuditLog
);

// Global (platform-wide) student management — not org-bound.
/* ---- Certificate templates ----
 *
 * Superadmin-only. A template decides what every certificate in a school looks
 * like, so it is platform-level configuration rather than something a school
 * admin edits between lessons.
 *
 * Positions are PERCENTAGES of the page, which is what lets the editor's live
 * preview match the printed output at any size. See models/CertificateTemplate.
 */
router.get('/certificate-templates', certificateController.listTemplates);
router.post('/certificate-templates', certificateController.createTemplate);
router.patch(
  '/certificate-templates/:id',
  validate({ params: idParam }),
  certificateController.updateTemplate
);
router.post(
  '/certificate-templates/:id/activate',
  validate({ params: idParam }),
  certificateController.activateTemplate
);
router.delete(
  '/certificate-templates/:id',
  validate({ params: idParam }),
  certificateController.deleteTemplate
);

/* ---- The question bank (final tests are drawn from it) ----
 *
 * Superadmin-only: the bank holds the mark scheme for every final test, so a
 * school admin must never be able to read it. Registered before the
 * parameterised student routes so the literal paths are not swallowed.
 */
router.get(
  '/questions',
  validate({ query: questionQuerySchema }),
  superadminController.listQuestions
);
router.post(
  '/questions',
  validate({ body: questionSchema }),
  superadminController.createQuestion
);
router.get(
  '/questions/coverage/:slug',
  validate({ params: courseSlugParamSchema }),
  superadminController.getBankCoverage
);
router.patch(
  '/questions/:id',
  validate({ params: idParam, body: questionUpdateSchema }),
  superadminController.updateQuestion
);
router.post(
  '/questions/:id/retire',
  validate({ params: idParam }),
  superadminController.retireQuestion
);
router.delete(
  '/questions/:id',
  validate({ params: idParam }),
  superadminController.deleteQuestion
);

/* ---- Users without an organization ----
 *
 * Registered BEFORE '/students/:id' and friends so the literal path is not
 * swallowed by a parameterised one. Every user must belong to a school; this
 * pair is how an orphan is found and fixed.
 */
router.get(
  '/users/unassigned',
  validate({ query: unassignedUsersQuerySchema }),
  superadminController.listUnassignedUsers
);
router.patch(
  '/users/:id/organization',
  validate({ params: idParam, body: assignOrgSchema }),
  superadminController.assignUserOrganization
);

router.get(
  '/students',
  validate({ query: superadminStudentsQuerySchema }),
  superadminController.listStudents
);
router.patch(
  '/students/:id/suspend',
  validate({ params: idParam, body: suspendSchema }),
  superadminController.suspendStudent
);
router.post(
  '/students/:id/reset-password',
  validate({ params: idParam, body: resetPasswordSchema }),
  superadminController.resetStudentPassword
);

// Shared xlsx template (superadmin has no org but uploads into a chosen one).
router.get('/students/template', superadminController.studentsTemplate);

// Single student profile + progress (any org). Registered after the literal
// /students/* routes so those still match first.
router.get(
  '/students/:id',
  validate({ params: idParam }),
  superadminController.getStudentDetail
);
router.patch(
  '/students/:id',
  validate({ params: idParam, body: updateStudentSchema }),
  superadminController.updateStudent
);
router.delete(
  '/students/:id',
  validate({ params: idParam }),
  superadminController.deleteStudent
);

router.post(
  '/orgs',
  validate({ body: createOrgSchema }),
  superadminController.createOrg
);
router.get('/orgs', superadminController.listOrgs);
router.get('/orgs/:id', validate({ params: idParam }), superadminController.getOrg);
router.patch(
  '/orgs/:id',
  validate({ params: idParam, body: updateOrgSchema }),
  superadminController.updateOrg
);
router.patch(
  '/orgs/:id/admin',
  validate({ params: idParam, body: updateOrgAdminSchema }),
  superadminController.updateOrgAdmin
);
router.delete(
  '/orgs/:id',
  validate({ params: idParam }),
  superadminController.deleteOrg
);

/* ---------------------------------------------------------------------------
 * Per-org student management (drill into a chosen org). The superadmin has no
 * org of its own, so it targets a specific org via :id.
 * ------------------------------------------------------------------------- */
router.get(
  '/orgs/:id/students',
  validate({ params: idParam, query: studentsQuerySchema }),
  superadminController.listOrgStudents
);
router.get(
  '/orgs/:id/students/:studentId',
  validate({ params: orgStudentParams }),
  superadminController.getOrgStudentDetail
);
router.post(
  '/orgs/:id/students/bulk',
  validate({ params: idParam }),
  upload.single('file'),
  superadminController.bulkUploadOrgStudents
);
router.post(
  '/orgs/:id/students',
  validate({ params: idParam, body: createStudentSchema }),
  superadminController.createOrgStudent
);

/* ---- Per-organization staff (administrators + faculty) ---- */
router.get(
  '/orgs/:id/staff',
  validate({ params: idParam, query: staffQuerySchema }),
  superadminController.listOrgStaff
);
router.post(
  '/orgs/:id/staff',
  validate({ params: idParam, body: createStaffSchema }),
  superadminController.createOrgStaff
);
router.patch(
  '/orgs/:id/staff/:staffId',
  validate({ params: orgStaffParams, body: updateStaffSchema }),
  superadminController.updateOrgStaff
);
router.post(
  '/orgs/:id/staff/:staffId/reset-password',
  validate({ params: orgStaffParams, body: staffPasswordSchema }),
  superadminController.resetOrgStaffPassword
);
router.delete(
  '/orgs/:id/staff/:staffId',
  validate({ params: orgStaffParams }),
  superadminController.deleteOrgStaff
);

/* ---- Per-organization classrooms (read-only for support) ---- */
router.get(
  '/orgs/:id/classrooms',
  validate({ params: idParam, query: classroomQuerySchema }),
  superadminController.listOrgClassrooms
);

export default router;
