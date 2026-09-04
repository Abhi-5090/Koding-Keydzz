import http from 'http';
// Initialize error tracking before anything else so failures during boot are
// reported too.
import { initMonitoring, captureError, flushMonitoring } from './config/monitoring.js';
import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { initSocket, closeSocket, getIO } from './sockets/index.js';

// How long to wait for in-flight work to drain before forcing exit.
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function start() {
  initMonitoring();
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  // Awaited: when REDIS_URL is set this connects the multi-instance backplane,
  // and a socket served before it is attached would use the in-memory adapter.
  const io = await initSocket(server);

  server.listen(env.PORT, () => {
    console.log(`Koding Keydzz API listening on http://localhost:${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });

  let shuttingDown = false;

  // Gracefully stop accepting connections, close Socket.IO and the DB, then
  // exit. A hard timeout guarantees the process eventually dies even if a
  // socket refuses to close.
  async function shutdown(signal, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received, shutting down gracefully...`);

    const forceTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out — forcing exit.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    // Don't let the timer itself keep the event loop alive.
    forceTimer.unref();

    try {
      // Stop accepting new HTTP connections and wait for in-flight ones.
      await new Promise((resolve) => server.close(resolve));
      console.log('HTTP server closed.');

      // Close Socket.IO (disconnects clients, stops the engine).
      const activeIo = io || getIO();
      if (activeIo) {
        await new Promise((resolve) => activeIo.close(() => resolve()));
        // Close the Redis connections too, or the process hangs until the
        // force timer fires on every restart.
        await closeSocket();
        console.log('Socket.IO closed.');
      }

      // Flush any buffered error reports before the process goes away.
      await flushMonitoring();

      // Close the Mongoose connection last.
      await disconnectDB();
      console.log('MongoDB disconnected.');

      clearTimeout(forceTimer);
      process.exit(exitCode);
    } catch (err) {
      console.error('Error during shutdown:', err);
      clearTimeout(forceTimer);
      process.exit(1);
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // -------------------------------------------------------------------------
  // Process-safety nets.
  //
  // An unhandled *rejection* is almost always one background side-effect that
  // failed (a notification insert, an analytics write) — not a corrupted
  // process. Tearing the server down for that means one student's action can
  // take the platform offline for every school, so in production we log it
  // loudly and keep serving. Outside production we still exit, so the failure
  // is impossible to ignore during development and in CI.
  //
  // An uncaught *exception* genuinely can leave state inconsistent, so that one
  // always shuts down.
  // -------------------------------------------------------------------------
  process.on('unhandledRejection', (reason) => {
    const record = {
      level: 'error',
      kind: 'unhandledRejection',
      message: reason?.message || String(reason),
      timestamp: new Date().toISOString(),
    };
    console.error('[unhandledRejection]', JSON.stringify(record));
    console.error(reason);
    captureError(reason instanceof Error ? reason : new Error(String(reason)), {
      kind: 'unhandledRejection',
    });
    if (env.NODE_ENV !== 'production') {
      shutdown('unhandledRejection', 1);
    }
  });

  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    captureError(err, { kind: 'uncaughtException' });
    shutdown('uncaughtException', 1);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
