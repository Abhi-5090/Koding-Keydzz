import { describe, it, expect } from 'vitest';
import {
  createStudentSchema,
  updateStudentSchema,
} from '../src/utils/validators.js';
import { composeName } from '../src/services/studentBulkService.js';

describe('createStudentSchema (grade + school)', () => {
  it('accepts grade and school and keeps them on the parsed value', () => {
    const parsed = createStudentSchema.parse({
      firstName: 'Asha',
      lastName: 'Rao',
      grade: '5',
      school: 'Springfield Elementary',
    });
    expect(parsed.grade).toBe('5');
    expect(parsed.school).toBe('Springfield Elementary');
  });

  it('trims grade/school and treats them as optional', () => {
    const parsed = createStudentSchema.parse({ firstName: 'Liam', grade: '  3  ' });
    expect(parsed.grade).toBe('3');
    expect(parsed.school).toBeUndefined();
  });
});

describe('updateStudentSchema', () => {
  it('accepts an empty patch (all fields optional)', () => {
    expect(updateStudentSchema.parse({})).toEqual({});
  });

  it('accepts a partial patch with just grade/school', () => {
    const parsed = updateStudentSchema.parse({ grade: '6', school: 'Riverdale High' });
    expect(parsed).toEqual({ grade: '6', school: 'Riverdale High' });
  });

  it('coerces a blank username/email form field to undefined', () => {
    const parsed = updateStudentSchema.parse({ username: '', email: '' });
    expect(parsed.username).toBeUndefined();
    expect(parsed.email).toBeUndefined();
  });

  it('rejects a bad username (illegal characters)', () => {
    expect(() => updateStudentSchema.parse({ username: 'bad name!' })).toThrow();
  });

  it('rejects a too-short username', () => {
    expect(() => updateStudentSchema.parse({ username: 'ab' })).toThrow();
  });

  it('rejects a malformed email', () => {
    expect(() => updateStudentSchema.parse({ email: 'not-an-email' })).toThrow();
  });

  it('rejects an empty firstName when provided', () => {
    expect(() => updateStudentSchema.parse({ firstName: '' })).toThrow();
  });

  it('accepts a valid username + email', () => {
    const parsed = updateStudentSchema.parse({
      username: 'asha.rao-2015',
      email: 'asha@example.com',
    });
    expect(parsed.username).toBe('asha.rao-2015');
    expect(parsed.email).toBe('asha@example.com');
  });
});

describe('composeName (name recompute on edit)', () => {
  it('rebuilds the display name from first + last', () => {
    expect(composeName('Asha', 'Rao')).toBe('Asha Rao');
    expect(composeName('Liam', '')).toBe('Liam');
  });
});
