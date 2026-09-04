import { describe, it, expect } from 'vitest'
import {
  isAnswered,
  answersToSubmit,
  paperProgress,
  passMarkPosition,
  insertIndent,
  shouldSeedStarter,
  INDENT,
} from './paper'

/**
 * THE FINAL TEST IS THE ONE PLACE A PUPIL CAN LOSE SOMETHING.
 *
 * Three attempts, 200 marks, and the next course locked behind it. Every bug
 * in this file costs a real child real marks, so the edge cases are tested
 * rather than reasoned about.
 */

describe('isAnswered', () => {
  it('counts option 0 as an answer', () => {
    /**
     * THE IMPORTANT ONE.
     *
     * `0` is a genuine answer — the first option of a multiple-choice
     * question — so a truthiness check marks a pupil who picked A as having
     * skipped the question. They would then be warned they had unanswered
     * questions, go back, and find their answer apparently gone.
     *
     * The same coercion was a live scoring bug on the server, where
     * `Number(null) === 0` marked a blank as a pick of option A and awarded
     * full marks whenever the answer sat there.
     */
    expect(isAnswered(0)).toBe(true)
    expect(isAnswered('0')).toBe(true)
  })

  it('counts other falsy-looking but real answers', () => {
    // A fill-in-the-blank answer of "False" or "0" is a normal Python answer.
    expect(isAnswered('False')).toBe(true)
    expect(isAnswered(false)).toBe(true)
  })

  it('does not count a blank', () => {
    expect(isAnswered(null)).toBe(false)
    expect(isAnswered(undefined)).toBe(false)
    expect(isAnswered('')).toBe(false)
  })

  it('does not count whitespace as an answer', () => {
    // A pupil who tabbed into a box and out again has not answered it, and
    // must still be warned before handing in.
    expect(isAnswered('   ')).toBe(false)
    expect(isAnswered('\n\t ')).toBe(false)
  })

  it('trims before judging, but keeps the answer intact', () => {
    expect(isAnswered('  x  ')).toBe(true)
  })
})

describe('answersToSubmit', () => {
  it('sends answered questions in the API shape', () => {
    expect(answersToSubmit({ a: 2, b: 'print()' })).toEqual([
      { question: 'a', response: 2 },
      { question: 'b', response: 'print()' },
    ])
  })

  it('keeps a pick of option 0', () => {
    // The same trap as above, one layer up: dropping this loses the answer
    // between the screen and the server.
    expect(answersToSubmit({ a: 0 })).toEqual([{ question: 'a', response: 0 }])
  })

  it('drops blanks rather than sending empty answers', () => {
    const sent = answersToSubmit({ a: 1, b: '', c: null, d: '   ', e: undefined })
    expect(sent).toEqual([{ question: 'a', response: 1 }])
  })

  it('does not alter the answer text', () => {
    // Leading whitespace is significant in Python. Trimming here would break
    // a correct answer on its way to the marker.
    const code = '  def f():\n    return 1\n'
    expect(answersToSubmit({ a: code })[0].response).toBe(code)
  })

  it('handles an empty sheet', () => {
    expect(answersToSubmit({})).toEqual([])
    expect(answersToSubmit()).toEqual([])
  })
})

describe('paperProgress', () => {
  const paper = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }]

  it('counts answered questions, not the one being viewed', () => {
    // The paper is freely navigable, so a pupil can open the last question
    // first. Progress must describe work done, not position.
    const p = paperProgress(paper, { q4: 'done' })
    expect(p.answered).toBe(1)
    expect(p.unanswered).toBe(3)
    expect(p.percent).toBe(25)
  })

  it('counts a pick of option 0', () => {
    expect(paperProgress(paper, { q1: 0 }).answered).toBe(1)
  })

  it('ignores answers for questions not on this paper', () => {
    // A stale key from a previous attempt must not inflate progress to
    // "finished" on a paper that is not.
    const p = paperProgress(paper, { q1: 'a', ghost: 'b' })
    expect(p.answered).toBe(1)
  })

  it('reports a full paper', () => {
    const p = paperProgress(paper, { q1: 1, q2: 1, q3: 1, q4: 1 })
    expect(p.unanswered).toBe(0)
    expect(p.percent).toBe(100)
  })

  it('does not divide by zero on an empty paper', () => {
    // An empty paper is a server bug; rendering `NaN%` on top of it is ours.
    const p = paperProgress([], {})
    expect(p.percent).toBe(0)
    expect(p.total).toBe(0)
    expect(Number.isNaN(p.percent)).toBe(false)
  })

  it('survives being called with nothing', () => {
    expect(paperProgress().answered).toBe(0)
  })
})

describe('passMarkPosition', () => {
  it('places the 150-of-200 pass mark at 75%', () => {
    expect(passMarkPosition(150, 200)).toBe(75)
  })

  it('clamps rather than drawing the marker off the bar', () => {
    expect(passMarkPosition(300, 200)).toBe(100)
    expect(passMarkPosition(-10, 200)).toBe(0)
  })

  it('handles a zero total', () => {
    expect(passMarkPosition(150, 0)).toBe(0)
  })
})

describe('insertIndent', () => {
  it('inserts four spaces at the cursor', () => {
    const { value, caret } = insertIndent('def f():\n', 9, 9)
    expect(value).toBe(`def f():\n${INDENT}`)
    expect(caret).toBe(13)
  })

  it('returns the caret AFTER the indent', () => {
    // Without this the cursor snaps back and the pupil types their code
    // backwards, one character before the last.
    expect(insertIndent('ab', 2, 2).caret).toBe(6)
  })

  it('replaces a selection', () => {
    expect(insertIndent('abcd', 1, 3).value).toBe(`a${INDENT}d`)
  })

  it('clamps out-of-range positions instead of producing undefined', () => {
    expect(insertIndent('ab', 99, 99).value).toBe(`ab${INDENT}`)
    expect(insertIndent('ab', -5, -5).value).toBe(`${INDENT}ab`)
  })

  it('handles an empty field', () => {
    expect(insertIndent('', 0, 0).value).toBe(INDENT)
  })
})

describe('shouldSeedStarter', () => {
  it('seeds an untouched coding answer', () => {
    expect(shouldSeedStarter(null, 'def solve():')).toBe(true)
    expect(shouldSeedStarter('', 'def solve():')).toBe(true)
  })

  it('NEVER overwrites work on a resumed attempt', () => {
    // The dangerous case: a pupil returns to a paper they part-answered, and
    // the template silently deletes code they cannot re-sit to rewrite.
    expect(shouldSeedStarter('my own answer', 'def solve():')).toBe(false)
  })

  it('does not seed when there is no starter code', () => {
    expect(shouldSeedStarter(null, '')).toBe(false)
    expect(shouldSeedStarter(null, undefined)).toBe(false)
  })
})
