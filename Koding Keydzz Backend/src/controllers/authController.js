import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as authService from '../services/authService.js';

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

export default { registerStudent, login, refresh, logout, me, changePassword };
