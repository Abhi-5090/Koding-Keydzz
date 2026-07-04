import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import * as uploadService from '../services/uploadService.js';
import { userRepository } from '../repositories/userRepository.js';

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!uploadService.isConfigured()) {
    throw new ApiError(503, 'Uploads not configured');
  }
  if (!req.file || !req.file.buffer) {
    throw ApiError.badRequest('No image file provided (field name: "file")');
  }

  const { url, publicId } = await uploadService.uploadAvatar(req.file.buffer);

  // Persist the new avatar image on the user.
  const user = await userRepository.findById(req.user._id);
  if (user) {
    user.avatar.url = url;
    user.avatar.publicId = publicId;
    await user.save();
  }

  return sendSuccess(res, { url, publicId }, 'Avatar uploaded');
});

export default { uploadAvatar };
