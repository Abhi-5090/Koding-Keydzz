import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as authService from '../services/authService.js';

export const registerStudent = asyncHandler(async (req, res) => {
  const result = await authService.registerStudent(req.body);
  return sendSuccess(res, result, 'Registration successful', 201);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return sendSuccess(res, result, 'Login successful');
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken);
  return sendSuccess(res, result, 'Token refreshed');
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  return sendSuccess(res, null, 'Logged out');
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.buildAuthUser(req.user);
  return sendSuccess(res, { user }, 'Current user');
});

export default { registerStudent, login, refresh, logout, me };
