import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';

/**
 * THE MULTI-INSTANCE BACKPLANE.
 *
 * Socket.IO keeps its rooms in the memory of the process holding the
 * connection. Run two API instances without a shared backplane and
 * `emitToUser` becomes a coin toss: the pupil's socket is on one instance, the
 * emit happens on whichever instance served the request, and when they differ
 * the notification is dropped — no error, no log, the child just never sees it.
 *
 * These cases pin the two behaviours that make that safe to deploy:
 *   • no REDIS_URL -> a single instance works exactly as before (here);
 *   • REDIS_URL set but unreachable -> the server REFUSES TO START rather than
 *     falling back to the in-memory adapter and looking healthy while silently
 *     losing notifications (socketAdapterRedis.test.js — a separate file
 *     because the env is read once at import).
 */

const servers = [];

function freshServer() {
  const s = http.createServer();
  servers.push(s);
  return s;
}

afterEach(async () => {
  while (servers.length) {
    const s = servers.pop();
    await new Promise((resolve) => s.close(resolve));
  }
});

describe('a single instance needs no Redis', () => {
  it('starts with the in-memory adapter when REDIS_URL is unset', async () => {
    expect(process.env.REDIS_URL).toBeUndefined();
    const { initSocket, closeSocket, getIO } = await import('../src/sockets/index.js');

    const io = await initSocket(freshServer());
    expect(io).toBeTruthy();
    expect(getIO()).toBe(io);

    await new Promise((resolve) => io.close(() => resolve()));
    await closeSocket();
  });

  it('closeSocket is safe when there is nothing to close', async () => {
    const { closeSocket } = await import('../src/sockets/index.js');
    await expect(closeSocket()).resolves.toBeUndefined();
  });
});

describe('the adapter dependency is actually installed', () => {
  // The import is lazy, so a missing package would only surface on the first
  // production boot with REDIS_URL set — at which point the API will not start.
  it('can load @socket.io/redis-adapter and redis', async () => {
    const [{ createAdapter }, { createClient }] = await Promise.all([
      import('@socket.io/redis-adapter'),
      import('redis'),
    ]);
    expect(typeof createAdapter).toBe('function');
    expect(typeof createClient).toBe('function');
  });
});
