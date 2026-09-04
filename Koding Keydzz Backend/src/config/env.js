import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL: z.string().default('7d'),
  CLIENT_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:5174'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  // Code-execution strategy for the playground (see codeExecutionService).
  CODE_RUNNER: z.enum(['auto', 'local', 'piston']).optional(),

  /**
   * External task grading (optional).
   *
   * Both must be set for it to be usable, AND the question must opt in — see
   * services/externalValidator.js. Sending a child's examined work to a third
   * party is a decision, so the safe path is what you get by doing nothing.
   */
  TASK_VALIDATOR_URL: z.string().url().optional(),
  TASK_VALIDATOR_API_KEY: z.string().min(16).optional(),
  // Feature flags (string 'true' to enable; default off). Read at request time
  // in the routes, mirrored here so they're documented and validated at boot.
  ALLOW_STUDENT_SIGNUP: z.enum(['true', 'false']).optional(),
  ENABLE_SERVER_CODE_EXEC: z.enum(['true', 'false']).optional(),
  // Optional error tracking. When set, the central error handler emits a
  // structured record (integration point for @sentry/node — see DEPLOYMENT.md).
  SENTRY_DSN: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  /**
   * Redis, for running MORE THAN ONE API instance.
   *
   * Socket.IO keeps its rooms in each process's memory. With two instances and
   * no shared backplane, a notification emitted on instance A never reaches a
   * pupil whose socket is held by instance B — the emit simply finds no room
   * and disappears, with nothing logged. Setting this makes every room emit
   * cross-instance (see src/sockets/index.js).
   *
   * Leave it unset for a single instance; nothing else changes.
   */
  REDIS_URL: z.string().optional(),
  /** Optional label for this instance, used only to make logs readable. */
  INSTANCE_ID: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;

// ---------------------------------------------------------------------------
// Production hardening: fail fast on weak/default secrets. Only enforced in
// production so local/dev/test can keep using throwaway secrets.
// ---------------------------------------------------------------------------
if (data.NODE_ENV === 'production') {
  const WEAK_DEFAULTS = new Set([
    'change_this_access_secret',
    'change_this_refresh_secret',
    'secret',
    'changeme',
    'test_access_secret',
    'test_refresh_secret',
  ]);
  const MIN_SECRET_LEN = 32;
  const problems = [];

  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const val = data[key] || '';
    if (WEAK_DEFAULTS.has(val)) {
      problems.push(`${key} is set to a known/example default — set a unique strong value.`);
    } else if (val.length < MIN_SECRET_LEN) {
      problems.push(
        `${key} must be at least ${MIN_SECRET_LEN} characters in production (got ${val.length}).`
      );
    }
  }
  if (data.JWT_ACCESS_SECRET && data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
  }

  if (problems.length) {
    console.error('Refusing to start in production with insecure configuration:');
    for (const p of problems) console.error(`  • ${p}`);
    console.error(
      "Generate strong secrets, e.g.:  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
    process.exit(1);
  }

  // Non-fatal but important: warn if CORS is still pointed at localhost only.
  const origins = data.CLIENT_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  const onlyLocalhost =
    origins.length > 0 &&
    origins.every((o) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));
  if (onlyLocalhost) {
    console.warn(
      '[env] WARNING: CLIENT_ORIGINS only contains localhost in production. ' +
        'Browsers on your real frontend origin will be blocked by CORS.'
    );
  }
}

export const env = {
  ...data,
  clientOrigins: data.CLIENT_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  // Read through named properties so no call site has to know the raw env keys.
  taskValidatorUrl: data.TASK_VALIDATOR_URL || '',
  taskValidatorApiKey: data.TASK_VALIDATOR_API_KEY || '',
};

export default env;
