import { userRepository } from '../repositories/userRepository.js';
import { orgRepository } from '../repositories/orgRepository.js';
import { ApiError } from '../utils/ApiError.js';
import {
  generateTokenPair,
  signAccessToken,
  signRefreshToken,
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
import { addSession, rotateSession, isSessionActive } from '../utils/sessions.js';
import { capabilitiesForRole, ROLES } from '../config/permissions.js';

/**
 * Issue a fresh token pair and REGISTER it as a new session, keeping any other
 * devices signed in.
 *
 * A single `refreshTokenHash` used to be overwritten here, so signing in on a
 * second device silently revoked the first — a real problem in a school where
 * a child moves between a lab PC and a tablet.
 */
async function issueTokens(user, { userAgent = '' } = {}) {
  const { accessToken, refreshToken } = generateTokenPair(user);
  const refreshTokenHash = await hashToken(refreshToken);

  // Load the current session list (it's `select: false`).
  const withSessions = await userRepository.findByIdWithSecrets(user._id);
  const current = withSessions?.sessions || [];

  const next = addSession(current, { hash: refreshTokenHash, userAgent });
  await userRepository.setSessions(user._id, next);

  return { accessToken, refreshToken };
}

/**
 * Build a safe user payload for the client.
 *
 * Includes `capabilities` — the list of things this role may do, from
 * config/permissions.js. The frontends use it to decide which navigation and
 * actions to render, so a faculty member never sees a "Manage staff" link they
 * would only get a 403 from. It is a UI hint ONLY: every route still enforces
 * the capability server-side.
 *
 * For faculty it also includes their classroom assignments, which is what the
 * teacher dashboard is scoped to.
 */
export async function buildAuthUser(user) {
  const safe = user.toSafeJSON();

  if (user.org) {
    const org = await orgRepository.findById(user.org);
    safe.org = org
      ? {
          id: String(org._id),
          name: org.name,
          code: org.code,
          plan: org.plan || 'trial',
          timezone: org.timezone || '',
        }
      : null;
  } else {
    safe.org = null;
  }

  safe.capabilities = capabilitiesForRole(user.role);

  if (user.role === ROLES.FACULTY) {
    const { Classroom } = await import('../models/Classroom.js');
    const classes = await Classroom.find({
      org: user.org,
      faculty: user._id,
      archivedAt: null,
    }).select('name grade section subject students');

    safe.classrooms = classes.map((c) => ({
      id: String(c._id),
      name: c.name,
      grade: c.grade || '',
      section: c.section || '',
      subject: c.subject || '',
      studentCount: c.students?.length || 0,
    }));
  }

  return safe;
}

/**
 * Public self-registration (only reachable when ALLOW_STUDENT_SIGNUP=true).
 *
 * EVERY USER BELONGS TO A SCHOOL.
 * This used to create an account with no `org` at all, which produced a tenant
 * orphan: no school owned it, so no admin could see or manage the pupil, they
 * appeared on no classroom, and every org-scoped query filtered them out —
 * yet they could still sign in and play. The join code is what stops that:
 * without a resolvable organization there is no account.
 */
export async function registerStudent({ name, grade, school, email, password, orgCode }) {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  // Resolve the school BEFORE creating anything, so a bad code cannot leave a
  // half-made account behind.
  const { Organization } = await import('../models/Organization.js');
  const org = await Organization.findOne({ code: String(orgCode || '').trim().toUpperCase() });
  if (!org) {
    // Deliberately does not distinguish "no such code" from "wrong code" — the
    // codes are short, and confirming which ones exist would let anyone
    // enumerate the schools on the platform.
    throw ApiError.badRequest('That school code is not recognised. Check it with your teacher.');
  }
  if (org.status && org.status !== 'active') {
    throw ApiError.badRequest(`${org.name} is not accepting new sign-ups right now.`);
  }
  if (org.seatLimit) {
    const seatsUsed = await userRepository.model.countDocuments({
      org: org._id,
      role: 'student',
      deletedAt: null,
    });
    if (seatsUsed >= org.seatLimit) {
      throw ApiError.badRequest(
        `${org.name} has no places left. Ask your teacher to add you.`
      );
    }
  }

  const user = new (userRepository.model)({
    name,
    email,
    grade,
    school: school || org.name,
    org: org._id,
    role: 'student',
  });
  await user.setPassword(password);
  await user.save();

  const tokens = await issueTokens(user);
  return { user: await buildAuthUser(user), ...tokens };
}

export async function login({ identifier, email, password, userAgent = '' }) {
  // Accept a username OR email. Body may be { identifier, password } (preferred)
  // or the legacy { email, password } — the email value is used as the
  // identifier when `identifier` is absent. Resolution is case-insensitive and
  // matches either field (see userRepository.findByLogin).
  const loginId = identifier != null && String(identifier).trim() !== '' ? identifier : email;
  if (loginId == null || String(loginId).trim() === '') {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const user = await userRepository.findByLogin(loginId, true);
  // A soft-deleted account gets the SAME generic response as a non-existent
  // one — never confirm that a removed pupil once existed.
  if (!user || user.deletedAt) {
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

  /**
   * TRANSPARENTLY UPGRADE A WEAK HASH.
   *
   * Raising the bcrypt cost factor protects nobody who already has an account:
   * their hash keeps the cost it was written with for ever. Every existing
   * password in the database would stay at the old cost unless something
   * rewrote it, and asking a whole school to change their passwords is not a
   * plan anyone would carry out.
   *
   * This is the ONLY moment the plaintext exists to rehash with, so it happens
   * here — after the password has been verified, so nothing is written on a
   * failed attempt.
   *
   * Wrapped so it can NEVER fail the login. The user typed the right password;
   * refusing them because a housekeeping write failed would be a self-inflicted
   * outage, and the upgrade will simply be retried on their next sign-in.
   */
  if (typeof user.needsRehash === 'function' && user.needsRehash()) {
    try {
      await user.setPassword(password);
      await userRepository.setPasswordHash(user._id, user.passwordHash);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[auth] could not upgrade password hash for ${user._id}: ${err.message}`);
    }
  }

  // Org-scoped users (admin/student) cannot log in while their org is suspended.
  if (user.org) {
    const org = await orgRepository.findById(user.org);
    if (org && org.status === 'suspended') {
      throw ApiError.forbidden('Organization suspended');
    }
  }

  /**
   * Record the sign-in with an ATOMIC update, not a read-modify-save.
   *
   * `user.save()` here made a successful login depend on the document being
   * unchanged since it was loaded a few milliseconds earlier. Mongoose builds
   * its update from the loaded state, so a concurrent write to the same user —
   * another device signing in, a roster edit, a reward being credited — could
   * make the save match nothing and raise `DocumentNotFoundError`. The pupil
   * then got a 500 on a login whose password was correct.
   *
   * That is a poor trade for one timestamp: nothing here needs the read. A
   * targeted `$set` cannot conflict with anything, so this failure mode is
   * gone rather than made less likely.
   *
   * The in-memory copy is updated too, because `buildAuthUser(user)` below
   * reads from it.
   */
  const now = new Date();
  await userRepository.touchLastLogin(user._id, now);
  user.lastLoginAt = now;

  const tokens = await issueTokens(user, { userAgent });
  return { user: await buildAuthUser(user), ...tokens };
}

export async function refresh(refreshToken, { userAgent = '' } = {}) {
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
  if (!user || user.deletedAt) {
    throw ApiError.unauthorized('Session not found, please log in again');
  }
  if (user.status === 'suspended') {
    throw ApiError.forbidden('Account is suspended');
  }

  const sessions = user.sessions || [];

  // Find which session this token belongs to. Hashes are SHA-256 digests, so
  // this is a cheap constant-time comparison per candidate session.
  let matchIndex = -1;
  for (let i = 0; i < sessions.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await compareToken(refreshToken, sessions[i].hash)) {
      matchIndex = i;
      break;
    }
  }

  /* ------------------------------------------------------------------------
   * Legacy fallback: honour a pre-migration session (stored in the old single
   * `refreshTokenHash` field) exactly ONCE, upgrading it to a real session row
   * so nobody is signed out by the deploy that introduces multi-device
   * sessions.
   *
   * It MUST be one-shot. Leaving the field populated would let that old token
   * be replayed indefinitely and would survive a password reset, defeating
   * both rotation and revocation.
   * ---------------------------------------------------------------------- */
  if (matchIndex === -1 && user.refreshTokenHash) {
    const legacyMatch = await compareToken(refreshToken, user.refreshTokenHash);
    if (legacyMatch) {
      // Consume the legacy hash before issuing anything else — atomically,
      // for the same reason as the login timestamp above.
      await userRepository.clearLegacyRefreshHash(user._id);
      user.refreshTokenHash = null;
      return issueTokens(user, { userAgent });
    }
  }

  if (matchIndex === -1) {
    throw ApiError.unauthorized('Refresh token has been revoked');
  }

  // Idle timeout: school devices are shared, so an unused session expires even
  // though the JWT itself may not have.
  if (!isSessionActive(sessions[matchIndex])) {
    const remaining = sessions.filter((_, i) => i !== matchIndex);
    await userRepository.setSessions(user._id, remaining);
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  /* ------------------------------------------------------------------------
   * ROTATION. The presented refresh token is replaced, so a captured token
   * stops working as soon as the real device refreshes. Previously the same
   * refresh token stayed valid for its full 7-day TTL and was never rotated.
   *
   * The access token is re-signed with the FULL claim set. It used to be
   * minted as { sub, role } only, silently dropping `org` — which now also
   * matters because socket battle matchmaking reads the org claim.
   * ---------------------------------------------------------------------- */
  const accessToken = signAccessToken({
    sub: String(user._id),
    role: user.role,
    org: user.org ? String(user.org) : null,
  });
  const newRefreshToken = signRefreshToken({
    sub: String(user._id),
    role: user.role,
    org: user.org ? String(user.org) : null,
  });
  const newHash = await hashToken(newRefreshToken);

  await userRepository.setSessions(
    user._id,
    rotateSession(sessions, matchIndex, { hash: newHash, userAgent })
  );

  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Sign out. By default only THIS device's session is revoked, so a student
 * logging out of a shared classroom PC doesn't also sign out their tablet.
 * Pass `allDevices` to revoke everything.
 */
export async function logout(userId, { refreshToken = null, allDevices = false } = {}) {
  if (allDevices || !refreshToken) {
    await userRepository.revokeAllSessions(userId);
    return { success: true, revoked: 'all' };
  }

  const user = await userRepository.findByIdWithSecrets(userId);
  const sessions = user?.sessions || [];
  const remaining = [];
  let removed = false;
  for (const session of sessions) {
    // eslint-disable-next-line no-await-in-loop
    if (!removed && (await compareToken(refreshToken, session.hash))) {
      removed = true;
      continue;
    }
    remaining.push(session);
  }
  await userRepository.setSessions(userId, remaining);
  return { success: true, revoked: removed ? 'current' : 'none' };
}

/**
 * MINIMUM LENGTH FOR A SELF-CHOSEN PASSWORD, BY ROLE.
 *
 * Matched to how each kind of account is created: staff are provisioned with an
 * 8-character floor, pupils with 6. Choosing your own password must not be a
 * way to end up weaker than the account was provisioned with.
 */
const SELF_SET_MIN_LENGTH = Object.freeze({
  superadmin: 8,
  admin: 8,
  faculty: 8,
  student: 6,
});

/**
 * Change your own password.
 *
 * WHY THIS EXISTS
 * ---------------
 * `mustChangePassword` was written by staff creation and by every staff
 * password reset, surfaced on the staff roster as a "pending invite" badge —
 * and there was no endpoint anywhere that could satisfy it. A teacher was given
 * a temporary password and could never change it, so the administrator who
 * created the account knew that password for as long as the account existed.
 * The same applied to any pupil password a teacher reset.
 *
 * THE CURRENT PASSWORD IS REQUIRED
 * --------------------------------
 * Not ceremony. A stolen access token is enough to call this endpoint, so
 * without the current password a leaked token could be escalated into
 * permanent account takeover. Requiring it means an attacker needs the
 * password too — and the password is the thing the token was supposed to avoid
 * exposing.
 *
 * EVERY OTHER SESSION IS REVOKED
 * ------------------------------
 * Changing a password is what someone does when they think it is compromised,
 * so it has to end the sessions they cannot see. The caller gets a fresh token
 * pair back and stays signed in on this device; every other device is logged
 * out. Leaving them alive would make this endpoint useless for the one case it
 * matters most in.
 */
export async function changePassword(
  userId,
  { currentPassword, newPassword, userAgent = '' } = {}
) {
  const user = await userRepository.findByIdWithSecrets(userId);
  if (!user || user.deletedAt) {
    throw ApiError.unauthorized('User no longer exists');
  }

  const ok = await user.comparePassword(currentPassword);
  if (!ok) {
    // Deliberately not "wrong password" vs "no password set" — same answer.
    throw ApiError.unauthorized('Your current password is incorrect');
  }

  const min = SELF_SET_MIN_LENGTH[user.role] ?? 8;
  if (String(newPassword).length < min) {
    throw ApiError.badRequest(`New password must be at least ${min} characters`);
  }

  // Re-setting the same password would clear `mustChangePassword` without
  // changing anything, which is exactly the outcome the flag exists to prevent.
  if (await user.comparePassword(newPassword)) {
    throw ApiError.badRequest('New password must be different from your current one');
  }

  await user.setPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();

  // Drop every session, then issue a new pair for the caller's own device.
  await userRepository.revokeAllSessions(user._id);
  const tokens = await issueTokens(user, { userAgent });

  return { user: await buildAuthUser(user), ...tokens };
}

export default { registerStudent, login, refresh, logout, changePassword };
