import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

let configured = false;

/**
 * Lazily configure Cloudinary from env. Returns false (without throwing) if
 * credentials are missing so the app never crashes at boot.
 */
function ensureConfigured() {
  if (configured) return true;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return false;
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
  configured = true;
  return true;
}

export function isConfigured() {
  return ensureConfigured();
}

/**
 * Upload an image buffer to Cloudinary and return the secure URL + public id.
 */
export async function uploadAvatar(buffer, { folder = 'koding-keydzz/avatars' } = {}) {
  if (!ensureConfigured()) {
    throw new ApiError(503, 'Uploads not configured');
  }
  if (!buffer || !buffer.length) {
    throw ApiError.badRequest('No file provided');
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(new ApiError(502, 'Upload failed'));
        return resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
    stream.end(buffer);
  });
}

export default { isConfigured, uploadAvatar };
