import { io } from 'socket.io-client'

// Prefer an explicit VITE_SOCKET_URL; otherwise derive the origin from
// VITE_API_URL by stripping the trailing /api/v1. The localhost fallback port
// is kept in sync with baseApi.js so an unset env in dev still lines up.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL || 'http://localhost:5500/api/v1').replace(/\/api\/v1$/, '')

let socket = null

/**
 * Lazily create (or return) the shared Socket.IO client.
 * Used for real-time features like live leaderboards and notifications.
 */
export function getSocket(token) {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket'],
      auth: token ? { token } : undefined,
    })
  }
  return socket
}

export function connectSocket(token) {
  const s = getSocket(token)
  if (token) s.auth = { token }
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket() {
  if (socket && socket.connected) socket.disconnect()
}
