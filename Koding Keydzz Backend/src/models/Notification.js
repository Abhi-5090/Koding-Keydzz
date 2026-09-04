import mongoose from 'mongoose';

/**
 * Single source of truth for notification types. Exported so the guard test can
 * diff it against the literals actually used in src/, and so callers can import
 * it rather than hard-coding strings.
 */
export const NOTIFICATION_TYPES = [
  'system',
  'achievement',
  'levelup',
  'challenge',
  'broadcast',
  'reward',
  'battle',
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // NOTE: every value passed to createNotification() must appear here or the
    // insert throws a ValidationError. 'battle' is emitted by sockets/battle.js.
    // See tests/notificationTypes.test.js, which asserts this enum covers every
    // literal used across the codebase so a new type can never slip through.
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: 'system',
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    read: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
