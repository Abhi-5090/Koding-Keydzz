import { Router } from 'express';
import multer from 'multer';
import * as uploadController from '../controllers/uploadController.js';
import { protect } from '../middlewares/auth.js';
import { uploadLimiter } from '../middlewares/rateLimit.js';

// In-memory storage so we can stream the buffer straight to Cloudinary.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image uploads are allowed'));
  },
});

const router = Router();

router.post(
  '/avatar',
  protect,
  uploadLimiter,
  upload.single('file'),
  uploadController.uploadAvatar
);

export default router;
