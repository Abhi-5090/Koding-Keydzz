import { Router } from 'express';
import multer from 'multer';
import * as adminController from '../controllers/adminController.js';
import { protect, authorize, requireOrg } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  idParam,
  studentsQuerySchema,
  suspendSchema,
  broadcastSchema,
  createStudentSchema,
  courseSchema,
  lessonSchema,
  challengeSchema,
  achievementSchema,
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

// All admin routes require authentication.
router.use(protect);

/* ---------------------------------------------------------------------------
 * Org-scoped student management. Restricted to org admins (requireOrg rejects
 * the tenant-less superadmin); superadmin manages students via /superadmin.
 * ------------------------------------------------------------------------- */
const orgScoped = [authorize('admin'), requireOrg];

router.get('/stats', orgScoped, adminController.getStats);

router.get(
  '/students',
  orgScoped,
  validate({ query: studentsQuerySchema }),
  adminController.listStudents
);
router.get('/students/template', orgScoped, adminController.studentsTemplate);
router.get('/students/export', orgScoped, adminController.exportStudents);
router.post(
  '/students/bulk',
  orgScoped,
  upload.single('file'),
  adminController.bulkUploadStudents
);
router.post(
  '/students',
  orgScoped,
  validate({ body: createStudentSchema }),
  adminController.createStudent
);
router.patch(
  '/students/:id/suspend',
  orgScoped,
  validate({ params: idParam, body: suspendSchema }),
  adminController.suspendStudent
);
router.post(
  '/students/:id/reset-password',
  orgScoped,
  validate({ params: idParam, body: resetPasswordSchema }),
  adminController.resetStudentPassword
);

/* ---------------------------------------------------------------------------
 * Platform-level content management. These resources are NOT org-scoped, so
 * BOTH org admins and the superadmin may manage them (no requireOrg).
 * ------------------------------------------------------------------------- */
const platform = authorize('admin', 'superadmin');

router.post(
  '/notifications/broadcast',
  platform,
  validate({ body: broadcastSchema }),
  adminController.broadcastNotification
);

/* ---- CRUD resource registrar (platform-level) ---- */
function registerCrud(path, controller, bodySchema) {
  // Updates accept partial payloads, so validate the body against a partial()
  // variant of the create schema (unknown fields are still stripped by zod).
  const updateBodySchema = bodySchema.partial();
  router.get(path, platform, controller.list);
  router.get(`${path}/:id`, platform, validate({ params: idParam }), controller.get);
  router.post(path, platform, validate({ body: bodySchema }), controller.create);
  router.put(
    `${path}/:id`,
    platform,
    validate({ params: idParam, body: updateBodySchema }),
    controller.update
  );
  router.patch(
    `${path}/:id`,
    platform,
    validate({ params: idParam, body: updateBodySchema }),
    controller.update
  );
  router.delete(`${path}/:id`, platform, validate({ params: idParam }), controller.remove);
}

registerCrud('/courses', adminController.coursesController, courseSchema);
registerCrud('/lessons', adminController.lessonsController, lessonSchema);
registerCrud('/challenges', adminController.challengesController, challengeSchema);
registerCrud('/achievements', adminController.achievementsController, achievementSchema);

export default router;
