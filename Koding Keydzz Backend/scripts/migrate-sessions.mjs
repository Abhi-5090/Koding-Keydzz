/**
 * Migration: single-session -> multi-device sessions.
 *
 * `User.refreshTokenHash` held ONE session per account, so signing in on a
 * second device silently revoked the first. Sessions now live in a
 * `User.sessions` array with per-device rotation and an idle timeout.
 *
 * This script moves any existing single hash into the new array so nobody is
 * signed out by the deploy. It is idempotent and safe to re-run.
 *
 *   node scripts/migrate-sessions.mjs
 */
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';

await connectDB();

/*
 * Refresh-token hashes also changed primitive (bcrypt -> SHA-256).
 *
 * bcrypt truncates at 72 bytes, and every JWT for one user shares its first 72
 * bytes, so all of a user's refresh tokens hashed identically and revocation
 * silently did not work. Old bcrypt digests therefore cannot be carried
 * forward — they are not merely a different format, they were not
 * distinguishing tokens in the first place.
 *
 * So we CLEAR stale session state rather than migrating it. Everyone signs in
 * once more after this deploy, which is the correct outcome: it also
 * invalidates any refresh token that was relying on the broken comparison.
 */
const { modifiedCount } = await User.updateMany(
  {
    $or: [
      { refreshTokenHash: { $ne: null } },
      { sessions: { $exists: true, $not: { $size: 0 } } },
    ],
  },
  { $set: { refreshTokenHash: null, sessions: [] } }
);
console.log(`Cleared ${modifiedCount} stale session record(s) — those users sign in once more.`);

/*
 * Sync indexes. On a fresh database this creates them; on an existing one it
 * adds the newer ones (the per-org rollNumber partial unique index, the
 * classroom lookup indexes) and drops any that are no longer declared.
 */
try {
  await User.syncIndexes();
  const { Classroom } = await import('../src/models/Classroom.js');
  const { Organization } = await import('../src/models/Organization.js');
  await Classroom.syncIndexes();
  await Organization.syncIndexes();
  console.log('Indexes synced (User, Classroom, Organization).');
} catch (err) {
  // An index build failure is worth reporting loudly but should not leave the
  // migration half-applied silently.
  console.error('Index sync failed:', err?.message || err);
  throw err;
}

await disconnectDB();
console.log('Migration complete.');
process.exit(0);
