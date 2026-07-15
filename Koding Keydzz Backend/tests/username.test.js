import { describe, it, expect } from 'vitest';
import {
  slugifyName,
  usernameCandidate,
  uniqueUsername,
  normalizeIdentifier,
  buildLoginFilter,
} from '../src/utils/username.js';

describe('username helpers', () => {
  describe('slugifyName', () => {
    it('lowercases and strips non-alphanumerics', () => {
      expect(slugifyName('Asha Rao')).toBe('asharao');
      expect(slugifyName("O'Brien-Smith")).toBe('obriensmith');
      expect(slugifyName('José 123')).toBe('jos123');
    });

    it('caps the length (~12 chars)', () => {
      // 'bartholomewlongname' -> capped to the first 12 chars.
      expect(slugifyName('Bartholomew Longname')).toBe('bartholomewl');
      expect(slugifyName('Bartholomew Longname').length).toBeLessThanOrEqual(12);
    });

    it('falls back to "student" when nothing usable remains', () => {
      expect(slugifyName('')).toBe('student');
      expect(slugifyName(null)).toBe('student');
      expect(slugifyName('   !!!  ')).toBe('student');
    });
  });

  describe('usernameCandidate', () => {
    it('appends the suffix to the slugified base', () => {
      expect(usernameCandidate('Asha', 42)).toBe('asha42');
      expect(usernameCandidate('Asha Rao', '07')).toBe('asharao07');
    });

    it('returns the bare base for an empty suffix', () => {
      expect(usernameCandidate('Asha', '')).toBe('asha');
      expect(usernameCandidate('Asha')).toBe('asha');
    });
  });

  describe('uniqueUsername', () => {
    it('returns the bare base when it is free', async () => {
      const u = await uniqueUsername('Asha Rao', () => false);
      expect(u).toBe('asharao');
    });

    it('dedups within a batch (Set) using deterministic suffixes', async () => {
      const taken = new Set(['liam']);
      const assigned = [];
      // Deterministic suffix generator so the test is stable.
      const randomDigits = (i) => String(i + 1);
      for (let k = 0; k < 3; k += 1) {
        // eslint-disable-next-line no-await-in-loop
        const u = await uniqueUsername('Liam', (c) => taken.has(c), { randomDigits });
        taken.add(u);
        assigned.push(u);
      }
      // First 'liam' was pre-taken, so all three get distinct suffixed ids.
      expect(new Set(assigned).size).toBe(3);
      expect(assigned).toEqual(['liam1', 'liam2', 'liam3']);
      expect(assigned).not.toContain('liam');
    });

    it('supports an async isTaken predicate', async () => {
      const used = new Set(['fox', 'fox1']);
      const isTaken = async (c) => used.has(c);
      const u = await uniqueUsername('Fox', isTaken, { randomDigits: (i) => String(i + 1) });
      expect(u).toBe('fox2');
    });
  });

  describe('normalizeIdentifier', () => {
    it('trims and lowercases', () => {
      expect(normalizeIdentifier('  Asha2015 ')).toBe('asha2015');
      expect(normalizeIdentifier('Foo@Bar.COM')).toBe('foo@bar.com');
    });
    it('handles nullish', () => {
      expect(normalizeIdentifier(null)).toBe('');
      expect(normalizeIdentifier(undefined)).toBe('');
    });
  });

  describe('buildLoginFilter (email vs username resolution)', () => {
    it('builds a case-insensitive $or over email and username', () => {
      expect(buildLoginFilter('Asha2015')).toEqual({
        $or: [{ email: 'asha2015' }, { username: 'asha2015' }],
      });
    });

    it('resolves an email identifier the same way (either field can match)', () => {
      const filter = buildLoginFilter('Kid@School.org');
      expect(filter).toEqual({
        $or: [{ email: 'kid@school.org' }, { username: 'kid@school.org' }],
      });
    });
  });
});
