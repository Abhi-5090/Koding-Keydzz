/**
 * Superadmin account recovery.
 *
 * WHY THIS EXISTS
 * ---------------
 * Password recovery in this platform is hierarchical: a student is reset by
 * their teacher, a teacher by the superadmin — and the superadmin by nobody.
 * There is no self-service reset flow and no mail provider, so a locked-out
 * superadmin previously meant hand-editing the database under pressure.
 *
 * This is the documented, safe way to do it.
 *
 * USAGE
 *   # list the privileged accounts
 *   node scripts/recover-superadmin.mjs --list
 *
 *   # reset a superadmin's password (prints the new one once)
 *   node scripts/recover-superadmin.mjs --email you@example.com --password 'NewStrongPass123'
 *
 *   # generate a strong password instead of choosing one
 *   node scripts/recover-superadmin.mjs --email you@example.com --generate
 *
 *   # clear a brute-force lockout without changing the password
 *   node scripts/recover-superadmin.mjs --email you@example.com --unlock
 *
 *   # promote an existing admin to superadmin (last resort: no superadmin left)
 *   node scripts/recover-superadmin.mjs --email head@school.test --promote
 *
 * Every password change also revokes all of that account's sessions.
 */
import { randomBytes } from 'node:crypto';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};

const MIN_LEN = 10;

function strongPassword() {
  // base64url of 18 random bytes: ~24 chars, no ambiguous punctuation.
  return randomBytes(18).toString('base64url');
}

function usage(msg) {
  if (msg) console.error(`\n${msg}`);
  console.error(`
Superadmin recovery

  --list                       Show all admin / superadmin accounts
  --email <email>              Target account (required for the actions below)
  --password <newPassword>     Set this password (min ${MIN_LEN} chars)
  --generate                   Set a strong generated password
  --unlock                     Clear the brute-force lockout only
  --promote                    Make this account a superadmin
`);
  process.exit(msg ? 1 : 0);
}

if (has('--help') || args.length === 0) usage();

await connectDB();

try {
  if (has('--list')) {
    const users = await User.find({ role: { $in: ['admin', 'superadmin'] } })
      .select('email role org status failedLoginAttempts lockUntil name')
      .sort({ role: 1, email: 1 });

    if (!users.length) {
      console.log('No admin or superadmin accounts exist.');
    } else {
      console.log(`\n${users.length} privileged account(s):\n`);
      for (const u of users) {
        const locked = u.lockUntil && u.lockUntil > new Date() ? ' LOCKED' : '';
        console.log(
          `  ${String(u.role).padEnd(10)} ${String(u.email || '(no email)').padEnd(36)} ` +
            `${u.status}${locked}${u.org ? '' : '  (no org)'}`
        );
      }
      console.log('');
    }
    await disconnectDB();
    process.exit(0);
  }

  const email = valueOf('--email');
  if (!email) usage('--email is required.');

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) usage(`No account found for ${email}. Use --list to see what exists.`);

  let changed = [];

  if (has('--promote')) {
    user.role = 'superadmin';
    user.org = null;
    changed.push('promoted to superadmin (org cleared)');
  }

  if (has('--unlock')) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    changed.push('lockout cleared');
  }

  let newPassword = null;
  if (has('--generate')) {
    newPassword = strongPassword();
  } else if (valueOf('--password')) {
    newPassword = valueOf('--password');
    if (newPassword.length < MIN_LEN) {
      usage(`Password must be at least ${MIN_LEN} characters (got ${newPassword.length}).`);
    }
  }

  if (newPassword) {
    await user.setPassword(newPassword);
    // A password change signs out every device for that account.
    user.sessions = [];
    user.refreshTokenHash = null;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    changed.push('password reset (all sessions revoked)');
  }

  if (!changed.length) {
    usage('Nothing to do. Pass --password, --generate, --unlock or --promote.');
  }

  await user.save();

  console.log(`\nAccount: ${user.email}  (role: ${user.role}, status: ${user.status})`);
  for (const c of changed) console.log(`  • ${c}`);
  if (newPassword) {
    console.log(`\n  NEW PASSWORD: ${newPassword}`);
    console.log('  Shown once — store it in your password manager now.\n');
  } else {
    console.log('');
  }
} finally {
  await disconnectDB();
}

process.exit(0);
