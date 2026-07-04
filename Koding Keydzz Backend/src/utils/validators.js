import { z } from 'zod';

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const idParam = z.object({ id: objectId });

export const registerStudentSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(80),
  grade: z.string().min(1).max(40),
  school: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token is required'),
});

export const leaderboardQuerySchema = z.object({
  // `scope` is the current param; `type` is kept for back-compat.
  scope: z.enum(['global', 'school']).optional(),
  type: z.enum(['global', 'school', 'weekly']).default('global'),
});

export const studentsQuerySchema = z.object({
  search: z.string().optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const superadminStudentsQuerySchema = z.object({
  search: z.string().optional().default(''),
  org: objectId.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const suspendSchema = z.object({
  suspend: z.boolean().optional(),
});

export const broadcastSchema = z.object({
  title: z.string().min(1).max(140),
  body: z.string().max(2000).optional().default(''),
  scope: z.enum(['all', 'students']).optional().default('all'),
});

/* ---- Admin content schemas (loose; allow partials for updates) ---- */

export const courseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  world: objectId.optional(),
  order: z.number().optional(),
  language: z.enum(['python', 'javascript']).optional(),
  published: z.boolean().optional(),
});

export const lessonSchema = z.object({
  world: objectId,
  course: objectId.optional(),
  title: z.string().min(1),
  content: z.string().optional(),
  order: z.number().optional(),
  language: z.enum(['python', 'javascript']).optional(),
  starterCode: z.string().optional(),
  xpReward: z.number().optional(),
});

export const challengeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  language: z.enum(['python', 'javascript']).optional(),
  starterCode: z.string().optional(),
  xpReward: z.number().optional(),
  coinReward: z.number().optional(),
  daily: z.boolean().optional(),
  world: objectId.optional(),
});

export const achievementSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  criteria: z.any().optional(),
  xpReward: z.number().optional(),
  coinReward: z.number().optional(),
});

/* ---- Super Admin / Organization schemas ---- */

export const createOrgSchema = z.object({
  name: z.string().min(2, 'Org name is too short').max(120),
  adminName: z.string().min(2, 'Admin name is too short').max(80),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export const updateOrgSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  })
  .refine((d) => d.name !== undefined || d.status !== undefined, {
    message: 'Provide name or status to update',
  });

export const updateOrgAdminSchema = z
  .object({
    adminName: z.string().min(2).max(80).optional(),
    adminEmail: z.string().email().optional(),
    adminPassword: z.string().min(6).max(128).optional(),
  })
  .refine(
    (d) =>
      d.adminName !== undefined ||
      d.adminEmail !== undefined ||
      d.adminPassword !== undefined,
    { message: 'Provide a field to update' }
  );

/* ---- Admin student management schemas ---- */

export const createStudentSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().max(80).optional().default(''),
  email: z.string().email(),
  phone: z.string().max(40).optional().default(''),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128).optional(),
});

/**
 * Validates the multipart `password` form field accompanying a bulk upload.
 * Multipart form fields arrive as strings, so this schema only coerces/checks
 * the single common password applied to all students in the batch.
 */
export const bulkStudentPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters').max(128).optional(),
});

/* ---- Avatar / Shop / Quiz / Playground schemas ---- */

export const equipAvatarSchema = z.object({
  key: z.string().min(1, 'Item key is required'),
});

export const purchaseSchema = z.object({
  itemKey: z.string().min(1, 'Item key is required'),
});

export const quizSubmitSchema = z.object({
  answers: z.record(z.string(), z.any()).default({}),
});

export const gameCompleteSchema = z.object({
  gameKey: z.string().min(1, 'gameKey is required').max(80),
  levelId: z.union([z.string().min(1), z.number()]).transform((v) => String(v)),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  stars: z.coerce.number().int().min(0).max(3),
  // Optional move-count / elapsed-time for the leaderboard (best kept).
  moves: z.coerce.number().int().min(0).optional(),
  timeMs: z.coerce.number().int().min(0).optional(),
});

/* ---- Game leaderboards ---- */

export const gameKeyParamSchema = z.object({
  gameKey: z.string().min(1, 'gameKey is required').max(80),
});

export const gameLevelParamSchema = z.object({
  gameKey: z.string().min(1, 'gameKey is required').max(80),
  levelId: z.union([z.string().min(1), z.number()]).transform((v) => String(v)),
});

export const gameLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  scope: z.enum(['global', 'org']).default('global'),
});

export const playgroundRunSchema = z.object({
  language: z.enum(['python', 'javascript']),
  code: z.string().min(1, 'Code is required').max(50000),
  stdin: z.string().max(10000).optional().default(''),
});

export default {
  idParam,
  equipAvatarSchema,
  purchaseSchema,
  quizSubmitSchema,
  gameCompleteSchema,
  gameKeyParamSchema,
  gameLevelParamSchema,
  gameLeaderboardQuerySchema,
  playgroundRunSchema,
  registerStudentSchema,
  loginSchema,
  refreshSchema,
  leaderboardQuerySchema,
  studentsQuerySchema,
  superadminStudentsQuerySchema,
  suspendSchema,
  broadcastSchema,
  courseSchema,
  lessonSchema,
  challengeSchema,
  achievementSchema,
  createOrgSchema,
  updateOrgSchema,
  updateOrgAdminSchema,
  createStudentSchema,
  bulkStudentPasswordSchema,
  resetPasswordSchema,
};
