/**
 * Report every user who belongs to no organization — and optionally fix them.
 *
 * WHY
 * ---
 * `User.org` defaults to null, and public self-registration used to never set
 * it. Any account created that way is a tenant orphan: no school owns it, so
 * no admin can see or manage the pupil, they appear on no classroom, and every
 * org-scoped query filters them out — while they can still sign in and play.
 * Nothing in the product surfaced them, which is why they went unnoticed.
 *
 * The API now refuses to create one (a join code is required at registration),
 * but existing accounts still need re-homing.
 *
 * USAGE
 *   node scripts/find-unassigned-users.mjs                     # report only
 *   node scripts/find-unassigned-users.mjs --assign <ORGCODE>  # move them all
 *   node scripts/find-unassigned-users.mjs --assign <ORGCODE> --email a@b.com
 *
 * `superadmin` is never listed: being org-less is correct for the platform
 * operator.
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1] ?? '';
};
const assignCode = flag('assign');
const onlyEmail = flag('email');

await mongoose.connect(env.MONGO_URI);

const filter = { org: null, role: { $ne: 'superadmin' }, deletedAt: null };
if (onlyEmail) filter.email = String(onlyEmail).trim().toLowerCase();

const orphans = await User.find(filter)
  .select('name email username role grade createdAt lastLoginAt')
  .sort({ role: 1, createdAt: 1 })
  .lean();

if (orphans.length === 0) {
  console.log('No users without an organization. Nothing to do.');
  await mongoose.disconnect();
  process.exit(0);
}

console.log(`\n${orphans.length} user(s) belong to NO organization:\n`);
console.log('  role      identifier                          name');
console.log('  ' + '-'.repeat(74));
for (const u of orphans) {
  const id = u.email || u.username || '(none)';
  console.log(
    `  ${String(u.role).padEnd(9)} ${String(id).padEnd(35)} ${u.name || ''}` +
      (u.lastLoginAt ? '' : '   [never signed in]')
  );
}

if (!assignCode) {
  console.log(
    '\nTo fix these, either use the superadmin portal (Organizations -> ' +
      'Unassigned users) or re-run with:\n' +
      '  node scripts/find-unassigned-users.mjs --assign <ORGCODE>\n'
  );
  await mongoose.disconnect();
  process.exit(0);
}

const org = await Organization.findOne({ code: String(assignCode).trim().toUpperCase() });
if (!org) {
  console.error(`\nNo organization with code "${assignCode}".`);
  const all = await Organization.find({}).select('name code status').lean();
  console.error('Available:');
  for (const o of all) console.error(`  ${o.code.padEnd(12)} ${o.name} (${o.status})`);
  await mongoose.disconnect();
  process.exit(1);
}

// Seat limits are the org's own contract; a bulk fix must not silently breach
// one just because it is convenient.
if (org.seatLimit) {
  const seatsUsed = await User.countDocuments({ org: org._id, role: 'student', deletedAt: null });
  const incoming = orphans.filter((u) => u.role === 'student').length;
  if (seatsUsed + incoming > org.seatLimit) {
    console.error(
      `\n${org.name} has ${org.seatLimit - seatsUsed} seat(s) free but ${incoming} pupil(s) ` +
        'would be moved in. Raise the seat limit or assign them individually.'
    );
    await mongoose.disconnect();
    process.exit(1);
  }
}

const ids = orphans.map((u) => u._id);
const res = await User.updateMany({ _id: { $in: ids } }, { $set: { org: org._id } });
console.log(`\nAssigned ${res.modifiedCount ?? res.nModified} user(s) to ${org.name} (${org.code}).`);
console.log('They were in no classrooms, so nothing else needed cleaning up.');

await mongoose.disconnect();
