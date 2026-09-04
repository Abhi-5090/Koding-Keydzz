import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/tokens.js';
import { env } from '../config/env.js';
import { registerBattleHandlers } from './battle.js';

let io = null;
/** Redis clients, kept so shutdown can close them. Null on a single instance. */
let redisClients = [];

/**
 * Attach the Redis adapter so socket rooms work across API instances.
 *
 * WHY: Socket.IO stores its rooms in the process that owns the connection.
 * Run two instances behind a load balancer and `emitToUser` becomes a coin
 * toss — the pupil's socket is on one instance, the emit happens on whichever
 * instance served the HTTP request that triggered it, and if they differ the
 * notification is dropped silently. There is no error to notice; the child
 * simply never sees their badge, and half of all notifications go missing.
 *
 * Awaited on purpose. Connecting after `initSocket` returns would leave a
 * window where the server accepts sockets with the in-memory adapter still in
 * place, which is the same bug with a smaller blast radius.
 *
 * A single instance needs none of this — leave REDIS_URL unset.
 */
async function attachRedisAdapter(server) {
  if (!env.REDIS_URL) return false;

  // Imported lazily so a single-instance deployment never loads the client.
  const [{ createAdapter }, { createClient }] = await Promise.all([
    import('@socket.io/redis-adapter'),
    import('redis'),
  ]);

  // Two connection regimes, and they must differ.
  //
  // BEFORE the first successful connect, a wrong REDIS_URL is a configuration
  // error and the deploy should fail loudly. node-redis retries forever by
  // default, which would hang boot indefinitely with only a stream of
  // reconnect noise in the logs — worse than a crash, because a hung boot
  // looks like a slow start. So give up after a few attempts.
  //
  // AFTER it, a dropped connection is a transient blip and node-redis should
  // keep reconnecting: tearing the API down because Redis restarted would take
  // every school offline over an optional dependency.
  const CONNECT_ATTEMPTS = 5;
  let everConnected = false;

  const makeClient = () =>
    createClient({
      url: env.REDIS_URL,
      socket: {
        connectTimeout: 5_000,
        reconnectStrategy: (retries) => {
          if (!everConnected && retries >= CONNECT_ATTEMPTS) {
            // Returning an Error stops retrying and rejects connect().
            return new Error(
              `Redis unreachable at ${env.REDIS_URL} after ${CONNECT_ATTEMPTS} attempts`
            );
          }
          return Math.min(200 * 2 ** retries, 5_000);
        },
      },
    });

  const pubClient = makeClient();
  const subClient = makeClient();

  // An unhandled 'error' event on a redis client is fatal to the process, so
  // both clients always have a listener — including while reconnecting.
  for (const client of [pubClient, subClient]) {
    client.on('error', (err) => {
      console.error(`[socket] Redis client error: ${err?.message || err}`);
    });
    client.on('ready', () => {
      everConnected = true;
    });
  }

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
  } catch (err) {
    // Don't leave half-open clients retrying in the background behind a failed
    // boot — they would keep the event loop alive and the process would never
    // exit cleanly.
    await Promise.all(
      [pubClient, subClient].map((c) => c.disconnect().catch(() => {}))
    );
    throw err;
  }
  server.adapter(createAdapter(pubClient, subClient));
  redisClients = [pubClient, subClient];
  return true;
}

export async function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
        if (
          env.NODE_ENV !== 'production' &&
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        ) {
          return callback(null, true);
        }
        return callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    },
  });

  // -------------------------------------------------------------------------
  // MANDATORY JWT auth on the handshake.
  //
  // This used to be optional, and anonymous sockets were allowed "for public
  // events". Combined with a `join` event that took a user id on trust, that
  // let anyone who knew a student's id (they are handed out by the leaderboard
  // endpoints) subscribe to that child's private notification stream. Every
  // socket consumer in the product is an authenticated student surface, so
  // there is no reason to admit anonymous connections at all.
  // -------------------------------------------------------------------------
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyAccessToken(token);
      if (!payload?.sub) return next(new Error('Authentication required'));
      socket.userId = String(payload.sub);
      socket.userRole = payload.role || null;
      // Used by battle matchmaking to keep duels inside one school.
      socket.userOrg = payload.org ? String(payload.org) : null;
      return next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });

  // Multi-instance backplane. Attached BEFORE the connection handler is
  // registered, so no socket is ever served by the in-memory adapter.
  const instance = env.INSTANCE_ID ? ` [${env.INSTANCE_ID}]` : '';
  try {
    if (await attachRedisAdapter(io)) {
      console.log(`[socket]${instance} Redis adapter attached — rooms are cross-instance.`);
      // The adapter shares ROOMS, not application state. Battle matchmaking
      // keeps its waiting queue in this process's memory (see battle.js), so
      // two pupils served by different instances will not be paired with each
      // other. Sticky sessions keep each pupil pinned to one instance, which
      // Socket.IO requires anyway, but they do not merge the queues.
      console.warn(
        `[socket]${instance} NOTE: battle matchmaking is per-instance. Enable sticky ` +
          'sessions at the load balancer (nginx ip_hash — see DEPLOYMENT.md), and be ' +
          'aware pupils on different instances cannot duel each other.'
      );
    } else if (env.NODE_ENV === 'production') {
      console.warn(
        `[socket]${instance} REDIS_URL is not set: notifications and battles only work ` +
          'within a single API instance. This is correct for one instance — if you run ' +
          'more than one, set REDIS_URL or pupils will silently miss notifications.'
      );
    }
  } catch (err) {
    // Refuse to run half-configured. Falling back to the in-memory adapter here
    // would look like a working deployment while dropping notifications.
    console.error(
      `[socket]${instance} FATAL: REDIS_URL is set but the connection failed: ${err?.message || err}`
    );
    throw err;
  }

  io.on('connection', (socket) => {
    // The room is derived from the VERIFIED token subject only. There is no
    // client-supplied path into a user room — the old `socket.on('join', …)`
    // handler was removed because it joined whatever id it was handed.
    socket.join(`user:${socket.userId}`);

    // Real-time battle arena (matchmaking + coding duels).
    registerBattleHandlers(io, socket);
  });

  return io;
}

export function getIO() {
  return io;
}

/** Close the Redis connections on shutdown. Safe to call when there are none. */
export async function closeSocket() {
  const clients = redisClients;
  redisClients = [];
  await Promise.all(
    clients.map((c) => c.quit().catch(() => c.disconnect?.()))
  );
  io = null;
}

/** Emit a notification to a specific user's room. */
export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

/**
 * Emit to every CONNECTED socket.
 *
 * Deliberately not used for notifications: an unscoped emit crosses tenant
 * boundaries. Reserved for genuinely global, non-personal signals (e.g. a
 * maintenance banner) — pass no user data through it.
 */
export function emitBroadcast(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

export default { initSocket, closeSocket, getIO, emitToUser, emitBroadcast };
