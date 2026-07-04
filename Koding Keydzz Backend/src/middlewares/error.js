import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}`;
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({
      path: e.path,
      message: e.message,
    }));
  }

  // Mongoose cast error (bad ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  if (statusCode >= 500) {
    // Structured, greppable one-liner with method + path + status so 5xx errors
    // are easy to find and ship to a log aggregator, even in production where
    // the client only ever sees a generic message.
    const record = {
      level: 'error',
      status: statusCode,
      method: req?.method,
      path: req?.originalUrl,
      message: err.message,
      timestamp: new Date().toISOString(),
    };
    console.error('[error]', JSON.stringify(record));
    // Always keep the full error object (stack + driver internals) in the logs
    // too, so nothing is lost regardless of what we expose to the client.
    console.error(err);

    // Optional error-tracking hook. When SENTRY_DSN is configured we emit a
    // structured record here. To wire full APM, install `@sentry/node`,
    // initialize it in src/server.js, and replace this block with
    // `Sentry.captureException(err)`. See DEPLOYMENT.md → Monitoring & Backups.
    if (env.SENTRY_DSN) {
      console.error('[sentry]', JSON.stringify({ ...record, stack: err.stack }));
    }
  }

  const isProd = env.NODE_ENV === 'production';

  // In production, never leak internal error messages/stacks for server-side
  // (5xx) failures — they often contain DB details, file paths, or driver
  // internals. Return a generic message. Operational 4xx errors keep their
  // (developer-authored, safe) messages so clients get useful feedback.
  const payload = {
    success: false,
    message: isProd && statusCode >= 500 ? 'Internal server error' : message,
  };

  // Validation/duplicate/cast details describe the client's own bad input, so
  // they are safe to expose in all environments.
  if (details) payload.details = details;

  // Stack traces only ever leave the process in non-production.
  if (!isProd && statusCode >= 500) {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
};

export default { notFound, errorHandler };
