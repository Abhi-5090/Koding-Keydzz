import { notificationRepository } from '../repositories/notificationRepository.js';
import { emitToUser } from '../sockets/index.js';

/**
 * Create a notification for a user.
 *
 * IMPORTANT: notifications are a cosmetic side-effect. They are frequently
 * created from fire-and-forget call sites (socket handlers, post-save hooks)
 * where a rejection would surface as an unhandledRejection and — before this
 * was hardened — take down the whole process. So this NEVER throws: a failure
 * is logged and `null` is returned. Callers that genuinely need to know can
 * check the return value.
 */
export async function createNotification(
  userId,
  { type = 'system', title, body = '', meta = {} }
) {
  if (!userId || !title) return null;
  try {
    const notification = await notificationRepository.create({
      user: userId,
      type,
      title,
      body,
      meta,
    });
    // Emitting must not be able to fail the create either.
    try {
      emitToUser(String(userId), 'notification', notification);
    } catch (emitErr) {
      console.error('[notification] emit failed:', emitErr?.message || emitErr);
    }
    return notification;
  } catch (err) {
    console.error(
      '[notification] create failed',
      JSON.stringify({
        user: String(userId),
        type,
        message: err?.message || String(err),
      })
    );
    return null;
  }
}

export function listNotifications(userId) {
  return notificationRepository.findByUser(userId);
}

/**
 * Broadcast to an explicit set of users. Like createNotification, this is
 * non-throwing — a broadcast failure must not fail the admin request that
 * triggered it beyond a reported count of 0.
 */
export async function broadcast({ type = 'broadcast', title, body = '', userIds = [] }) {
  try {
    if (!userIds.length) {
      // No recipients resolved — nothing to persist and nothing to emit. We
      // deliberately do NOT fall back to io.emit() here: an unscoped global
      // emit was how a single school's announcement reached every tenant.
      return { count: 0 };
    }
    const docs = userIds.map((user) => ({ user, type, title, body }));
    const created = await notificationRepository.insertMany(docs);
    created.forEach((n) => {
      try {
        emitToUser(String(n.user), 'notification', n);
      } catch {
        /* per-recipient emit failure must not abort the rest */
      }
    });
    return { count: created.length };
  } catch (err) {
    console.error('[notification] broadcast failed:', err?.message || err);
    return { count: 0, error: 'Broadcast partially failed' };
  }
}

export default { createNotification, listNotifications, broadcast };
