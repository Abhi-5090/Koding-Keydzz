import { userRepository } from '../repositories/userRepository.js';
import { orgRepository } from '../repositories/orgRepository.js';
import { ApiError } from '../utils/ApiError.js';
import {
  generateTokenPair,
  signAccessToken,
  verifyRefreshToken,
  hashToken,
  compareToken,
} from '../utils/tokens.js';
import {
  isLocked,
  lockRemainingMinutes,
  registerFailedAttempt,
  LOCK_DURATION_MS,
} from '../utils/loginLockout.js';

async function issueTokens(user) {
  const { accessToken, refreshToken } = generateTokenPair(user);
  const refreshTokenHash = await hashToken(refreshToken);
  await userRepository.setRefreshTokenHash(user._id, refreshTokenHash);
  return { accessToken, refreshToken };
}

/**
 * Build a safe user payload that always includes role and { org: { id, name } }.
 * superadmin has org=null.
 */
export async function buildAuthUser(user) {
  const safe = user.toSafeJSON();
  if (user.org) {
    const org = await orgRepository.findById(user.org);
    safe.org = org ? { id: String(org._id), name: org.name, code: org.code } : null;
  } else {
    safe.org = null;
  }
  return safe;
}

export async function registerStudent({ name, grade, school, email, password }) {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const user = new (userRepository.model)({
    name,
    email,
    grade,
    school,
    role: 'student',
  });
  await user.setPassword(password);
  await user.save();

  const tokens = await issueTokens(user);
  return { user: await buildAuthUser(user), ...tokens };
}

export async function login({ email, password }) {
  const user = await userRepository.findByEmail(email, true);
  if (!user) {
    throw ApiError.unauthorized('Invalid credentials');
  }
  if (user.status === 'suspended') {
    throw ApiError.forbidden('Account is suspended');
  }

  // Per-account lockout: refuse locked accounts BEFORE checking the password so
  // repeated guesses can't even reach bcrypt. (The IP-based authLimiter still
  // applies on top of this.)
  if (isLocked(user)) {
    const mins = lockRemainingMinutes(user);
    throw ApiError.locked(
      `Account temporarily locked. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`
    );
  }

  const ok = await user.comparePassword(password);
  if (!ok) {
    const next = registerFailedAttempt(user);
    await userRepository.setLockState(user._id, next.failedLoginAttempts, next.lockUntil);
    if (next.locked) {
      const mins = Math.ceil(LOCK_DURATION_MS / 60_000);
      throw ApiError.locked(
        `Account temporarily locked. Try again in ${mins} minutes.`
      );
    }
    // Never reveal whether the email exists — same message as an unknown email.
    throw ApiError.unauthorized('Invalid credentials');
  }

  // Successful password: clear any accumulated failed attempts / lock.
  if (user.failedLoginAttempts || user.lockUntil) {
    await userRepository.setLockState(user._id, 0, null);
  }

  // Org-scoped users (admin/student) cannot log in while their org is suspended.
  if (user.org) {
    const org = await orgRepository.findById(user.org);
    if (org && org.status === 'suspended') {
      throw ApiError.forbidden('Organization suspended');
    }
  }

  const tokens = await issueTokens(user);
  return { user: await buildAuthUser(user), ...tokens };
}

export async function refresh(refreshToken) {
  if (!refreshToken) {
    throw ApiError.unauthorized('Refresh token required');
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await userRepository.findByIdWithSecrets(payload.sub);
  if (!user || !user.refreshTokenHash) {
    throw ApiError.unauthorized('Session not found, please log in again');
  }

  const matches = await compareToken(refreshToken, user.refreshTokenHash);
  if (!matches) {
    throw ApiError.unauthorized('Refresh token has been revoked');
  }

  const accessToken = signAccessToken({ sub: String(user._id), role: user.role });
  return { accessToken };
}

export async function logout(userId) {
  await userRepository.setRefreshTokenHash(userId, null);
  return { success: true };
}

export default { registerStudent, login, refresh, logout };
