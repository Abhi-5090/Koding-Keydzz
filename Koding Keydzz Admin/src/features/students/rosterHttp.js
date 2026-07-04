// Authenticated, non-RTK HTTP helpers for student roster operations that don't
// fit RTK Query cleanly: multipart bulk uploads (file + common password) and
// binary template/roster downloads. These mirror the pattern used by
// `exportStudentsCsv` in adminApi.js — reading the access token from the same
// localStorage key the auth slice persists to.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500/api/v1';
const AUTH_STORAGE_KEY = 'kk_admin_auth';

function getAccessToken() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.accessToken || null;
  } catch {
    return null;
  }
}

function authHeaders(extra = {}) {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Surface a useful message from a non-OK response (JSON {message} or plain text).
async function errorFromResponse(res, fallback) {
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = await res.json();
      return body?.message || body?.details?.[0]?.message || fallback;
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

/**
 * Download the bulk-upload Excel template from the server.
 * @param {string} path e.g. '/admin/students/template' or '/superadmin/students/template'
 */
export async function downloadTemplate(path) {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Could not download the template.');
  const blob = await res.blob();
  downloadBlob(blob, 'students_template.xlsx');
}

/**
 * Bulk-upload students from a file with a single common password.
 * Posts multipart/form-data: `file` + `password`.
 * @returns the parsed server payload ({ createdCount, skippedCount, created, skipped }).
 */
export async function bulkUploadStudents({ path, file, password }) {
  const form = new FormData();
  form.append('file', file);
  if (password) form.append('password', password);

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(), // do NOT set Content-Type — the browser sets the multipart boundary
    body: form,
  });

  if (!res.ok) {
    throw new Error(await errorFromResponse(res, 'Upload failed. Please try again.'));
  }
  const body = await res.json();
  return body?.data ?? body;
}
