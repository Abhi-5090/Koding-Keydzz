import { describe, it, expect } from 'vitest';
import { formatApiError } from './apiError';

/**
 * WHY THIS IS TESTED CAREFULLY.
 *
 * This function now sits in front of every error message in the portal. The
 * bug it replaced was that all 23 error sites read only `err.data.message`, so
 * the API's field-level `details` were discarded — a user who typed a 3-letter
 * password was told **"Validation failed"** and nothing else. The information
 * needed to fix it was in the response the whole time.
 *
 * That is worse than a missing feature: the person cannot tell whether they
 * made a mistake or the product is broken, and the natural next move is to
 * submit exactly the same thing again.
 */

describe('field-level details win, because they are the actionable half', () => {
  it('reports the field problem instead of the generic wrapper', () => {
    const err = {
      status: 400,
      data: {
        success: false,
        message: 'Validation failed',
        details: [{ path: 'password', message: 'Password must be at least 6 characters' }],
      },
    };
    expect(formatApiError(err)).toBe('Password must be at least 6 characters');
    expect(formatApiError(err)).not.toMatch(/validation failed/i);
  });

  it('reports EVERY field problem at once', () => {
    // Otherwise a form with two mistakes is discovered one submit at a time.
    const err = {
      status: 400,
      data: {
        message: 'Validation failed',
        details: [
          { path: 'firstName', message: 'First name is required' },
          { path: 'password', message: 'Password must be at least 6 characters' },
        ],
      },
    };
    const out = formatApiError(err);
    expect(out).toMatch(/First name is required/);
    expect(out).toMatch(/Password must be at least 6 characters/);
  });

  it('names the field when the message does not', () => {
    const err = {
      status: 400,
      data: { message: 'Validation failed', details: [{ path: 'rollNumber', message: 'Too long' }] },
    };
    // School language, not schema language.
    expect(formatApiError(err)).toBe('Roll number: Too long');
  });

  it('does not repeat the field name when the message already starts with it', () => {
    // "Password Password must be at least 6 characters" reads as a bug.
    const err = {
      status: 400,
      data: {
        message: 'Validation failed',
        details: [{ path: 'password', message: 'Password must be at least 6 characters' }],
      },
    };
    expect(formatApiError(err)).toBe('Password must be at least 6 characters');
  });

  it('handles a nested zod path by using its last segment', () => {
    const err = {
      status: 400,
      data: { message: 'Validation failed', details: [{ path: 'questions.0.grade', message: 'Required' }] },
    };
    expect(formatApiError(err)).toBe('Grade: Required');
  });
});

describe('a specific server message is passed through', () => {
  it.each([
    'An account with this email already exists',
    'This username is already taken',
    'Roll number "17" is already used by Existing Pupil in Shelbyville Elementary.',
    'Springfield Elementary has no seats left (30 of 30 used).',
  ])('keeps %s', (message) => {
    expect(formatApiError({ status: 409, data: { message } })).toBe(message);
  });

  it('never shows the bare generic wrapper on its own', () => {
    // With no details behind it, "Validation failed" tells the user nothing —
    // the fallback at least says what to do.
    const out = formatApiError({ status: 400, data: { message: 'Validation failed' } });
    expect(out).not.toMatch(/validation failed/i);
    expect(out).toMatch(/try again/i);
  });
});

describe('transport failures are worded for a non-technical reader', () => {
  it.each([
    [{ status: 'FETCH_ERROR' }, /could not reach the server/i],
    [{ status: 401, data: {} }, /session has expired/i],
    [{ status: 403, data: {} }, /do not have permission/i],
    [{ status: 413, data: {} }, /too large/i],
    [{ status: 429, data: {} }, /too many attempts/i],
    [{ status: 500, data: {} }, /server had a problem/i],
    [{ status: 503, data: {} }, /server had a problem/i],
  ])('%o', (err, expected) => {
    expect(formatApiError(err)).toMatch(expected);
  });

  it('prefers a real server message over the status-code wording', () => {
    // A 403 that explains itself is more useful than "no permission".
    const err = { status: 403, data: { message: 'Only the school owner can remove an administrator' } };
    expect(formatApiError(err)).toBe('Only the school owner can remove an administrator');
  });
});

describe('it never returns an empty or unhelpful string', () => {
  it.each([undefined, null, {}, { data: null }, { data: {} }, { data: { details: [] } }, 'boom', 42])(
    'falls back for %o',
    (err) => {
      const out = formatApiError(err);
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(10);
    }
  );

  it('uses the caller\'s fallback when one is given', () => {
    expect(formatApiError({}, 'Could not save the quiz.')).toBe('Could not save the quiz.');
  });

  it('ignores detail entries with no message', () => {
    const err = { status: 400, data: { message: 'Validation failed', details: [{ path: 'x' }] } };
    expect(formatApiError(err, 'fallback sentence here')).toBe('fallback sentence here');
  });

  it('reads an error nested under `error`, as some RTK shapes are', () => {
    const err = { error: { data: { message: 'Deeper message' } } };
    expect(formatApiError(err)).toBe('Deeper message');
  });
});

describe('never leaking server internals', () => {
  it('REFUSES to show a 5xx message, whatever it contains', () => {
    /**
     * The bug this locks down: step 2 of the formatter returned `data.message`
     * for any status, so a 500 raised by an unexpected exception printed
     * whatever threw into the UI — a driver string, a file path, a stack
     * fragment. Useless to an administrator and free reconnaissance to anyone
     * else looking at the screen.
     */
    const leaky = [
      'ECONNREFUSED at Object.<anonymous> (/srv/app/src/db.js:14:7)',
      'E11000 duplicate key error collection: Koding_Keydzz.users index: email_1',
      'MongooseServerSelectionError: connect ETIMEDOUT 10.0.0.4:27017',
    ];
    for (const message of leaky) {
      const shown = formatApiError({ status: 500, data: { message } });
      expect(shown).toBe('The server had a problem. Please try again in a moment.');
      expect(shown).not.toMatch(/ECONNREFUSED|E11000|Mongoose|\/srv\/|27017/);
    }
  });

  it('still shows a deliberate 4xx message, which is the useful half', () => {
    // The distinction the fix rests on: 4xx messages are written for the user.
    expect(
      formatApiError({ status: 409, data: { message: 'This school has no seats left' } })
    ).toBe('This school has no seats left');
  });

  it('does not leak a 5xx message hidden in field details either', () => {
    expect(
      formatApiError({
        status: 503,
        data: { details: [{ path: 'db', message: 'connect ETIMEDOUT 10.0.0.4:27017' }] },
      })
    ).not.toMatch(/ETIMEDOUT|27017/);
  });
});
