import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/tokens.js';
import { env } from '../config/env.js';
import { registerBattleHandlers } from './battle.js';

let io = null;

export function initSocket(httpServer) {
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

  // Optional JWT auth on the socket handshake. Clients pass
  // { auth: { token: '<accessToken>' } }. Unauthenticated sockets are still
  // allowed (for public events) but won't join a user room.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        socket.userId = payload.sub;
      } catch {
        // ignore invalid token; treat as anonymous
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    socket.on('join', (userId) => {
      if (userId) socket.join(`user:${userId}`);
    });

    // Real-time battle arena (matchmaking + coding duels).
    registerBattleHandlers(io, socket);

    socket.on('disconnect', () => {
      /* battle.js registers its own disconnect handler for forfeits */
    });
  });

  return io;
}

export function getIO() {
  return io;
}

/** Emit a notification to a specific user's room. */
export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

/** Broadcast an event to all connected clients. */
export function emitBroadcast(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

export default { initSocket, getIO, emitToUser, emitBroadcast };
