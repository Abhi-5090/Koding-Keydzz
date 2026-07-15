import xlsx from 'xlsx';
import { userRepository } from '../repositories/userRepository.js';
import { orgRepository } from '../repositories/orgRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { slugifyName, uniqueUsername } from '../utils/username.js';

export const DEFAULT_STUDENT_PASSWORD = 'Keydzz@123';

const TEMPLATE_HEADERS = ['firstName', 'lastName', 'email', 'phone', 'username'];

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
  return { ok: true, value: { firstName, lastName, name, email, phone, username, password } };
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

  rows.forEach((row, idx) => {
    const rowNumber = idx + 1;
    const result = validateStudentRow(row, commonPassword);
    if (!result.ok) {
      skipped.push({ row: rowNumber, email: normalizeEmail(row.email), reason: result.reason });
      return;
    }
    const { email, username } = result.value;
    if (email && seenEmail.has(email)) {
      skipped.push({ row: rowNumber, email, reason: 'Duplicate in file' });
      return;
    }
    if (username && seenUsername.has(username)) {
      skipped.push({ row: rowNumber, email, username, reason: 'Duplicate username in file' });
      return;
    }
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
      firstName: 'Asha',
      lastName: 'Rao',
      email: 'asha.rao@example.com',
      phone: '9876543210',
      username: '',
    },
    {
      // Second example: NO email (young student), explicit username supplied.
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
    [['Note: email and username are OPTIONAL. Leave username blank to auto-generate a unique login id. firstName is required.']],
    { origin: 'F1' }
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

  const { valid, skipped } = parseStudentRows(rawRows, commonPassword);

  const created = [];
  let createdCount = 0;

  // Usernames already assigned in THIS batch — combined with the DB check so the
  // generator never hands out the same login id twice within one upload.
  const takenUsernames = new Set();
  const isUsernameTaken = async (candidate) =>
    takenUsernames.has(candidate) || userRepository.existsByUsername(candidate);

  for (const entry of valid) {
    // Duplicate within this org (existing student, by email) → skip.
    if (entry.email) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await userRepository.findStudentInOrg(entry.email, org);
      if (existing) {
        skipped.push({ row: entry.row, email: entry.email, reason: 'Already exists in organization' });
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

    try {
      const student = new userRepository.model({
        role: 'student',
        name: entry.name,
        firstName: entry.firstName,
        lastName: entry.lastName,
        phone: entry.phone,
        username,
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
        email: entry.email || '',
        phone: entry.phone,
        password: entry.password,
      });
      createdCount += 1;
    } catch (err) {
      // Unique-index race or global email/username collision.
      const reason = err.code === 11000 ? 'Email or username already in use' : 'Failed to create';
      // Free the just-reserved username so it can be retried by a later row.
      takenUsernames.delete(username);
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
  { firstName, lastName = '', phone = '', email, username, password },
  orgId
) {
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
    username: finalUsername,
    // Only set email when present (keeps the sparse unique index happy).
    ...(normalized ? { email: normalized } : {}),
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
