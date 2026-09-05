/**
 * Turn an RTK Query error into a sentence a CHILD can act on.
 *
 * The admin portal has its own version of this written for school staff. This
 * one is deliberately separate rather than shared, because the audience is
 * different in a way that changes every string: a ten-year-old reading "Request
 * failed with status code 409" learns nothing, and "Validation failed" is worse
 * than silence because it sounds like they did something wrong.
 *
 * So the rules here are:
 *   • say what happened in plain words;
 *   • say whether their work was lost;
 *   • never show a status code, a field path, or the word "error".
 *
 * A server message is preferred when there is one, because the API is written
 * in the same voice ("You have already passed this course"). The fallbacks are
 * for the cases where it is not.
 */

/** Field problems, translated out of schema language. */
const FIELD_LABELS = {
  username: 'username',
  password: 'password',
  currentPassword: 'current password',
  newPassword: 'new password',
  answers: 'answers',
  response: 'answer'
}

export function formatApiError(err) {
  if (!err) return 'Something went wrong. Please try again.'

  // No connection at all — the one case where the cause is worth naming,
  // because the child can do something about it (or tell an adult).
  if (err.status === 'FETCH_ERROR' || err.status === undefined) {
    return 'We could not reach the server. Check the internet and try again.'
  }

  if (err.status === 429) {
    return 'That was a bit too fast! Wait a moment and try again.'
  }

  if (err.status === 401) {
    return 'You need to sign in again.'
  }

  const data = err.data || {}

  /**
   * A 5xx MESSAGE IS NEVER SHOWN, whatever it says.
   *
   * This is an information-disclosure boundary, not a tone decision. A 4xx
   * message is deliberate and written for the user ("You have already passed
   * this course"). A 5xx message is whatever threw — and in this codebase's
   * error middleware, an unexpected exception's `message` can carry a driver
   * string, a file path or a stack fragment. Passing that through printed
   * `ECONNREFUSED at Object.<anonymous>` to a ten-year-old, which is both
   * useless to them and free reconnaissance for anyone else looking over their
   * shoulder.
   *
   * Checked BEFORE the message branches below, because those would otherwise
   * return it first.
   */
  if (err.status >= 500) {
    return 'Something broke on our side, not yours. Please try again in a moment.'
  }

  // Field-level problems win: they are the actionable half.
  if (Array.isArray(data.details) && data.details.length) {
    const parts = data.details
      .map((d) => {
        const label = FIELD_LABELS[d.path] || d.path
        return label ? `${label}: ${d.message}` : d.message
      })
      .filter(Boolean)
    if (parts.length) return parts.join(' · ')
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    // "Validation failed" is the one server message that tells a child
    // nothing, and it only ever appears with `details` — which the branch
    // above already used. Reaching here with it means there were none.
    if (/^validation failed$/i.test(data.message.trim())) {
      return 'Something in that was not quite right. Have another look.'
    }
    return data.message
  }

  return 'Something went wrong. Please try again.'
}

export default formatApiError
