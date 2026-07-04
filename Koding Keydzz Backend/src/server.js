import http from 'http';
import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { initSocket, getIO } from './sockets/index.js';

// How long to wait for in-flight work to drain before forcing exit.
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function start() {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  const io = initSocket(server);

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
        console.log('Socket.IO closed.');
      }

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

  // Process-safety nets. Log the failure with full detail, then shut down
  // cleanly rather than leaving the process in an unknown/half-broken state.
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
    shutdown('unhandledRejection', 1);
  });
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    shutdown('uncaughtException', 1);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
