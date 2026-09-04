/**
 * Migration 003 — give existing pupils a streak document.
 *
 * Streaks were added after these accounts were created, so their `streak`
 * subdocument is absent. Mongoose supplies the defaults on READ, so nothing is
 * broken without this — but the dashboard counts pupils with
 * `streak.current >= 2` via a database query, and a missing field cannot be
 * compared. Backfilling means the operational figures are right from the first
 * deploy rather than drifting into correctness as pupils happen to log in.
 *
 * Deliberately starts everyone at zero. Inventing a streak nobody earned would
 * pay the bonus for days they did not attend.
 */
export const name = '003-streak-defaults';

export default async function up({ db }) {
  const res = await db.collection('users').updateMany(
    { role: 'student', streak: { $exists: false } },
    { $set: { streak: { current: 0, longest: 0, lastActiveOn: null } } }
  );
  // eslint-disable-next-line no-console
  console.log(`    backfilled streak on ${res.modifiedCount} pupil(s)`);
}
