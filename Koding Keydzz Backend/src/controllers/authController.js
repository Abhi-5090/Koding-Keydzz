import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as authService from '../services/authService.js';
import * as passwordReset from '../services/passwordResetService.js';

export const registerStudent = asyncHandler(async (req, res) => {
  const result = await authService.registerStudent(req.body);
  return sendSuccess(res, result, 'Registration successful', 201);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login({
    ...req.body,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
  });
  return sendSuccess(res, result, 'Login successful');
});

export const refresh = asyncHandler(async (req, res) => {
  // Returns a ROTATED refresh token alongside the new access token — clients
  // must persist both (see the frontend's baseApi reauth handler).
  const result = await authService.refresh(req.body.refreshToken, {
    userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
  });
  return sendSuccess(res, result, 'Token refreshed');
});

export const logout = asyncHandler(async (req, res) => {
  // Only this device by default; `allDevices: true` signs out everywhere.
  const result = await authService.logout(req.user._id, {
    refreshToken: req.body?.refreshToken || null,
    allDevices: Boolean(req.body?.allDevices),
  });
  return sendSuccess(res, result, 'Logged out');
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.buildAuthUser(req.user);
  return sendSuccess(res, { user }, 'Current user');
});

export const changePassword = asyncHandler(async (req, res) => {
  // Returns a fresh token pair: the change revokes every session, so the
  // caller's existing tokens are dead by the time this responds.
  const result = await authService.changePassword(req.user._id, {
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
  });
  return sendSuccess(res, result, 'Password changed');
});

/* ---- Self-service password reset ---- */

/**
 * Ask for a reset link.
 *
 * ALWAYS 200 with the same body. Whether the address exists, belongs to a
 * pupil, is suspended, or mail is switched off entirely, the caller learns
 * nothing — a reset form that distinguishes these is a free tool for finding
 * out which of a school's staff addresses are real.
 */
export const requestPasswordReset = asyncHandler(async (req, res) => {
  const data = await passwordReset.request({ email: req.body.email });
  return sendSuccess(res, { requested: true }, data.message);
});

/** Is this link usable? Lets the screen explain itself before anything is typed. */
export const inspectPasswordReset = asyncHandler(async (req, res) => {
  const data = await passwordReset.inspect({ token: req.query.token });
  return sendSuccess(res, data, data.valid ? 'Link is valid' : 'Link cannot be used');
});

export const completePasswordReset = asyncHandler(async (req, res) => {
  const data = await passwordReset.complete({
    token: req.body.token,
    newPassword: req.body.newPassword,
  });
  return sendSuccess(res, data, 'Password reset. Please sign in with your new password.');
});

export default {
  registerStudent,
  login,
  refresh,
  logout,
  me,
  changePassword,
  requestPasswordReset,
  inspectPasswordReset,
  completePasswordReset,
};
