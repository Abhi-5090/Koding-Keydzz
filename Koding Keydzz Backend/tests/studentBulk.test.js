import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  composeName,
  validateStudentRow,
  parseStudentRows,
  DEFAULT_STUDENT_PASSWORD,
} from '../src/services/studentBulkService.js';
import { slugify, generateOrgCode } from '../src/utils/orgUtils.js';

describe('studentBulkService pure helpers', () => {
  describe('normalizeEmail', () => {
    it('trims and lowercases', () => {
      expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
    });
    it('handles nullish', () => {
      expect(normalizeEmail(null)).toBe('');
      expect(normalizeEmail(undefined)).toBe('');
    });
  });

  describe('composeName', () => {
    it('joins first + last with a single space', () => {
      expect(composeName('Asha', 'Rao')).toBe('Asha Rao');
    });
    it('trims and drops a missing last name', () => {
      expect(composeName('  Asha  ', '')).toBe('Asha');
      expect(composeName('Liam', undefined)).toBe('Liam');
    });
  });

  describe('validateStudentRow', () => {
    it('accepts a valid row, composes name and normalizes the email', () => {
      const r = validateStudentRow({
        firstName: 'Asha',
        lastName: 'Rao',
        email: 'Asha@Example.com',
        phone: '9876543210',
        password: 'Secret@1',
      });
      expect(r.ok).toBe(true);
      expect(r.value.email).toBe('asha@example.com');
      expect(r.value.name).toBe('Asha Rao');
      expect(r.value.firstName).toBe('Asha');
      expect(r.value.lastName).toBe('Rao');
      expect(r.value.phone).toBe('9876543210');
      expect(r.value.password).toBe('Secret@1');
    });

    it('accepts spaced/cased header keys (first name / last name)', () => {
      const r = validateStudentRow({ 'first name': 'Liam', 'last name': 'Smith', email: 'l@b.com' });
      expect(r.ok).toBe(true);
      expect(r.value.name).toBe('Liam Smith');
    });

    it('allows a missing lastName/phone', () => {
      const r = validateStudentRow({ firstName: 'Asha', email: 'a@b.com' });
      expect(r.ok).toBe(true);
      expect(r.value.name).toBe('Asha');
      expect(r.value.lastName).toBe('');
      expect(r.value.phone).toBe('');
    });

    it('applies the default password when no common/row password', () => {
      const r = validateStudentRow({ firstName: 'Asha', email: 'a@b.com' });
      expect(r.ok).toBe(true);
      expect(r.value.password).toBe(DEFAULT_STUDENT_PASSWORD);
    });

    it('applies the common password when provided and the row has none', () => {
      const r = validateStudentRow({ firstName: 'Asha', email: 'a@b.com' }, 'Common@123');
      expect(r.value.password).toBe('Common@123');
    });

    it('lets a per-row password override the common password', () => {
      const r = validateStudentRow(
        { firstName: 'Asha', email: 'a@b.com', password: 'Row@123' },
        'Common@123'
      );
      expect(r.value.password).toBe('Row@123');
    });

    it('rejects a missing firstName', () => {
      const r = validateStudentRow({ email: 'a@b.com' });
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/firstname/i);
    });

    it('rejects a missing email', () => {
      const r = validateStudentRow({ firstName: 'Asha' });
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/missing email/i);
    });

    it('rejects an invalid email', () => {
      const r = validateStudentRow({ firstName: 'Asha', email: 'not-an-email' });
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/invalid email/i);
    });
  });

  describe('parseStudentRows', () => {
    it('separates valid rows from invalid/missing rows', () => {
      const { valid, skipped } = parseStudentRows([
        { firstName: 'A', email: 'a@x.com' },
        { firstName: '', email: 'b@x.com' }, // missing firstName
        { firstName: 'C', email: '' }, // missing email
        { firstName: 'D', email: 'bad-email' }, // invalid
      ]);
      expect(valid).toHaveLength(1);
      expect(valid[0].email).toBe('a@x.com');
      expect(skipped).toHaveLength(3);
      expect(skipped.map((s) => s.row)).toEqual([2, 3, 4]);
    });

    it('detects in-file duplicate emails (case-insensitive)', () => {
      const { valid, skipped } = parseStudentRows([
        { firstName: 'A', email: 'dup@x.com' },
        { firstName: 'B', email: 'DUP@x.com' },
      ]);
      expect(valid).toHaveLength(1);
      expect(skipped).toHaveLength(1);
      expect(skipped[0].reason).toMatch(/duplicate in file/i);
      expect(skipped[0].row).toBe(2);
    });

    it('applies the default password to valid rows without one', () => {
      const { valid } = parseStudentRows([{ firstName: 'A', email: 'a@x.com' }]);
      expect(valid[0].password).toBe(DEFAULT_STUDENT_PASSWORD);
    });

    it('applies a common password to every row that lacks its own', () => {
      const { valid } = parseStudentRows(
        [
          { firstName: 'A', email: 'a@x.com' },
          { firstName: 'B', email: 'b@x.com', password: 'Own@123' },
        ],
        'Common@123'
      );
      expect(valid[0].password).toBe('Common@123');
      expect(valid[1].password).toBe('Own@123'); // per-row override wins
    });

    it('composes name from first + last', () => {
      const { valid } = parseStudentRows([
        { firstName: 'Asha', lastName: 'Rao', email: 'a@x.com' },
      ]);
      expect(valid[0].name).toBe('Asha Rao');
    });
  });
});

describe('orgUtils', () => {
  describe('slugify', () => {
    it('lowercases and hyphenates', () => {
      expect(slugify('Koding Keydzz Academy')).toBe('koding-keydzz-academy');
    });
    it('strips punctuation and collapses separators', () => {
      expect(slugify('  Acme,  Inc.! ')).toBe('acme-inc');
    });
    it('handles empty input', () => {
      expect(slugify('')).toBe('');
      expect(slugify(null)).toBe('');
    });
  });

  describe('generateOrgCode', () => {
    it('produces an uppercase code of the requested length', () => {
      const code = generateOrgCode('Koding Keydzz Academy');
      expect(code).toHaveLength(6);
      expect(code).toBe(code.toUpperCase());
      expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
    });

    it('seeds from the name alphanumerics', () => {
      const code = generateOrgCode('Acme', 6);
      expect(code.startsWith('ACME')).toBe(true);
      expect(code).toHaveLength(6);
    });

    it('pads short names to the full length', () => {
      const code = generateOrgCode('Ab', 6);
      expect(code).toHaveLength(6);
      expect(code.startsWith('AB')).toBe(true);
    });

    it('respects a custom length', () => {
      expect(generateOrgCode('Hello World Org', 8)).toHaveLength(8);
    });
  });
});
