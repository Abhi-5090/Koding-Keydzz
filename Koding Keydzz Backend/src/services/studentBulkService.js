import xlsx from 'xlsx';
import { userRepository } from '../repositories/userRepository.js';
import { orgRepository } from '../repositories/orgRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { uniqueUsername } from '../utils/username.js';

export const DEFAULT_STUDENT_PASSWORD = 'Keydzz@123';

/**
 * Hard cap on rows per upload.
 *
 * Each row costs a bcrypt hash (~70ms measured), so an uncapped file could run
 * for hours and hold the request open. 2,000 rows ≈ 2–3 minutes, which fits
 * inside the proxy's 600s read timeout with a wide margin. Larger schools
 * should split the roster by class/grade — the import is idempotent, so
 * uploading several files (or re-uploading one) is safe.
 */
export const MAX_BULK_ROWS = 2000;

/**
 * Refuse to exceed the organization's contracted student seats.
 *
 * `seatLimit` of 0 means unlimited. Checked before creating accounts so a
 * school cannot silently drift past what it is paying for, and the message
 * tells the admin exactly how many seats are left.
 */
async function assertSeatsAvailable(orgId, wanted = 1) {
  const org = await orgRepository.findById(orgId);
  if (!org || !org.seatLimit) return; // unlimited
  const current = await userRepository.count({
    role: 'student',
    org: orgId,
    deletedAt: null,
  });
  const remaining = org.seatLimit - current;
  if (wanted > remaining) {
    throw ApiError.badRequest(
      remaining <= 0
        ? `This organization has used all ${org.seatLimit} of its student seats. Contact Koding Keydzz to add more.`
        : `Only ${remaining} student seat${remaining === 1 ? '' : 's'} remain (limit ${org.seatLimit}). This upload needs ${wanted}.`
    );
  }
}

const TEMPLATE_HEADERS = [
  'rollNumber',
  'firstName',
  'lastName',
  'email',
  'phone',
  'username',
];

/** Normalize a supplied username: trim + lowercase. Returns '' for nullish. */
export function normalizeUsername(username) {
  return String(username == null ? '' : username).trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalize an email for comparison: trim + lowercase. Returns '' for nullish.
 */
export function normalizeEmail(email) {
  return String(email == null ? '' : email).trim().toLowerCase();
}

/**
 * Build a display name from first + last (trimmed, single-spaced).
 */
export function composeName(firstName = '', lastName = '') {
  return `${String(firstName).trim()} ${String(lastName).trim()}`.trim();
}

/**
 * Normalize a row's keys to lowercase + single-spaced so header lookups are
 * tolerant of casing/spacing (e.g. "First Name", "FIRSTNAME", "firstName").
 */
function normalizeRowKeys(row = {}) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[String(key).trim().toLowerCase().replace(/\s+/g, ' ')] = value;
  }
  return out;
}

/**
 * Pick a value off a key-normalized row tolerant of header casing/spacing.
 * Candidate keys must be lowercase + space-collapsed.
 */
function pick(row, candidates) {
  for (const key of candidates) {
    if (row[key] != null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }
  return '';
}

/**
 * Validate a single raw student row. The row keys are expected to already be
 * normalized to lowercase (see parseWorkbookBuffer), but this helper also
 * tolerates extra spaces in header names (e.g. "first name").
 *
 * Optionally accepts a `commonPassword` applied to rows that lack their own.
 * Returns
 * { ok: true, value: { firstName, lastName, name, email, phone, username, password } }
 * or { ok: false, reason }.
 *
 * Only `firstName` is required. `email` is OPTIONAL (young students may have
 * none); when present it must be well-formed. `username` is OPTIONAL — when
 * blank the create step auto-generates a unique one.
 */
export function validateStudentRow(rawRow = {}, commonPassword = '') {
  const row = normalizeRowKeys(rawRow);
  // The school's own pupil id. Optional, but it is the most reliable natural
  // key for making a re-import idempotent, so we accept several spellings.
  const rollNumber = pick(row, [
    'rollnumber',
    'roll number',
    'roll no',
    'rollno',
    'roll',
    'admissionnumber',
    'admission number',
    'admission no',
    'studentid',
    'student id',
  ]);
  const firstName = pick(row, ['firstname', 'first name']);
  const lastName = pick(row, ['lastname', 'last name']);
  const email = normalizeEmail(pick(row, ['email']));
  const phone = pick(row, ['phone', 'phone number']);
  const username = normalizeUsername(pick(row, ['username', 'user name', 'login']));
  const rawPassword = pick(row, ['password']);

  if (!firstName) return { ok: false, reason: 'Missing firstName' };
  if (email && !EMAIL_RE.test(email)) return { ok: false, reason: 'Invalid email' };

  // Per-row password wins, else the batch common password, else the default.
  const password = rawPassword || commonPassword || DEFAULT_STUDENT_PASSWORD;
  const name = composeName(firstName, lastName);
  return {
    ok: true,
    value: { rollNumber, firstName, lastName, name, email, phone, username, password },
  };
}

/**
 * Pure parse of raw rows (already plain objects keyed by header). Splits into
 * valid + skipped, detecting in-file duplicates by email (when present) AND by
 * username (when present). Does NOT touch the DB. Each `valid` entry carries the
 * row index (1-based, header-excluded).
 *
 * `commonPassword` is applied to every valid row that lacks its own password.
 */
export function parseStudentRows(rows = [], commonPassword = '') {
  const valid = [];
  const skipped = [];
  const seenEmail = new Set();
  const seenUsername = new Set();
  const seenRoll = new Set();

  rows.forEach((row, idx) => {
    const rowNumber = idx + 1;
    const result = validateStudentRow(row, commonPassword);
    if (!result.ok) {
      skipped.push({ row: rowNumber, email: normalizeEmail(row.email), reason: result.reason });
      return;
    }
    const { email, username, rollNumber } = result.value;
    const rollKey = rollNumber ? rollNumber.toLowerCase() : '';
    if (rollKey && seenRoll.has(rollKey)) {
      skipped.push({ row: rowNumber, rollNumber, reason: 'Duplicate roll number in file' });
      return;
    }
    if (email && seenEmail.has(email)) {
      skipped.push({ row: rowNumber, email, reason: 'Duplicate in file' });
      return;
    }
    if (username && seenUsername.has(username)) {
      skipped.push({ row: rowNumber, email, username, reason: 'Duplicate username in file' });
      return;
    }
    if (rollKey) seenRoll.add(rollKey);
    if (email) seenEmail.add(email);
    if (username) seenUsername.add(username);
    valid.push({ row: rowNumber, ...result.value });
  });

  return { valid, skipped };
}

/**
 * Parse an uploaded spreadsheet buffer into raw row objects keyed by the
 * template headers (case-insensitive, space-tolerant). Supports .xlsx/.xls/.csv.
 */
export function parseWorkbookBuffer(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
  // Normalize header keys to lowercase + single-spaced so "First Name"/"FIRSTNAME"
  // map onto our fields.
  return rows.map((r) => {
    const out = {};
    for (const [key, value] of Object.entries(r)) {
      const norm = String(key).trim().toLowerCase().replace(/\s+/g, ' ');
      out[norm] = value;
    }
    return out;
  });
}

/**
 * Build an .xlsx template workbook buffer with headers + example rows.
 * Columns: firstName, lastName, email, phone, username. Only firstName is
 * required; email and username are OPTIONAL (a unique username is generated when
 * left blank). Password is supplied in the UI, not the sheet, so it is omitted
 * here (the parser still HONORS a password column if a power user adds one).
 */
export function buildTemplateBuffer() {
  const example = [
    {
      // First example: has an email, username left BLANK -> auto-generated.
      rollNumber: '2024-001',
      firstName: 'Asha',
      lastName: 'Rao',
      email: 'asha.rao@example.com',
      phone: '9876543210',
      username: '',
    },
    {
      // Second example: NO email (young student), explicit username supplied.
      rollNumber: '2024-002',
      firstName: 'Liam',
      lastName: 'Smith',
      email: '',
      phone: '9123456780',
      username: 'liam2015',
    },
  ];
  const sheet = xlsx.utils.json_to_sheet(example, { header: TEMPLATE_HEADERS });
  // Human-readable note placed in a far cell so it is visible in the sheet but
  // ignored by the parser (only known header columns are read).
  xlsx.utils.sheet_add_aoa(
    sheet,
    [
      [
        'Only firstName is required. email and username are OPTIONAL — leave username blank to auto-generate a unique login id.',
      ],
      [
        'rollNumber is your school\'s own pupil id. Strongly recommended: it lets you re-upload this file safely, because students that already exist are skipped instead of being added a second time.',
      ],
    ],
    { origin: 'H1' }
  );
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, sheet, 'Students');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Bulk-create students from an uploaded buffer, scoped to a single org. A single
 * `commonPassword` is applied to every row that lacks its own password value.
 * Returns { createdCount, skippedCount, created[], skipped[] }.
 */
export async function bulkCreateStudents(buffer, { org, commonPassword = '' } = {}) {
  if (!buffer || !buffer.length) {
    throw ApiError.badRequest('No file provided (field name: "file")');
  }
  const rawRows = parseWorkbookBuffer(buffer);
  if (!rawRows.length) {
    throw ApiError.badRequest('The uploaded file has no data rows');
  }
  if (rawRows.length > MAX_BULK_ROWS) {
    throw ApiError.badRequest(
      `This file has ${rawRows.length} rows, which is over the ${MAX_BULK_ROWS}-row limit. ` +
        'Split the roster into smaller files (by class or grade) and upload them one at a ' +
        'time — re-uploading is safe, existing students are skipped rather than duplicated.'
    );
  }

  const { valid, skipped } = parseStudentRows(rawRows, commonPassword);

  // Check seats BEFORE creating anything, so a capped org gets a clear refusal
  // rather than a half-imported roster.
  await assertSeatsAvailable(org, valid.length);

  const created = [];
  let createdCount = 0;

  // Usernames already assigned in THIS batch — combined with the DB check so the
  // generator never hands out the same login id twice within one upload.
  const takenUsernames = new Set();
  const isUsernameTaken = async (candidate) =>
    takenUsernames.has(candidate) || userRepository.existsByUsername(candidate);

  // Natural keys already seen in THIS file, so a roster that repeats a pupil
  // internally doesn't create two records either.
  const seenRolls = new Set();
  const seenNames = new Set();

  for (const entry of valid) {
    /* ---------------------------------------------------------------------
     * IDEMPOTENCY.
     *
     * Duplicate detection previously keyed on email ONLY. Young students have
     * no email — that is the whole reason username login exists — so a
     * re-uploaded roster skipped nothing and created a second copy of every
     * child. (Observed: a 200-pupil school went to 401 students on one retry,
     * which is exactly what happens when an import times out and the admin
     * clicks upload again.)
     *
     * We now check three keys in order of authority:
     *   1. rollNumber — the school's own id, when the sheet provides it
     *   2. email      — when present
     *   3. firstName + lastName within the org — last resort
     * ------------------------------------------------------------------- */
    const rollKey = entry.rollNumber ? entry.rollNumber.toLowerCase() : '';
    const nameKey = `${(entry.firstName || '').toLowerCase()}|${(entry.lastName || '').toLowerCase()}`;

    if (rollKey) {
      if (seenRolls.has(rollKey)) {
        skipped.push({
          row: entry.row,
          rollNumber: entry.rollNumber,
          reason: 'Duplicate roll number within this file',
        });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const byRoll = await userRepository.findStudentInOrgByRollNumber(entry.rollNumber, org);
      if (byRoll) {
        skipped.push({
          row: entry.row,
          rollNumber: entry.rollNumber,
          reason: 'Already exists in organization (roll number)',
        });
        continue;
      }
    }

    if (entry.email) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await userRepository.findStudentInOrg(entry.email, org);
      if (existing) {
        skipped.push({ row: entry.row, email: entry.email, reason: 'Already exists in organization' });
        continue;
      }
    }

    // Name fallback: only when the row gives us nothing more reliable.
    if (!rollKey && !entry.email) {
      if (seenNames.has(nameKey)) {
        skipped.push({
          row: entry.row,
          name: entry.name,
          reason: 'Duplicate name within this file — add a rollNumber column to import both',
        });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const byName = await userRepository.findStudentInOrgByName(
        entry.firstName,
        entry.lastName,
        org
      );
      if (byName) {
        skipped.push({
          row: entry.row,
          name: entry.name,
          reason:
            'Already exists in organization (name match) — add a rollNumber column if this is a different pupil',
        });
        continue;
      }
    }

    // Resolve the login username: honor an explicit one (must be free), else
    // auto-generate a unique one from the first name.
    let username = entry.username;
    if (username) {
      // eslint-disable-next-line no-await-in-loop
      if (await isUsernameTaken(username)) {
        skipped.push({ row: entry.row, email: entry.email, username, reason: 'Username already in use' });
        continue;
      }
    } else {
      // eslint-disable-next-line no-await-in-loop
      username = await uniqueUsername(entry.firstName || entry.name, isUsernameTaken);
    }
    takenUsernames.add(username);
    if (rollKey) seenRolls.add(rollKey);
    if (!rollKey && !entry.email) seenNames.add(nameKey);

    try {
      const student = new userRepository.model({
        role: 'student',
        name: entry.name,
        firstName: entry.firstName,
        lastName: entry.lastName,
        phone: entry.phone,
        username,
        // Only set when supplied, so the partial unique index ignores the
        // (many) students who have no roll number.
        ...(entry.rollNumber ? { rollNumber: entry.rollNumber } : {}),
        // Only set email when present so the sparse unique index isn't tripped
        // by many email-less students sharing an empty value.
        ...(entry.email ? { email: entry.email } : {}),
        org,
      });
      // eslint-disable-next-line no-await-in-loop
      await student.setPassword(entry.password);
      // eslint-disable-next-line no-await-in-loop
      await student.save();
      created.push({
        name: entry.name,
        username,
        rollNumber: entry.rollNumber || '',
        email: entry.email || '',
        phone: entry.phone,
        password: entry.password,
      });
      createdCount += 1;
    } catch (err) {
      // Unique-index race or global email/username collision.
      const reason = err.code === 11000 ? 'Email or username already in use' : 'Failed to create';
      // Free the just-reserved keys so a later row can retry.
      takenUsernames.delete(username);
      if (rollKey) seenRolls.delete(rollKey);
      if (!rollKey && !entry.email) seenNames.delete(nameKey);
      skipped.push({ row: entry.row, email: entry.email, username, reason });
    }
  }

  if (createdCount > 0) {
    await orgRepository.incStudentCount(org, createdCount);
  }

  return {
    createdCount,
    skippedCount: skipped.length,
    created,
    skipped,
  };
}

/**
 * Create a single student in the given org. `email` is OPTIONAL; `username` is
 * OPTIONAL and auto-generated from the first name when omitted.
 * Returns { student, username, password }.
 */
export async function createStudent(
  {
    firstName,
    lastName = '',
    phone = '',
    grade,
    school,
    email,
    username,
    password,
    rollNumber,
  },
  orgId
) {
  await assertSeatsAvailable(orgId, 1);

  const roll = String(rollNumber || '').trim();
  if (roll) {
    const rollClash = await userRepository.findStudentInOrgByRollNumber(roll, orgId);
    if (rollClash) {
      throw ApiError.conflict('A student with this roll number already exists in your organization');
    }
  }

  const normalized = normalizeEmail(email);
  if (normalized) {
    const existing = await userRepository.findStudentInOrg(normalized, orgId);
    if (existing) {
      throw ApiError.conflict('A student with this email already exists in your organization');
    }
    const globalClash = await userRepository.findByEmail(normalized);
    if (globalClash) {
      throw ApiError.conflict('An account with this email already exists');
    }
  }

  // Resolve the login username: honor an explicit one (must be free) else
  // auto-generate a unique one from the first name.
  let finalUsername = normalizeUsername(username);
  if (finalUsername) {
    if (await userRepository.existsByUsername(finalUsername)) {
      throw ApiError.conflict('This username is already taken');
    }
  } else {
    finalUsername = await uniqueUsername(firstName || 'student', (candidate) =>
      userRepository.existsByUsername(candidate)
    );
  }

  const finalPassword = password || DEFAULT_STUDENT_PASSWORD;
  const student = new userRepository.model({
    role: 'student',
    name: composeName(firstName, lastName),
    firstName: String(firstName || '').trim(),
    lastName: String(lastName || '').trim(),
    phone: String(phone || '').trim(),
    grade: String(grade || '').trim(),
    school: String(school || '').trim(),
    username: finalUsername,
    // Only set email when present (keeps the sparse unique index happy).
    ...(normalized ? { email: normalized } : {}),
    // Same for the roll number's partial unique index.
    ...(roll ? { rollNumber: roll } : {}),
    org: orgId,
  });
  await student.setPassword(finalPassword);
  await student.save();

  await orgRepository.incStudentCount(orgId, 1);

  return {
    student: student.toSafeJSON(),
    username: finalUsername,
    password: finalPassword,
  };
}

export default {
  DEFAULT_STUDENT_PASSWORD,
  normalizeEmail,
  normalizeUsername,
  composeName,
  validateStudentRow,
  parseStudentRows,
  parseWorkbookBuffer,
  buildTemplateBuffer,
  bulkCreateStudents,
  createStudent,
};
