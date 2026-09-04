import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { userRepository } from '../repositories/userRepository.js';
import { roleHasCapability } from '../config/permissions.js';

export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    throw ApiError.unauthorized('Authentication token missing');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user || user.deletedAt) {
    // A soft-deleted account must be indistinguishable from a removed one.
    throw ApiError.unauthorized('User no longer exists');
  }
  if (user.status === 'suspended') {
    throw ApiError.forbidden('Account is suspended');
  }

  req.user = user;

  /**
   * A FORCED PASSWORD CHANGE IS ENFORCED HERE, NOT LEFT TO THE CLIENT.
   *
   * `mustChangePassword` is set when staff are created and on every staff
   * password reset. It used to be advisory to the point of being decorative:
   * the only thing that read it was a badge on the staff roster, so an account
   * flagged "must change password" could use the whole API for ever without
   * changing it.
   *
   * Putting the check inside `protect` rather than on individual routes is the
   * point. Every authenticated route already goes through here, so a route
   * added next year inherits the rule instead of having to remember it — the
   * same reason capabilities are resolved centrally.
   *
   * The allowlist is the smallest set that lets the account fix itself:
   * read who I am, change the password, rotate a token, sign out. Anything
   * else is refused with 403 and a machine-readable code the client keys on.
   */
  if (user.mustChangePassword && !isPasswordChangeExempt(req)) {
    throw ApiError.forbidden('You must change your password before continuing', {
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }

  next();
});

/**
 * Paths an account with a pending forced password change may still reach.
 *
 * Matched on the mounted path (`req.path` is relative to the router this
 * middleware runs in, so `originalUrl` is used) and anchored to the end, so
 * `/auth/change-password` matches and `/auth/change-password-for-someone-else`
 * would not.
 */
const PASSWORD_CHANGE_EXEMPT = [
  /\/auth\/change-password$/,
  /\/auth\/logout$/,
  /\/auth\/refresh$/,
  /\/auth\/me$/,
];

function isPasswordChangeExempt(req) {
  const url = String(req.originalUrl || req.url || '').split('?')[0];
  return PASSWORD_CHANGE_EXEMPT.some((re) => re.test(url));
}

/**
 * Best-effort authentication. If a valid Bearer token is present, attaches
 * req.user; otherwise it silently continues as an anonymous request. Use this
 * on endpoints that are public but can enrich their response for signed-in
 * callers (e.g. the global leaderboard returning the caller's own rank).
 */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await userRepository.findById(payload.sub);
    if (user && !user.deletedAt && user.status !== 'suspended') {
      req.user = user;
    }
  } catch {
    /* invalid/expired token → treat as anonymous */
  }
  return next();
});

export const authorize = (...roles) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }
    if (roles.length && !roles.includes(req.user.role)) {
      throw ApiError.forbidden('You do not have permission to perform this action');
    }
    next();
  });

/**
 * Org scoping guard. Ensures the authenticated user is bound to an organization
 * and exposes it on req.orgId for downstream services. superadmin (org=null)
 * is rejected here since these routes are tenant-scoped.
 */
export const requireOrg = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }
  if (!req.user.org) {
    throw ApiError.forbidden('No organization is associated with this account');
  }
  req.orgId = req.user.org;
  next();
});

/**
 * Capability guard — prefer this over `authorize(...roles)`.
 *
 * Routes declare WHAT they need ('student:write') rather than WHO may do it,
 * so introducing a role is a single edit in config/permissions.js instead of a
 * sweep through every route file. Unknown capabilities fail closed.
 *
 *   router.post('/students', protect, requireCapability('student:write'), …)
 */
export const requireCapability = (...capabilities) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }
    const ok = capabilities.every((cap) => roleHasCapability(req.user.role, cap));
    if (!ok) {
      throw ApiError.forbidden('You do not have permission to perform this action');
    }
    next();
  });

/**
 * Attach the caller's classroom scope.
 *
 * Faculty may only see the students in the classrooms they teach, which is a
 * data-scoping rule that a role check cannot express. This resolves it once
 * per request and exposes it as `req.classroomScope`:
 *
 *   null            -> unrestricted within the org (admin/superadmin)
 *   ObjectId[]      -> restricted to these classroom ids (faculty)
 *
 * Downstream services narrow their queries with it. Import is lazy to avoid a
 * circular dependency between middleware and models.
 */
export const withClassroomScope = asyncHandler(async (req, _res, next) => {
  req.classroomScope = null;
  if (!req.user) return next();

  const { isClassroomScoped } = await import('../config/permissions.js');
  if (!isClassroomScoped(req.user.role)) return next();

  const { Classroom } = await import('../models/Classroom.js');
  const classes = await Classroom.find({
    org: req.user.org,
    faculty: req.user._id,
    archivedAt: null,
  }).select('_id');

  req.classroomScope = classes.map((c) => c._id);
  return next();
});

export default {
  protect,
  optionalAuth,
  authorize,
  requireOrg,
  requireCapability,
  withClassroomScope,
};
