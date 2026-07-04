import { describe, it, expect } from 'vitest';
import { escapeCsvValue, buildCsv } from '../src/utils/csv.js';
import { generatePassword } from '../src/services/adminService.js';

describe('csv helpers', () => {
  describe('escapeCsvValue', () => {
    it('passes plain values through unchanged', () => {
      expect(escapeCsvValue('hello')).toBe('hello');
      expect(escapeCsvValue(42)).toBe('42');
    });

    it('renders nullish as empty string', () => {
      expect(escapeCsvValue(null)).toBe('');
      expect(escapeCsvValue(undefined)).toBe('');
    });

    it('quotes values containing a comma', () => {
      expect(escapeCsvValue('Doe, John')).toBe('"Doe, John"');
    });

    it('quotes and doubles embedded double quotes', () => {
      expect(escapeCsvValue('She said "hi"')).toBe('"She said ""hi"""');
    });

    it('quotes values containing newlines', () => {
      expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
      expect(escapeCsvValue('a\r\nb')).toBe('"a\r\nb"');
    });
  });

  describe('buildCsv', () => {
    it('builds a header plus rows joined with CRLF', () => {
      const csv = buildCsv(['name', 'email'], [
        ['Asha', 'asha@example.com'],
        ['Liam', 'liam@example.com'],
      ]);
      expect(csv).toBe(
        'name,email\r\nAsha,asha@example.com\r\nLiam,liam@example.com'
      );
    });

    it('escapes commas, quotes and newlines inside cells', () => {
      const csv = buildCsv(['name', 'note'], [
        ['Doe, John', 'said "hi"'],
        ['Multi', 'a\nb'],
      ]);
      expect(csv).toBe(
        'name,note\r\n"Doe, John","said ""hi"""\r\nMulti,"a\nb"'
      );
    });

    it('handles an empty row set (header only)', () => {
      expect(buildCsv(['name', 'email'], [])).toBe('name,email');
    });
  });
});

describe('generatePassword', () => {
  it('returns a non-empty string of at least 6 characters', () => {
    for (let i = 0; i < 50; i += 1) {
      const pw = generatePassword();
      expect(typeof pw).toBe('string');
      expect(pw.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('produces a Word+digits style value', () => {
    const pw = generatePassword();
    expect(/^[A-Z][a-z]+\d{4}$/.test(pw)).toBe(true);
  });
});
