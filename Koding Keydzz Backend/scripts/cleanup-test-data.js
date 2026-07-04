// One-off: remove throwaway test data created during development/verification.
// Keeps: superadmin@kodingkeydzz.com, admin@kodingkeydzz.com, the default org
// "Koding Keydzz Academy", and the developer's own account abhinallam@gmail.com.
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import {
  User,
  Organization,
  GameScore,
  QuizAttempt,
  Purchase,
  Notification,
} from '../src/models/index.js';

const KEEP_EMAILS = [
  'superadmin@kodingkeydzz.com',
  'admin@kodingkeydzz.com',
  'abhinallam@gmail.com',
];
const KEEP_ORG = 'Koding Keydzz Academy';
// Emails that are obviously test/verification accounts.
const TEST_EMAIL_RE = /@kk\.test$|@debug\.edu$|@riverside\.edu$|@sunrise|@greenwood|corsprobe/i;

async function run() {
  await connectDB();

  // 1) Test organizations = every org except the default academy.
  const testOrgs = await Organization.find({ name: { $ne: KEEP_ORG } });
  const testOrgIds = testOrgs.map((o) => o._id);

  // 2) Test users = matching test emails OR belonging to a test org — never the keep-list.
  const testUsers = await User.find({
    email: { $nin: KEEP_EMAILS },
    $or: [{ email: TEST_EMAIL_RE }, { org: { $in: testOrgIds } }],
  }).select('_id email');
  const testUserIds = testUsers.map((u) => u._id);

  console.log('Will remove:');
  console.log('  orgs :', testOrgs.map((o) => o.name).join(', ') || '(none)');
  console.log('  users:', testUsers.map((u) => u.email).join(', ') || '(none)');

  // 3) Cascade delete dependent docs for those users.
  const gs = await GameScore.deleteMany({ user: { $in: testUserIds } });
  const qa = await QuizAttempt.deleteMany({ user: { $in: testUserIds } });
  const pu = await Purchase.deleteMany({ user: { $in: testUserIds } });
  const nо = await Notification.deleteMany({ user: { $in: testUserIds } });
  const du = await User.deleteMany({ _id: { $in: testUserIds } });
  const do_ = await Organization.deleteMany({ _id: { $in: testOrgIds } });

  console.log('Deleted:', {
    users: du.deletedCount,
    orgs: do_.deletedCount,
    gameScores: gs.deletedCount,
    quizAttempts: qa.deletedCount,
    purchases: pu.deletedCount,
    notifications: nо.deletedCount,
  });

  // 4) Recompute studentCount on the default org.
  const academy = await Organization.findOne({ name: KEEP_ORG });
  if (academy) {
    const count = await User.countDocuments({ org: academy._id, role: 'student' });
    academy.studentCount = count;
    await academy.save();
    console.log(`Default org "${KEEP_ORG}" studentCount = ${count}`);
  }

  const remaining = await User.countDocuments();
  const remainingStudents = await User.countDocuments({ role: 'student' });
  console.log(`Remaining users: ${remaining} (students: ${remainingStudents})`);

  await disconnectDB();
  await mongoose.connection.close().catch(() => {});
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('cleanup failed:', e.message);
    process.exit(1);
  });
