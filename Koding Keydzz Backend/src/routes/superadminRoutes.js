import { Router } from 'express';
import multer from 'multer';
import * as superadminController from '../controllers/superadminController.js';
import { protect, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  idParam,
  createOrgSchema,
  updateOrgSchema,
  updateOrgAdminSchema,
  superadminStudentsQuerySchema,
  studentsQuerySchema,
  createStudentSchema,
  suspendSchema,
  resetPasswordSchema,
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
router.get('/analytics', superadminController.getAnalytics);

// Global (platform-wide) student management — not org-bound.
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

export default router;
