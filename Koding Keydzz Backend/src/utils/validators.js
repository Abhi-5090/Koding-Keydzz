import { z } from 'zod';
import { LANGUAGES } from '../config/courses.js';

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const idParam = z.object({ id: objectId });

/**
 * A realm slug plus a pupil id.
 *
 * Both keys have to be declared. Zod strips unknown keys by default and
 * `validate` assigns the parsed result back over `req.params`, so validating
 * these routes with `idParam` alone would silently DELETE `slug` — the handler
 * would then look up a realm called `undefined` and report that it does not
 * exist.
 */
export const realmGrantParams = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Not a valid realm'),
  id: objectId,
});

/** A realm slug on its own, for the roster. */
export const realmSlugParam = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Not a valid realm'),
});

// Two-id params for drilling into a specific student inside a specific org.
export const orgStudentParams = z.object({ id: objectId, studentId: objectId });

// Two-id params for a specific staff member inside a specific organization.
export const orgStaffParams = z.object({ id: objectId, staffId: objectId });

export const registerStudentSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(80),
  grade: z.string().min(1).max(40),
  // Free text, kept for display. It is NOT the tenant — `orgCode` is.
  school: z.string().max(120).optional().default(''),
  /**
   * The school's join code, and the reason this field is required.
   *
   * Self-registration used to set no `org` at all, so every account it created
   * was a tenant orphan: owned by no school, invisible to every admin, and
   * filtered out of every org-scoped query — while still being able to sign
   * in. Making the code mandatory means the endpoint cannot produce one.
   */
  orgCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, 'Enter your school code')
    .max(24, 'That does not look like a school code'),
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

// Login accepts a username OR email via `identifier` (preferred), and remains
// backward-compatible with the legacy `{ email, password }` body. Lenient: the
// identifier is not forced to look like an email (students log in by username).
export const loginSchema = z
  .object({
    identifier: z.string().min(1).max(320).optional(),
    email: z.string().min(1).max(320).optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine(
    (d) =>
      (d.identifier != null && d.identifier.trim() !== '') ||
      (d.email != null && d.email.trim() !== ''),
    { message: 'A username or email is required', path: ['identifier'] }
  );

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token is required'),
});

export const leaderboardQuerySchema = z.object({
  // `scope` is the current param; `type` is kept for back-compat. The default
  // is 'school' — a cross-tenant board must be requested explicitly.
  scope: z.enum(['global', 'school']).optional(),
  type: z.enum(['global', 'school', 'weekly']).default('school'),
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

/* ---- Organization staff (admins + faculty) ---- */

/**
 * Roles an administrator may create in their own school.
 *
 * `guardian` is here because a parent account is provisioned exactly like a
 * member of staff — by the school, with a temporary password, forced to change
 * it on first sign-in. What differs is what it can see, and that is decided by
 * the capability map, not by how it was created.
 */
export const staffRole = z.enum(['admin', 'faculty', 'guardian']);

export const createStaffSchema = z.object({
  role: staffRole,
  name: z.string().min(2, 'Name is too short').max(120),
  // Staff sign in by email (students may have only a username), so this is
  // required rather than optional.
  email: z.string().email('A valid email address is required'),
  phone: z.string().max(40).optional().default(''),
  title: z.string().max(120).optional().default(''),
  subjects: z.array(z.string().max(60)).max(20).optional().default([]),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
});

export const updateStaffSchema = z
  .object({
    role: staffRole.optional(),
    name: z.string().min(2).max(120).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(40).optional(),
    title: z.string().max(120).optional(),
    subjects: z.array(z.string().max(60)).max(20).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

export const staffQuerySchema = z.object({
  role: staffRole.optional(),
  search: z.string().max(120).optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const staffPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
});

/* ---- Classrooms ---- */

export const createClassroomSchema = z.object({
  name: z.string().min(1, 'A class name is required').max(120),
  grade: z.string().max(40).optional().default(''),
  section: z.string().max(40).optional().default(''),
  subject: z.string().max(80).optional().default(''),
  academicYear: z.string().max(20).optional().default(''),
  faculty: z.array(objectId).max(50).optional().default([]),
  students: z.array(objectId).max(2000).optional().default([]),
});

export const updateClassroomSchema = createClassroomSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Provide at least one field to update' }
);

export const rosterSchema = z
  .object({
    add: z.array(objectId).max(2000).optional().default([]),
    remove: z.array(objectId).max(2000).optional().default([]),
  })
  .refine((d) => d.add.length > 0 || d.remove.length > 0, {
    message: 'Provide students to add or remove',
  });

export const archiveSchema = z.object({
  archive: z.boolean().optional(),
});

export const classroomQuerySchema = z.object({
  search: z.string().max(120).optional().default(''),
  includeArchived: z.enum(['true', 'false']).optional(),
});

/* ---- Analytics ---- */

export const analyticsQuerySchema = z.object({
  // Reporting window in days. Clamped again in the controller so an
  // out-of-range value can never trigger an unbounded scan.
  days: z.coerce.number().int().min(7).max(365).default(30),
});

export const classReportQuerySchema = z.object({
  grade: z.string().max(40).optional(),
});

export const auditQuerySchema = z.object({
  action: z.string().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const suspendSchema = z.object({
  suspend: z.boolean().optional(),
});

export const broadcastSchema = z.object({
  title: z.string().min(1).max(140),
  body: z.string().max(2000).optional().default(''),
  scope: z.enum(['all', 'students']).optional().default('all'),
});

/**
 * Announcing to ONE class. No `scope` — the audience IS the class roster, and
 * a scope field here would only invite the org-wide confusion this route was
 * created to end.
 */
export const classroomAnnounceSchema = z.object({
  title: z.string().min(1).max(140),
  body: z.string().max(2000).optional().default(''),
});

// Superadmin variant: may additionally target one organization. Omitting `org`
// means the announcement goes platform-wide.
export const platformBroadcastSchema = broadcastSchema.extend({
  org: objectId.optional(),
});

/* ---- Admin content schemas (loose; allow partials for updates) ---- */

export const courseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  world: objectId.optional(),
  order: z.number().optional(),
  language: z.enum(LANGUAGES).optional(),
  published: z.boolean().optional(),
});

// Structured lesson body (all inner fields optional so partial admin edits pass).
const lessonBodySchema = z.object({
  tagline: z.string().optional(),
  intro: z.string().optional(),
  sections: z
    .array(
      z.object({
        heading: z.string().optional(),
        body: z.string().optional(),
        bullets: z.array(z.string()).optional(),
      })
    )
    .optional(),
  snippet: z
    .object({
      language: z.string().optional(),
      lines: z.array(z.string()).optional(),
      caption: z.string().optional(),
    })
    .optional(),
  tryIt: z
    .object({
      language: z.string().optional(),
      starter: z.string().optional(),
      challenge: z.string().optional(),
      hint: z.string().optional(),
    })
    .optional(),
  guide: z
    .array(
      z.object({
        step: z.string().optional(),
        body: z.string().optional(),
      })
    )
    .optional(),
  takeaways: z.array(z.string()).optional(),
});

export const lessonSchema = z.object({
  world: objectId,
  course: objectId.optional(),
  title: z.string().min(1),
  content: z.string().optional(),
  body: lessonBodySchema.optional(),
  order: z.number().optional(),
  language: z.enum(LANGUAGES).optional(),
  starterCode: z.string().optional(),
  xpReward: z.number().optional(),
});

// Worlds are platform-level (not org-scoped). Slug is a URL-safe identifier.
export const worldSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Slug may use lowercase letters, digits and hyphens')
    .toLowerCase(),
  order: z.number().optional(),
  topics: z.array(z.string()).optional().default([]),
  description: z.string().optional(),
  requiredLevel: z.number().optional(),
  icon: z.string().optional(),
});

export const challengeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  language: z.enum(LANGUAGES).optional(),
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

/* ---- Admin quiz management (nested questions) ---- */

const questionType = z.enum(['mcq', 'dragdrop', 'fillblank', 'match', 'coding']);

// Per-question shape is validated leniently: only `prompt` is required; the
// `answer` (persisted as correctAnswer) is Mixed so each type may store an
// index, string, array or map. `correctAnswer` is accepted as an alias.
export const quizQuestionSchema = z.object({
  type: questionType.optional(),
  prompt: z.string().min(1, 'Question prompt is required'),
  options: z.array(z.string()).optional(),
  answer: z.any().optional(),
  correctAnswer: z.any().optional(),
  explanation: z.string().optional(),
  points: z.number().optional(),
});

export const quizSchema = z.object({
  title: z.string().min(1, 'Quiz title is required'),
  lesson: objectId.optional(),
  world: objectId.optional(),
  type: questionType.optional(),
  xpReward: z.number().optional(),
  questions: z.array(quizQuestionSchema).default([]),
});

/* ---- Admin shop-item (AvatarItem) management ---- */

export const avatarItemSchema = z.object({
  key: z.string().min(1, 'Item key is required'),
  name: z.string().min(1, 'Item name is required'),
  type: z.enum(['skin', 'outfit', 'accessory', 'pet', 'effect', 'background']),
  price: z.number().min(0).optional(),
  requiredLevel: z.number().min(1).optional(),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']).optional(),
  asset: z.string().optional(),
  isDefault: z.boolean().optional(),
});

/* ---- Super Admin / Organization schemas ---- */

const orgPlan = z.enum(['trial', 'basic', 'standard', 'premium']);

export const createOrgSchema = z.object({
  name: z.string().min(2, 'Org name is too short').max(120),
  adminName: z.string().min(2, 'Admin name is too short').max(80),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
  // Contract details. All optional so the quick "add a school" flow stays a
  // four-field form.
  plan: orgPlan.optional(),
  seatLimit: z.coerce.number().int().min(0).max(1_000_000).optional(),
  contactName: z.string().max(120).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(40).optional(),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  timezone: z.string().max(60).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateOrgSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    status: z.enum(['active', 'suspended']).optional(),
    plan: orgPlan.optional(),
    seatLimit: z.coerce.number().int().min(0).max(1_000_000).optional(),
    contactName: z.string().max(120).optional(),
    contactEmail: z.string().email().optional().or(z.literal('')),
    contactPhone: z.string().max(40).optional(),
    city: z.string().max(80).optional(),
    country: z.string().max(80).optional(),
    timezone: z.string().max(60).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Provide at least one field to update',
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

// Empty-string form fields are coerced to `undefined` so an omitted (blank)
// email/username doesn't trip the format checks — they are simply absent.
const blankToUndefined = (v) =>
  v === '' || v == null ? undefined : v;

export const createStudentSchema = z.object({
  // School's own pupil id. Optional, but supplying it makes roster re-imports
  // idempotent (see studentBulkService).
  rollNumber: z.preprocess(blankToUndefined, z.string().trim().max(40).optional()),
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().max(80).optional().default(''),
  // Email is now OPTIONAL (young students may have none).
  email: z.preprocess(blankToUndefined, z.string().email().optional()),
  phone: z.string().max(40).optional().default(''),
  grade: z.string().trim().max(40).optional(),
  school: z.string().trim().max(120).optional(),
  // Username is OPTIONAL — auto-generated from the name when omitted.
  username: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters')
      .max(30)
      .regex(/^[a-z0-9._-]+$/i, 'Username may use letters, digits, . _ -')
      .optional()
  ),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128).optional(),
});

// Edit an existing student — every field is optional (partial update). Blank
// email/username form fields are coerced to `undefined` so they are simply
// left untouched rather than tripping the format checks.
export const updateStudentSchema = z.object({
  rollNumber: z.preprocess(blankToUndefined, z.string().trim().max(40).optional()),
  firstName: z.string().min(1, 'First name is required').max(80).optional(),
  lastName: z.string().max(80).optional(),
  grade: z.string().trim().max(40).optional(),
  school: z.string().trim().max(120).optional(),
  phone: z.string().max(40).optional(),
  username: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters')
      .max(30)
      .regex(/^[a-z0-9._-]+$/i, 'Username may use letters, digits, . _ -')
      .optional()
  ),
  email: z.preprocess(blankToUndefined, z.string().email().optional()),
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

/**
 * Changing your OWN password.
 *
 * The current password is required, so a stolen access token alone cannot
 * change it — taking over an account then needs the password as well as the
 * token, and the token is short-lived.
 *
 * The length floor here is the LOWER of the two policies (students are created
 * with a 6-character minimum, staff with 8). The role-appropriate minimum is
 * applied in authService.changePassword, because the schema does not know who
 * is calling.
 */
/** Asking for a reset link. Only an address; the answer never varies. */
export const requestPasswordResetSchema = z.object({
  email: z.string().email('A valid email address is required'),
});

/** Finishing a reset. The 8-character floor is re-checked in the service. */
export const completePasswordResetSchema = z.object({
  token: z.string().min(20, 'That reset link is not valid').max(200),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128),
});

/* ---- Assignments ---- */

const assignmentTarget = z.object({
  kind: z.enum(['lesson', 'quiz', 'world', 'course', 'game']),
  ref: z.string().min(1, 'What is being assigned is required').max(120),
  // Only meaningful for `game`; the service rejects it as missing there.
  level: z.coerce.number().int().min(1).optional(),
});

export const createAssignmentSchema = z.object({
  title: z.string().min(2, 'Give the assignment a title').max(160),
  instructions: z.string().max(2000).optional().default(''),
  target: assignmentTarget,
  // `null` is a deliberate value, not an omission: "do this whenever" is a
  // real thing a teacher wants, and forcing a date makes them invent one.
  dueAt: z.string().datetime().nullable().optional(),
});

export const updateAssignmentSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  instructions: z.string().max(2000).optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

/** Linking a guardian to a pupil. Both ids, both checked against the school. */
export const guardianLinkSchema = z.object({
  studentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'A valid student id is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Your current password is required').max(128),
  newPassword: z
    .string()
    .min(6, 'New password must be at least 6 characters')
    .max(128),
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
  // Accepted for backward compatibility but IGNORED: the reward tier is read
  // from the server-side catalogue (src/config/gameCatalog.js), because letting
  // the client name its own difficulty let it choose its own payout.
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  // Accepted for backward compatibility but IGNORED, for the same reason:
  // three stars pays a bonus, so the client was setting part of its own
  // payout. Stars are graded from `performance` below — see
  // src/config/starPolicy.js.
  stars: z.coerce.number().int().min(0).max(3).optional(),
  // Optional move-count / elapsed-time for the leaderboard (best kept). Bounds
  // are enforced against plausibility floors in the catalogue validator.
  moves: z.coerce.number().int().min(0).optional(),
  timeMs: z.coerce.number().int().min(0).optional(),
  /**
   * What actually happened during the run. The client reports the counters; the
   * server applies the game's own star rule to them. Everything is optional so
   * a client mid-deploy still completes levels (graded at two stars, no bonus).
   */
  performance: z
    .object({
      hintsUsed: z.coerce.number().int().min(0).max(10_000).optional(),
      // A "slip" is whatever the game tells the player it is: a wrong answer, a
      // rejected move, a failed submission.
      mistakes: z.coerce.number().int().min(0).max(10_000).optional(),
      // Outcome games (Tic-Tac-Toe) — a loss does not complete a level.
      outcome: z.enum(['win', 'draw', 'loss']).optional(),
      // The two programming games' quality bits.
      optimalPath: z.coerce.boolean().optional(),
      cleanCode: z.coerce.boolean().optional(),
    })
    .strict()
    .optional(),
});

/* ---- Course ladder ---- */

/**
 * A course slug in the path.
 *
 * Checked against the ladder config rather than a loose string, so an unknown
 * slug is a 400 at the edge instead of a 404 after three database queries.
 */
/**
 * Marking one flagged answer.
 *
 * `marks` is validated against the question's own allowance in the service —
 * only it knows the blueprint's points for that question — so this checks the
 * shape only.
 */
export const markAnswerSchema = z.object({
  questionId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'questionId must be a valid id'),
  marks: z.coerce.number().min(0, 'Marks cannot be negative'),
  comment: z.string().max(2000).optional(),
});

export const attemptParamSchema = z.object({
  attemptId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'attemptId must be a valid id'),
});

export const courseSlugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => LANGUAGES.includes(v), { message: 'Unknown course' }),
});

/* ---- Final test ---- */

/** An attempt id in the path. */
export const attemptIdParamSchema = z.object({
  attemptId: objectId,
});

/** Course slug + attempt id, for the save/submit routes. */
export const attemptRouteSchema = z.object({
  attemptId: objectId,
});

/**
 * Answers sent up by a pupil.
 *
 * `response` is Mixed on purpose — it is an option index for multiple choice,
 * text for a blank, and source code for a coding question. The SHAPE is
 * validated where it is marked, against the question's own type, because only
 * there is the type known.
 *
 * Answers naming a question that is not on the pupil's paper are dropped by
 * the service rather than rejected here: a stale tab can legitimately send
 * one, and failing the whole submission over it would lose a completed test.
 */
export const submitAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        question: objectId,
        response: z.any().optional(),
      })
    )
    .max(200)
    .optional()
    .default([]),
});

/** Authoring one bank question. Type-specific fields are checked by the model. */
export const questionSchema = z.object({
  courseSlug: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => LANGUAGES.includes(v), { message: 'Unknown course' }),
  type: z.enum(['mcq', 'fillblank', 'coding', 'task']),
  difficulty: z.enum(['basic', 'advanced']).optional().default('basic'),
  prompt: z.string().trim().min(1, 'A question needs a prompt').max(4000),
  context: z.string().max(8000).optional().default(''),

  options: z.array(z.string().max(500)).max(8).optional(),
  answerIndex: z.coerce.number().int().min(0).max(7).optional(),

  acceptedAnswers: z.array(z.string().trim().max(200)).max(20).optional(),

  language: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => LANGUAGES.includes(v), { message: 'Unknown language' })
    .optional(),
  starterCode: z.string().max(20_000).optional().default(''),
  testCases: z
    .array(
      z.object({
        stdin: z.string().max(4000).optional().default(''),
        expectedOutput: z.string().min(1, 'A test case needs expected output').max(4000),
        visible: z.coerce.boolean().optional().default(false),
      })
    )
    .max(20)
    .optional(),

  expectedOutcome: z.string().max(8000).optional().default(''),
  tags: z.array(z.string().trim().max(40)).max(20).optional().default([]),
  active: z.coerce.boolean().optional().default(true),
});

/** Partial update — every field optional. */
export const questionUpdateSchema = questionSchema.partial();

export const questionQuerySchema = z.object({
  courseSlug: z.string().trim().toLowerCase().optional(),
  type: z.enum(['mcq', 'fillblank', 'coding', 'task']).optional(),
  difficulty: z.enum(['basic', 'advanced']).optional(),
  search: z.string().trim().max(120).optional().default(''),
  active: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

/* ---- Organization assignment ---- */

/**
 * Body for assigning a user to an organization.
 *
 * `org` is required and must be a real ObjectId. Deliberately no "unassign"
 * option: the whole point is that every user belongs to a school, so the API
 * offers no way to put one back into the orphan state that had to be cleaned
 * up in the first place. Removing a person is a deletion, not an unassignment.
 */
export const assignOrgSchema = z.object({
  org: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Choose an organization'),
});

export const unassignedUsersQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
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
  // Defaults to the caller's own organization; 'global' is opt-in.
  scope: z.enum(['global', 'org']).default('org'),
});

export const playgroundRunSchema = z.object({
  language: z.enum(LANGUAGES),
  code: z.string().min(1, 'Code is required').max(50000),
  stdin: z.string().max(10000).optional().default(''),
});

export default {
  idParam,
  orgStudentParams,
  orgStaffParams,
  quizQuestionSchema,
  quizSchema,
  avatarItemSchema,
  equipAvatarSchema,
  purchaseSchema,
  quizSubmitSchema,
  courseSlugParamSchema,
  attemptIdParamSchema,
  attemptRouteSchema,
  submitAnswersSchema,
  questionSchema,
  questionUpdateSchema,
  questionQuerySchema,
  assignOrgSchema,
  unassignedUsersQuerySchema,
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
  auditQuerySchema,
  classReportQuerySchema,
  staffRole,
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
  broadcastSchema,
  platformBroadcastSchema,
  courseSchema,
  lessonSchema,
  worldSchema,
  challengeSchema,
  achievementSchema,
  createOrgSchema,
  updateOrgSchema,
  updateOrgAdminSchema,
  createStudentSchema,
  updateStudentSchema,
  bulkStudentPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  classroomAnnounceSchema,
  requestPasswordResetSchema,
  completePasswordResetSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  guardianLinkSchema,
};
