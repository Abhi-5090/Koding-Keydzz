// Set BEFORE any import: src/config/env.js parses process.env once, at import
// time, so this has to happen at module scope — and in its own file, because
// resetting the module registry re-registers the mongoose models.
process.env.REDIS_URL = 'redis://127.0.0.1:1';

import { describe, it, expect } from 'vitest';
import http from 'node:http';

/**
 * A MISCONFIGURED backplane must stop the server, not degrade it.
 *
 * The tempting behaviour here is to catch the connection error and carry on
 * with the in-memory adapter. That produces the worst possible outcome: a
 * two-instance deployment that passes every health check while dropping any
 * notification whose pupil happens to be on the other instance. Nothing is
 * logged as an error, so the first sign of trouble is a teacher reporting that
 * badges "sometimes" do not arrive.
 *
 * Port 1 is reserved and nothing listens on it, so this exercises the real
 * failure path with no Redis server involved.
 */
describe('REDIS_URL set but unreachable', () => {
  it('refuses to start instead of quietly using the in-memory adapter', async () => {
    const { initSocket } = await import('../src/sockets/index.js');
    const server = http.createServer();
    try {
      await expect(initSocket(server)).rejects.toBeTruthy();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }, 30_000);
});
