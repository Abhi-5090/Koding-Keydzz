/**
 * SENDING MAIL — the thing this platform could not do at all.
 *
 * There was no mail infrastructure of any kind: no credential delivery, no
 * password reset, no digests. A temporary password reached a new teacher only
 * by being read off a screen, and a member of staff who forgot theirs had to
 * find an administrator.
 *
 * TWO KEYS, MATCHING HOW EVERYTHING ELSE THAT LEAVES THIS MACHINE IS GATED
 * ------------------------------------------------------------------------
 * Code execution and external task grading both require an operator to opt in
 * AND a call site to ask. Mail is the same shape of risk — it leaves the
 * building, it reaches real children's guardians, and a misconfiguration sends
 * real messages to real addresses from a staging box. So:
 *
 *   MAIL_TRANSPORT=none   (default) nothing is sent. Every call returns
 *                         `{ sent: false, reason: 'transport-disabled' }` and
 *                         callers must cope — which they are written to do,
 *                         because the product worked without mail before and
 *                         must keep working without it.
 *   MAIL_TRANSPORT=log    the message is written to the log instead of sent.
 *                         This is what a developer wants: the reset link is
 *                         right there in the console, and nothing can escape.
 *   MAIL_TRANSPORT=smtp   really sent, via SMTP_* settings.
 *
 * `config()` reads `process.env` AT CALL TIME rather than at import. The same
 * decision as externalValidator: a value captured at import cannot be changed
 * by a test, and a service whose behaviour cannot be exercised in a test is a
 * service whose behaviour is unknown.
 */

const TRANSPORTS = ['none', 'log', 'smtp'];

export function config() {
  const raw = String(process.env.MAIL_TRANSPORT || 'none').toLowerCase().trim();
  const transport = TRANSPORTS.includes(raw) ? raw : 'none';

  return {
    transport,
    from: process.env.MAIL_FROM || 'Koding Keydzz <no-reply@kodingkeydzz.local>',
    // Where links in emails point. Without it a reset link is unusable, so a
    // missing value is treated as "not configured" rather than guessed at.
    appUrl: (process.env.APP_URL || '').replace(/\/+$/, ''),
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  };
}

/** Is mail actually usable right now? Used to decide what to tell a user. */
export function mailEnabled() {
  const c = config();
  if (c.transport === 'none') return false;
  if (c.transport === 'log') return true;
  return Boolean(c.smtp.host && c.from);
}

/**
 * Cached SMTP transport.
 *
 * Rebuilt when the configuration changes, so a test can switch transports
 * without a stale connection pool answering for the old one.
 */
let cached = { key: null, transporter: null };

async function smtpTransporter(c) {
  const key = JSON.stringify(c.smtp);
  if (cached.key === key && cached.transporter) return cached.transporter;

  const nodemailer = (await import('nodemailer')).default;
  const transporter = nodemailer.createTransport({
    host: c.smtp.host,
    port: c.smtp.port,
    secure: c.smtp.secure,
    ...(c.smtp.user ? { auth: { user: c.smtp.user, pass: c.smtp.pass } } : {}),
  });

  cached = { key, transporter };
  return transporter;
}

/**
 * Send one message.
 *
 * NEVER THROWS. A failed send must not fail the operation that triggered it:
 * a password reset that 500s because the mail server is down tells an attacker
 * the address exists, and a certificate that fails to issue because a
 * notification bounced would be absurd. Callers get `{ sent, reason }` and
 * decide.
 */
export async function sendMail({ to, subject, text, html }) {
  const c = config();

  if (!to || !subject) {
    return { sent: false, reason: 'missing-recipient-or-subject' };
  }

  if (c.transport === 'none') {
    return { sent: false, reason: 'transport-disabled' };
  }

  if (c.transport === 'log') {
    /**
     * The body IS logged here, deliberately — including any reset link. That
     * is the entire purpose of this transport, and it is why it must never be
     * the production default. `mailEnabled()` reports true so the calling flow
     * behaves exactly as it will in production.
     */
    // eslint-disable-next-line no-console
    console.log(
      `[mail:log] to=${to} subject="${subject}"\n${text || html || '(no body)'}`
    );
    return { sent: true, reason: 'logged' };
  }

  if (!c.smtp.host) {
    // eslint-disable-next-line no-console
    console.warn('[mail] MAIL_TRANSPORT=smtp but SMTP_HOST is not set — not sending');
    return { sent: false, reason: 'smtp-not-configured' };
  }

  try {
    const transporter = await smtpTransporter(c);
    const info = await transporter.sendMail({
      from: c.from,
      to,
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
    });
    return { sent: true, reason: 'smtp', id: info?.messageId || null };
  } catch (err) {
    // Logged, not thrown. See the note above.
    // eslint-disable-next-line no-console
    console.error(`[mail] send failed to=${to}: ${err.message}`);
    return { sent: false, reason: 'smtp-error' };
  }
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The password-reset message.
 *
 * Plain text as well as HTML: school mail systems strip HTML often enough that
 * a text-only fallback is the difference between a usable link and a blank
 * message. The link is spelled out in the text part for the same reason.
 */
export function passwordResetMessage({ name, resetUrl, expiresMinutes }) {
  const greeting = name ? `Hello ${name},` : 'Hello,';
  const text = [
    greeting,
    '',
    'Someone asked to reset the password for your Koding Keydzz account.',
    '',
    'Open this link to choose a new one:',
    resetUrl,
    '',
    `The link works once and expires in ${expiresMinutes} minutes.`,
    '',
    'If this was not you, you can ignore this message — nothing has changed,',
    'and your current password still works.',
    '',
    'Koding Keydzz',
  ].join('\n');

  const html = `
    <p>${greeting}</p>
    <p>Someone asked to reset the password for your Koding Keydzz account.</p>
    <p><a href="${resetUrl}">Choose a new password</a></p>
    <p>Or paste this into your browser:<br><code>${resetUrl}</code></p>
    <p>The link works once and expires in ${expiresMinutes} minutes.</p>
    <p>If this was not you, you can ignore this message — nothing has changed,
       and your current password still works.</p>
    <p>Koding Keydzz</p>
  `.trim();

  return { subject: 'Reset your Koding Keydzz password', text, html };
}

/** Credentials for a newly created staff account. */
export function staffWelcomeMessage({ name, email, tempPassword, signInUrl }) {
  const text = [
    `Hello ${name || 'there'},`,
    '',
    'An account has been created for you on Koding Keydzz.',
    '',
    `Sign in at: ${signInUrl}`,
    `Email:      ${email}`,
    `Password:   ${tempPassword}`,
    '',
    'You will be asked to choose your own password the first time you sign in.',
    'Until you do, you cannot use the rest of the portal — so nobody else,',
    'including whoever created your account, will know your password afterwards.',
    '',
    'Koding Keydzz',
  ].join('\n');

  return { subject: 'Your Koding Keydzz account', text };
}

export default {
  config,
  mailEnabled,
  sendMail,
  passwordResetMessage,
  staffWelcomeMessage,
};
