import { notificationRepository } from '../repositories/notificationRepository.js';
import { emitToUser, emitBroadcast } from '../sockets/index.js';

export async function createNotification(userId, { type = 'system', title, body = '', meta = {} }) {
  const notification = await notificationRepository.create({
    user: userId,
    type,
    title,
    body,
    meta,
  });
  emitToUser(String(userId), 'notification', notification);
  return notification;
}

export function listNotifications(userId) {
  return notificationRepository.findByUser(userId);
}

export async function broadcast({ type = 'broadcast', title, body = '', userIds = [] }) {
  if (!userIds.length) {
    emitBroadcast('notification', { type, title, body });
    return { count: 0 };
  }
  const docs = userIds.map((user) => ({ user, type, title, body }));
  const created = await notificationRepository.insertMany(docs);
  created.forEach((n) => emitToUser(String(n.user), 'notification', n));
  return { count: created.length };
}

export default { createNotification, listNotifications, broadcast };
