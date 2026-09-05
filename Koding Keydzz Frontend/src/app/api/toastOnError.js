import { isRejectedWithValue } from '@reduxjs/toolkit'
import { formatApiError } from '../../utils/apiError'
import { toast } from '../../components/ui/toast/ToastProvider'

/**
 * ONE MIDDLEWARE THAT TELLS A CHILD WHEN SOMETHING DID NOT WORK.
 *
 * WHY THIS MATTERS MORE HERE THAN IN THE STAFF PORTAL
 * --------------------------------------------------
 * A silent failure is confusing for an adult and demoralising for a ten-year-
 * old. A child who finishes a lesson, sees nothing happen, and loses the XP
 * concludes that they did it wrong — not that a request failed. So every
 * failure gets said out loud, in words, with whether their work was kept.
 *
 * A middleware rather than a branch at each call site, because the failures
 * that matter are the ones nobody wrote a branch for.
 *
 * EXAM INTEGRITY EXCEPTION
 * ------------------------
 * The final test autosaves every twelve seconds. On a flaky school connection
 * that is five failures a minute, and a stack of toasts over a child sitting an
 * exam would be actively harmful — it is the one moment in this product where
 * an interruption costs marks. The exam screen shows its own quiet, persistent
 * save indicator instead, so those endpoints are silenced here.
 */

/**
 * Endpoints that must never raise a toast.
 *
 * `saveFinalTestProgress` — the exam autosave, see above.
 * `getMyAssignments` / `getDashboard` — polled background reads whose screens
 * already render their own empty/error state; a toast would fire on every
 * refetch during a connection wobble.
 */
const SILENT_ENDPOINTS = new Set([
  'saveFinalTestProgress',
  'saveProgress',
  'getMyAssignments'
])

export const toastOnError = () => (next) => (action) => {
  if (!isRejectedWithValue(action)) return next(action)

  const status = action.payload?.status
  const endpoint = action.meta?.arg?.endpointName
  const isMutation = action.meta?.arg?.type === 'mutation'

  // The reauth flow owns 401 and is already sending them to sign in again.
  if (status === 401) return next(action)

  // A component unmounting mid-request is not a failure.
  if (action.meta?.condition || action.error?.name === 'AbortError') return next(action)

  if (SILENT_ENDPOINTS.has(endpoint)) return next(action)

  const message = formatApiError(action.payload)

  if (status === 429) {
    toast().warning(message, 'Too fast!')
    return next(action)
  }

  /**
   * A failed WRITE says the work was not kept.
   *
   * This is the sentence that stops a child repeating a lesson they already
   * finished, or assuming a quiz score vanished because they were bad at it.
   */
  toast().error(message, isMutation ? 'Not saved' : undefined)

  return next(action)
}

export default toastOnError
