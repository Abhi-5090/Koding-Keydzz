import { isFulfilled } from '@reduxjs/toolkit'
import { toast } from '../../components/ui/toast/ToastProvider'

/**
 * TELL A CHILD WHEN SOMETHING WORKED — and what they earned.
 *
 * The staff portal's version of this confirms that a record was saved. Here the
 * job is different: a child needs to know the reward landed. "You earned 100 XP"
 * is the acknowledgement; "Saved" would be meaningless to them.
 *
 * SO THE MESSAGES READ THE RESPONSE
 * ---------------------------------
 * XP, coins, a level-up, a new streak day — the API already returns all of it
 * and most of it was never shown anywhere. A lesson that quietly credited 100 XP
 * to a number in the corner is a reward the child may not notice; saying it is
 * the difference between a mechanic and a moment.
 *
 * WHAT IS SILENT, AND WHY IT MATTERS MOST HERE
 * -------------------------------------------
 * The exam. `startFinalTest`, `saveProgress` and `submitFinalTest` raise
 * nothing: a child sitting a 200-mark paper must not have anything pop up over
 * it, congratulatory or otherwise. The exam screen has its own quiet save
 * indicator and its own result page. This is the one place in the product where
 * an interruption costs marks.
 *
 * `runCode` is silent too — the playground shows its output, which IS the
 * feedback, and a toast per run would fire every few seconds.
 */

const SILENT = new Set([
  // Exam integrity: nothing may interrupt a paper.
  'startFinalTest',
  'saveProgress',
  'submitFinalTest',
  // The screen already is the feedback.
  'runCode',
  'login',
  'logout',
  'registerStudent'
])

/** Build the reward sentence from whatever the response actually returned. */
function rewardLine(d) {
  const bits = []
  if (d?.xpEarned > 0) bits.push(`${d.xpEarned} XP`)
  if (d?.coinsEarned > 0) bits.push(`${d.coinsEarned} coins`)
  return bits.join(' and ')
}

const MESSAGES = {
  completeLesson: (d) => {
    if (d?.alreadyCompleted) {
      // Said plainly rather than silently awarding nothing, so a child who
      // redoes a lesson is not left wondering where their XP went.
      return { type: 'info', message: 'You had already finished this one — no new XP this time.' }
    }
    const reward = rewardLine(d)
    const streak = d?.streak?.bonusXp > 0
      ? ` Day ${d.streak.current} of your streak — ${d.streak.bonusXp} bonus XP!`
      : ''
    return {
      type: 'success',
      title: d?.leveledUp ? `Level ${d.level}!` : undefined,
      message: reward ? `Lesson done. You earned ${reward}.${streak}` : `Lesson done.${streak}`
    }
  },

  submitQuiz: (d) => {
    if (d?.passed === false) {
      return {
        type: 'info',
        message: `You scored ${d?.score ?? 0} of ${d?.total ?? 0}. Have another go — you keep your best score.`
      }
    }
    const reward = rewardLine(d)
    return {
      type: 'success',
      title: d?.leveledUp ? `Level ${d.level}!` : 'Quiz passed',
      message: reward ? `You earned ${reward}.` : 'Nicely done.'
    }
  },

  completeLevel: (d) => {
    const reward = rewardLine(d)
    const stars = d?.stars ? ` ${'★'.repeat(d.stars)}` : ''
    return {
      type: 'success',
      title: d?.leveledUp ? `Level ${d.level}!` : undefined,
      message: reward ? `Level cleared${stars} — ${reward}.` : `Level cleared${stars}.`
    }
  },

  purchaseItem: (d) => ({
    type: 'success',
    message: d?.coins != null ? `Bought! You have ${d.coins} coins left.` : 'Bought!'
  }),

  equipAvatarItem: () => ({ type: 'success', message: 'Looking good.' }),

  startCourse: (d) => ({
    type: 'success',
    message: d?.title ? `${d.title} started. Good luck!` : 'Course started.'
  })
}

export const toastOnSuccess = () => (next) => (action) => {
  if (!isFulfilled(action)) return next(action)
  if (action.meta?.arg?.type !== 'mutation') return next(action)

  const endpoint = action.meta.arg.endpointName
  if (SILENT.has(endpoint)) return next(action)

  const build = MESSAGES[endpoint]
  if (!build) {
    /**
     * Unmapped mutations stay SILENT in this app, unlike the staff portal.
     *
     * The reverse trade-off: for staff, a vague "Saved" beats silence because
     * they need to know a record persisted. For a child, an unexplained
     * notification is confusing noise, and everything that earns a reward is
     * mapped above. Failures are still announced by toastOnError, which is the
     * half that must never be silent.
     */
    return next(action)
  }

  try {
    const spec = build(action.payload) || {}
    toast().push({
      type: spec.type || 'success',
      title: spec.title,
      message: spec.message
    })
  } catch {
    /* an unexpected response shape must not throw inside middleware */
  }

  return next(action)
}

export default toastOnSuccess
