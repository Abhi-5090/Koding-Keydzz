/**
 * PAPER LOGIC, separated from the screen that draws it.
 *
 * Everything here decides something a pupil can lose marks by: whether an
 * answer counts as given, what gets submitted, and how many questions are
 * still blank when they ask to hand in. The exam UI is a thin shell over these
 * functions so they can be tested directly — the same split the games use,
 * where the engine holds the rules and the screen only draws them.
 *
 * The server marks the paper and owns every mark scheme. Nothing here knows a
 * correct answer, and nothing here should ever learn one.
 */

/**
 * Has this question been answered?
 *
 * The subtle one. `0` is a real answer — it is the first option of a
 * multiple-choice question — so this cannot be a truthiness check, and
 * `Number(response)` cannot be used to normalise it either.
 *
 * That exact confusion was a live scoring bug on the server: `Number(null)` is
 * `0`, so a blank multiple-choice answer was marked as a pick of option A and
 * scored full marks whenever the correct answer happened to sit there. Here the
 * same mistake is cheaper — it mislabels the question navigator and lets a
 * pupil hand in believing they answered — but it is the same mistake.
 *
 * Answered: `0`, `'0'`, `'False'`, `'  x  '`.
 * Not answered: `null`, `undefined`, `''`, `'   '`.
 */
export function isAnswered(response) {
  if (response === null || response === undefined) return false
  return String(response).trim() !== ''
}

/**
 * The answers to send, in the shape the API takes.
 *
 * Blanks are dropped rather than sent as empty strings. Both score zero, so
 * this is not about marks — it keeps a resumed paper honest: a question the
 * pupil never touched should come back untouched, not as an empty answer they
 * appear to have given.
 */
export function answersToSubmit(answers = {}) {
  return Object.entries(answers)
    .filter(([, response]) => isAnswered(response))
    .map(([question, response]) => ({ question, response }))
}

/**
 * How far through the paper the pupil is.
 *
 * Progress counts ANSWERED questions, not the furthest one visited. The paper
 * is freely navigable, so "question 20 of 24" says nothing about how much is
 * done — a pupil can jump to the last question first.
 */
export function paperProgress(questions = [], answers = {}) {
  const total = questions.length
  const answered = questions.filter((q) => isAnswered(answers[q.id])).length
  return {
    total,
    answered,
    unanswered: total - answered,
    // Guarded: an empty paper is a server bug, but it must not divide by zero
    // and render a NaN-width progress bar on top of it.
    percent: total === 0 ? 0 : Math.round((answered / total) * 100),
  }
}

/**
 * Where to draw the pass mark on a 0–100% bar.
 *
 * Clamped, so a blueprint whose pass mark exceeded its total could not push the
 * marker outside the bar.
 */
export function passMarkPosition(passMark, total) {
  if (!total || total <= 0) return 0
  return Math.max(0, Math.min(100, (passMark / total) * 100))
}

/** Indentation inserted when Tab is pressed in a code answer. */
export const INDENT = '    '

/**
 * Insert an indent at the cursor, for a code answer's Tab key.
 *
 * A bare textarea moves focus out of the field on Tab, which is unusable for
 * writing Python. Returned as { value, caret } rather than applied directly so
 * the caller restores the caret — without that, the cursor jumps to the start
 * of the line after every Tab and the answer is typed backwards.
 */
export function insertIndent(value = '', start = 0, end = start) {
  const from = Math.max(0, Math.min(value.length, start))
  const to = Math.max(from, Math.min(value.length, end))
  return {
    value: `${value.slice(0, from)}${INDENT}${value.slice(to)}`,
    caret: from + INDENT.length,
  }
}

/**
 * Seed a coding answer with its starter code?
 *
 * Only when the pupil has written nothing. A resumed attempt must never have
 * real work replaced by the template — that would silently delete an answer
 * they have already spent time on, and on a paper they cannot re-sit.
 */
export function shouldSeedStarter(current, starterCode) {
  return Boolean(starterCode) && !isAnswered(current)
}
