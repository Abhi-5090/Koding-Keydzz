import { isRejectedWithValue } from '@reduxjs/toolkit';
import { formatApiError } from '../../utils/apiError';
import { toast } from '../../components/ui/toast/ToastProvider';

/**
 * ONE MIDDLEWARE THAT ANNOUNCES EVERY FAILED REQUEST.
 *
 * WHY HERE AND NOT AT THE CALL SITES
 * ----------------------------------
 * Twenty-six files call `formatApiError` and render the result inline, which
 * works only where somebody remembered to write it. The failures that actually
 * bite are the ones nobody wrote a branch for — a background refetch, a
 * mutation whose `catch` swallowed the error, an endpoint added next month.
 * Those fail silently, and a silent failure is the worst outcome available: the
 * user believes their work saved.
 *
 * A middleware sees every rejected query and mutation in the application, so
 * one place covers all of it — including the code that has not been written
 * yet. Inline errors stay where they are: a message beside the field it
 * belongs to is better than a toast, and this is the safety net under them.
 *
 * WHAT IT DELIBERATELY STAYS QUIET ABOUT
 * --------------------------------------
 *  • 401 — the reauth flow handles it, and the user is being redirected to the
 *    login page. A toast saying "Unauthorized" during a redirect is noise
 *    about something already being fixed.
 *  • The PASSWORD_CHANGE_REQUIRED 403 — the route guard is already diverting
 *    the user to the screen that resolves it. Telling them off on the way is
 *    not help.
 *  • Aborted requests — a component unmounting mid-fetch is not a failure.
 *  • The metrics poll — a health panel that cannot reach the server renders
 *    its own explanation, and a toast every thirty seconds would bury
 *    everything else.
 */

/** Endpoints whose failures explain themselves in place. */
const SILENT_ENDPOINTS = new Set(['getSystemHealth']);

/** Endpoints where a failed READ is worth announcing rather than swallowing. */
function isMutation(action) {
  return action.meta?.arg?.type === 'mutation';
}

export const toastOnError = () => (next) => (action) => {
  if (!isRejectedWithValue(action)) return next(action);

  const status = action.payload?.status;
  const endpoint = action.meta?.arg?.endpointName;

  // The reauth flow owns this one; the user is already being redirected.
  if (status === 401) return next(action);

  // A forced password change is already handled by the route guard.
  if (status === 403 && action.payload?.data?.details?.code === 'PASSWORD_CHANGE_REQUIRED') {
    return next(action);
  }

  // A component unmounting mid-request is not a failure.
  if (action.meta?.condition || action.error?.name === 'AbortError') return next(action);

  if (SILENT_ENDPOINTS.has(endpoint)) return next(action);

  const message = formatApiError(action.payload);

  /**
   * Rate limiting gets its own wording.
   *
   * "Too many requests" is what the server says and it reads as a fault. The
   * honest version tells the user it is temporary and roughly what to do,
   * because the commonest cause is a legitimate person working quickly.
   */
  if (status === 429) {
    toast().warning(
      message || 'You are going a little too fast. Wait a moment and try again.',
      'Slow down'
    );
    return next(action);
  }

  if (status === 'FETCH_ERROR' || status === undefined) {
    toast().error(
      'We could not reach the server. Check your connection — nothing was saved.',
      'No connection'
    );
    return next(action);
  }

  /**
   * A failed WRITE is stated as a failed write.
   *
   * The distinction matters more than it looks: a read that fails leaves the
   * screen empty, which the user can see. A write that fails leaves the screen
   * looking exactly like success, so it has to say that nothing was saved.
   */
  toast().error(message, isMutation(action) ? 'Not saved' : undefined);

  return next(action);
};

export default toastOnError;
