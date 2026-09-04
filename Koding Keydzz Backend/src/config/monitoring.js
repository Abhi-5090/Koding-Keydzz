/**
 * Error tracking.
 *
 * Previously `SENTRY_DSN` only caused an extra `console.error` — so in
 * production nothing aggregated errors and nothing alerted anyone. A crash
 * could take the platform down for every school with no notification at all.
 *
 * This wires the real `@sentry/node` SDK. It is entirely optional: with no
 * `SENTRY_DSN` set, every function here is a no-op and the app behaves exactly
 * as before, so local development and CI need no configuration.
 *
 * Initialize once, as early as possible (see src/server.js).
 */
import * as Sentry from '@sentry/node';
import { env } from './env.js';

let initialized = false;

export function initMonitoring() {
  if (initialized) return false;
  if (!env.SENTRY_DSN) {
    if (env.NODE_ENV === 'production') {
      console.warn(
        '[monitoring] SENTRY_DSN is not set — errors will only reach stdout. ' +
          'Set it so 5xx failures and crashes actually alert someone.'
      );
    }
    return false;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Keep performance tracing light; this is an error-tracking setup.
    tracesSampleRate: 0,
    // Never ship request bodies: they contain student names, passwords on the
    // login route, and roster spreadsheets.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });

  initialized = true;
  console.log(`[monitoring] Sentry initialized (env: ${env.NODE_ENV}).`);
  return true;
}

export function isMonitoringEnabled() {
  return initialized;
}

/**
 * Report an error. Safe to call unconditionally — a no-op when Sentry is off,
 * and never throws (a monitoring failure must not become an app failure).
 */
export function captureError(err, context = {}) {
  if (!initialized) return;
  try {
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
      Sentry.captureException(err);
    });
  } catch (e) {
    console.error('[monitoring] captureError failed:', e?.message || e);
  }
}

/** Flush buffered events before the process exits. */
export async function flushMonitoring(timeoutMs = 2000) {
  if (!initialized) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    /* best effort */
  }
}

export default {
  initMonitoring,
  isMonitoringEnabled,
  captureError,
  flushMonitoring,
};
