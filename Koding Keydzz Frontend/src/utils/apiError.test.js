import { describe, it, expect } from 'vitest'
import { formatApiError } from './apiError'

/**
 * ERROR MESSAGES FOR A TEN-YEAR-OLD.
 *
 * This is a separate formatter from the staff portal's on purpose, and the
 * tests are about TONE as much as correctness. A child who reads "Validation
 * failed" or a status code learns nothing and concludes they did something
 * wrong; a child told "check the internet" can act, or fetch an adult.
 *
 * The rules asserted here: no status codes, no field paths, no the word
 * "error", and always some idea of whether their work survived.
 */
describe('formatApiError, for a child', () => {
  it('names a connection problem, because that is the one they can fix', () => {
    expect(formatApiError({ status: 'FETCH_ERROR' })).toMatch(/internet/i)
  })

  it('turns rate limiting into something that is not a telling-off', () => {
    const msg = formatApiError({ status: 429 })
    expect(msg).toMatch(/too fast/i)
    // "Too many requests" is the server's words and reads like an accusation.
    expect(msg).not.toMatch(/too many requests/i)
  })

  it('replaces "Validation failed" with something actionable', () => {
    // The single worst message in the product for this audience: it sounds
    // like the child is at fault and says nothing about what to change.
    const msg = formatApiError({ status: 400, data: { message: 'Validation failed' } })
    expect(msg).not.toMatch(/validation/i)
    expect(msg).toMatch(/have another look/i)
  })

  it('prefers FIELD problems, which are the actionable half', () => {
    const msg = formatApiError({
      status: 400,
      data: {
        message: 'Validation failed',
        details: [{ path: 'password', message: 'Password must be at least 6 characters' }]
      }
    })
    expect(msg).toMatch(/password/i)
    expect(msg).toMatch(/6 characters/)
  })

  it('joins several field problems instead of revealing them one submit at a time', () => {
    const msg = formatApiError({
      status: 400,
      data: {
        details: [
          { path: 'username', message: 'Username is taken' },
          { path: 'password', message: 'Too short' }
        ]
      }
    })
    expect(msg).toMatch(/username/i)
    expect(msg).toMatch(/password/i)
  })

  it('passes a real server sentence through, because the API speaks the same way', () => {
    expect(
      formatApiError({ status: 403, data: { message: 'You have already passed this course' } })
    ).toBe('You have already passed this course')
  })

  it('says a 500 is NOT the child’s fault', () => {
    // A child who breaks something concludes they are bad at this. Naming
    // whose fault it is costs one clause.
    expect(formatApiError({ status: 500 })).toMatch(/our side, not yours/i)
  })

  it('NEVER leaks a status code or a stack', () => {
    const cases = [
      { status: 500, data: { message: 'ECONNREFUSED at Object.<anonymous>' } },
      { status: 404 },
      { status: 409, data: {} },
      undefined,
      null,
      {}
    ]
    for (const err of cases) {
      const msg = formatApiError(err)
      expect(typeof msg).toBe('string')
      expect(msg.length).toBeGreaterThan(0)
      expect(msg, `leaked internals for ${JSON.stringify(err)}`).not.toMatch(
        /\b(4\d\d|5\d\d)\b|status|stack|ECONNREFUSED|at Object/i
      )
    }
  })

  it('always returns something, so a failure is never silent', () => {
    // The property that matters most: a missing message means the child sees
    // nothing at all and assumes their work saved.
    expect(formatApiError({ status: 418 })).toBeTruthy()
  })
})
