import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { userRepository } from '../repositories/userRepository.js';

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
  if (!user) {
    throw ApiError.unauthorized('User no longer exists');
  }
  if (user.status === 'suspended') {
    throw ApiError.forbidden('Account is suspended');
  }

  req.user = user;
  next();
});

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
    if (user && user.status !== 'suspended') {
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

export default { protect, optionalAuth, authorize, requireOrg };
