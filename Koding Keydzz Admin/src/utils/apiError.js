/**
 * Turn an RTK Query error into something a school administrator can act on.
 *
 * THE BUG THIS FIXES
 * ------------------
 * The API reports field problems as
 *
 *   { success: false, message: 'Validation failed',
 *     details: [{ path: 'password', message: 'Password must be at least 6 characters' }] }
 *
 * and every form in this app read only `message`. So a user who typed a short
 * password — or left a required field blank — was told **"Validation failed"**
 * and nothing else. The information needed to fix it was in the response the
 * whole time, one key away, and it was thrown out.
 *
 * That is worse than a missing feature: the person cannot tell whether they
 * made a mistake or the product is broken, and the obvious next move is to try
 * the same thing again.
 *
 * WHAT IT RETURNS
 * ---------------
 * A single human sentence. Field errors win over the generic wrapper, because
 * "Password must be at least 6 characters" is the actionable half. Several
 * field errors are joined, so a form with two problems reports both rather
 * than making the user discover them one submit at a time.
 */

/** Field labels in school language, not schema language. */
const FIELD_LABELS = {
  firstName: 'First name',
  lastName: 'Last name',
  rollNumber: 'Roll number',
  email: 'Email',
  phone: 'Phone',
  grade: 'Grade',
  school: 'School',
  username: 'Username',
  password: 'Password',
  name: 'Name',
  org: 'School',
  orgCode: 'School code',
  title: 'Job title',
  subjects: 'Subjects',
  academicYear: 'Academic year',
  section: 'Section',
};

const label = (path) => {
  if (!path) return '';
  // Zod joins nested paths with a dot; the last segment is the field.
  const key = String(path).split('.').pop();
  return FIELD_LABELS[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2');
};

/**
 * @param {unknown} err       the error RTK Query rejected with
 * @param {string} fallback   used when the error carries nothing usable
 * @returns {string}
 */
export function formatApiError(err, fallback = 'Something went wrong. Please try again.') {
  const data = err?.data ?? err?.error?.data ?? null;

  /**
   * 0. A 5xx MESSAGE IS NEVER SHOWN, whatever it says.
   *
   * An information-disclosure boundary, and it has to come FIRST — step 2
   * below returns `data.message` for any status, so a 500 raised by an
   * unexpected exception printed whatever threw straight into the UI. In this
   * codebase's error middleware that can be a driver string, a file path or a
   * stack fragment: `ECONNREFUSED at Object.<anonymous>` is useless to a
   * school administrator and free reconnaissance to anyone else.
   *
   * A 4xx message is the opposite — deliberate, written for the user, and the
   * most useful thing in the response ("This school has no seats left").
   */
  if (typeof err?.status === 'number' && err.status >= 500) {
    return 'The server had a problem. Please try again in a moment.';
  }

  // 1. Field-level detail — the useful part, and the part that was being lost.
  const details = Array.isArray(data?.details) ? data.details : null;
  if (details?.length) {
    const parts = details
      .map((d) => {
        const msg = String(d?.message || '').trim();
        if (!msg) return '';
        const name = label(d?.path);
        // Do not prefix when the message already names the field, or it reads
        // "Password Password must be at least 6 characters".
        if (!name || msg.toLowerCase().startsWith(name.toLowerCase())) return msg;
        return `${name}: ${msg}`;
      })
      .filter(Boolean);
    if (parts.length) return parts.join(' · ');
  }

  // 2. A specific server message (duplicate email, seat limit, roll clash…).
  // 'Validation failed' is deliberately skipped: it is the generic wrapper,
  // and if we reach here without details there is nothing behind it.
  const message = String(data?.message || '').trim();
  if (message && message.toLowerCase() !== 'validation failed') return message;

  // 3. Transport-level failures, which look nothing like the above.
  if (err?.status === 'FETCH_ERROR') {
    return 'Could not reach the server. Check your connection and try again.';
  }
  if (err?.status === 401) return 'Your session has expired. Please sign in again.';
  if (err?.status === 403) return 'You do not have permission to do that.';
  if (err?.status === 413) return 'That file is too large.';
  if (err?.status === 429) return 'Too many attempts. Please wait a moment and try again.';

  return fallback;
}

export default formatApiError;
