import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Lightbulb,
  PartyPopper,
  Flag,
  Timer,
} from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LevelWinOverlay from './LevelWinOverlay'

/**
 * QuestionLevelGame — reusable engine for question-set levels.
 *
 * Props:
 *   game      { title, icon?, tint? }
 *   level     { id, name, difficulty, intro?, questions:[ q ] }
 *               q is one of:
 *                 { type:'mcq',       prompt, code?, options:[...], answer:<index>, explain? }
 *                 { type:'truefalse', prompt, code?, answer:<bool>,                explain? }
 *                 { type:'choice',    prompt, code?, options:[...], answer:<index>, explain? }
 *               `code` (when present) renders in a styled monospace block.
 *   onExit()                      back to level select
 *   onComplete(stars) -> Promise<awardResult|undefined>
 *               called once on finish. Should persist the level + return the
 *               backend award ({ awarded:{xp,coins}, alreadyCompleted }).
 *   hasNext   boolean
 *   onNext()  advance to the next level
 *
 *   timePerQuestion?  OPTIONAL number of seconds per question. When set (> 0),
 *                     a per-question countdown is shown ("arena" mode) and the
 *                     question is auto-marked wrong if the timer expires. When
 *                     omitted/0 the component behaves exactly as before — no
 *                     timer, no behavior change for the other games.
 *
 * Stars: 3 = zero wrong (all first-try), 2 = 1–2 wrong, 1 = completed with more.
 * Never reveals future answers; optional `explain` shown only after a wrong pick.
 */
export default function QuestionLevelGame({
  game,
  level,
  onExit,
  onComplete,
  hasNext,
  onNext,
  timePerQuestion = 0,
}) {
  const tint = game.tint || '#FF602F'
  const questions = level.questions || []
  const total = questions.length
  const timed = timePerQuestion > 0

  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null) // selected option index / bool
  const [wrongCount, setWrongCount] = useState(0)
  const [missedThis, setMissedThis] = useState(false) // wrong at least once on this q
  const [timedOut, setTimedOut] = useState(false) // ran out of time on this q
  const [timeLeft, setTimeLeft] = useState(timePerQuestion)

  const [finished, setFinished] = useState(false)
  const [stars, setStars] = useState(0)
  const [reward, setReward] = useState(null)
  const [alreadyMastered, setAlreadyMastered] = useState(false)
  const [awarding, setAwarding] = useState(false)

  const q = questions[index]
  const isTF = q?.type === 'truefalse'
  const options = useMemo(() => (isTF ? ['True', 'False'] : q?.options || []), [isTF, q])
  const answerIndex = isTF ? (q?.answer ? 0 : 1) : q?.answer
  const isCorrect = picked != null && picked === answerIndex

  const reset = useCallback(() => {
    setIndex(0)
    setPicked(null)
    setWrongCount(0)
    setMissedThis(false)
    setTimedOut(false)
    setTimeLeft(timePerQuestion)
    setFinished(false)
    setStars(0)
    setReward(null)
    setAlreadyMastered(false)
    setAwarding(false)
  }, [timePerQuestion])

  const choose = (i) => {
    if (picked != null || timedOut) return
    setPicked(i)
    if (i !== answerIndex) {
      if (!missedThis) {
        setMissedThis(true)
        setWrongCount((w) => w + 1)
      }
    }
  }

  // Per-question countdown (arena mode only). On expiry the question is marked
  // wrong (once) and locked; the player taps "Next" to continue.
  const expireRef = useRef(false)
  useEffect(() => {
    if (!timed || finished) return
    if (picked != null || timedOut) return
    setTimeLeft(timePerQuestion)
    expireRef.current = false
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id)
          if (!expireRef.current) {
            expireRef.current = true
            setTimedOut(true)
            // Only count the timeout as wrong if the player hadn't already
            // missed this question (they can't have, since picking locks it).
            if (!missedThis) setWrongCount((w) => w + 1)
            setMissedThis(true)
          }
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, finished, index, picked, timedOut, timePerQuestion, missedThis])

  const finish = useCallback(
    async (totalWrong) => {
      const earned = totalWrong === 0 ? 3 : totalWrong <= 2 ? 2 : 1
      setStars(earned)
      setFinished(true)
      setAwarding(true)
      const res = await onComplete?.(earned)
      const awarded = res?.awarded || { xp: 0, coins: 0 }
      if (res?.alreadyCompleted || (!awarded.xp && !awarded.coins)) {
        setAlreadyMastered(!!res?.alreadyCompleted)
        setReward(null)
      } else {
        setReward({ xp: awarded.xp || 0, coins: awarded.coins || 0 })
      }
      setAwarding(false)
    },
    [onComplete]
  )

  const goNext = () => {
    if (index + 1 >= total) {
      finish(wrongCount)
    } else {
      setIndex((n) => n + 1)
      setPicked(null)
      setMissedThis(false)
      setTimedOut(false)
      setTimeLeft(timePerQuestion)
    }
  }

  const advance = () => {
    // A timed-out question is already counted wrong — move on (no retry).
    if (timedOut) {
      goNext()
      return
    }
    // Only advance on a correct answer; wrong answers retry the same question.
    if (!isCorrect) {
      setPicked(null)
      return
    }
    goNext()
  }

  const locked = picked != null || timedOut
  const optionClass = (i) => {
    if (!locked) return 'border-k-border bg-surface/50 can-hover:hover:border-turmeric'
    if (i === answerIndex) return 'border-success bg-success/15 text-success'
    if (i === picked) return 'border-error bg-error/15 text-error'
    return 'border-k-border bg-surface/40 opacity-60'
  }

  const Icon = game.icon

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          className="game-text inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
        >
          <ArrowLeft size={16} /> Levels
        </button>
        <div className="min-w-0 text-right">
          <div className="game-text text-xs uppercase tracking-wide text-text-secondary">
            Level {level.id} · {level.difficulty}
          </div>
          <div className="game-text truncate text-lg font-extrabold text-turmeric">{level.name}</div>
        </div>
      </div>

      {/* Progress dots */}
      <div className="mb-4 flex items-center justify-center gap-1.5" aria-hidden="true">
        {questions.map((_, i) => (
          <span
            key={i}
            className="h-2 rounded-full transition-[width,background-color,opacity] duration-300 ease-out"
            style={{
              width: i === index ? 22 : 8,
              background: i < index ? tint : i === index ? tint : '#9DB8C455',
              opacity: i <= index ? 1 : 0.4,
            }}
          />
        ))}
      </div>

      <Card hover={false}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="game-text text-sm text-text-secondary">
            Question {index + 1} of {total}
          </span>
          <div className="flex items-center gap-2">
            {timed && (
              <motion.span
                key={`${index}-${timeLeft}`}
                initial={{ scale: 1.25 }}
                animate={{ scale: 1 }}
                className={`game-text inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-extrabold tabular-nums ${
                  timedOut
                    ? 'bg-error/15 text-error'
                    : timeLeft <= 3
                      ? 'bg-error/15 text-error'
                      : 'bg-surface text-turmeric'
                }`}
              >
                <Timer size={14} /> {timedOut ? '0' : timeLeft}s
              </motion.span>
            )}
            <span
              className="game-text inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: `${tint}22`, color: tint }}
            >
              {Icon ? <Icon size={14} /> : null}
              {labelForType(q?.type)}
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
          >
            {index === 0 && level.intro && picked == null && (
              <p className="game-text mb-4 rounded-xl border border-k-border bg-malt/50 px-4 py-3 text-center text-sm text-text-secondary">
                {level.intro}
              </p>
            )}

            <h2 className="game-text mb-4 text-center text-xl font-bold text-text-primary">
              {q?.prompt}
            </h2>

            {q?.code && (
              <pre className="mb-5 overflow-x-auto rounded-xl border border-k-border bg-malt px-4 py-3 text-left font-mono text-sm leading-relaxed text-text-primary">
                <code>{q.code}</code>
              </pre>
            )}

            <div
              className={`grid gap-3 ${
                options.length <= 2 ? 'sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'
              }`}
            >
              {options.map((opt, i) => (
                <motion.button
                  key={i}
                  type="button"
                  disabled={locked}
                  whileTap={!locked ? { scale: 0.97 } : undefined}
                  onClick={() => choose(i)}
                  className={`game-text rounded-xl border-2 px-4 py-3.5 text-center text-base font-bold transition-[background-color,border-color,color] duration-200 disabled:cursor-default ${optionClass(
                    i
                  )}`}
                >
                  {opt}
                </motion.button>
              ))}
            </div>

            <AnimatePresence>
              {locked && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`mt-5 rounded-xl border p-4 text-sm ${
                    isCorrect
                      ? 'border-success/50 bg-success/10 text-success'
                      : 'border-error/50 bg-error/10 text-error'
                  }`}
                >
                  <p className="game-text flex items-center gap-1.5 font-bold">
                    {isCorrect ? (
                      <>
                        <PartyPopper size={17} /> Correct!
                      </>
                    ) : timedOut ? (
                      <>
                        <Timer size={16} /> Time’s up!
                      </>
                    ) : (
                      <>
                        <X size={16} /> Not quite — try again.
                      </>
                    )}
                  </p>
                  {/* Explanation on a wrong pick or timeout; never reveals future answers. */}
                  {!isCorrect && q?.explain && (
                    <p className="game-text mt-1 flex items-start gap-1.5 text-text-secondary">
                      <Lightbulb size={15} className="mt-0.5 shrink-0 text-accent" />
                      {q.explain}
                    </p>
                  )}
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={advance} className="inline-flex items-center gap-1.5">
                      {isCorrect || timedOut ? (
                        index + 1 >= total ? (
                          <>
                            <Flag size={15} /> Finish
                          </>
                        ) : (
                          <>
                            Next <ArrowRight size={15} />
                          </>
                        )
                      ) : (
                        <>
                          <Check size={15} /> Try Again
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </Card>

      <AnimatePresence>
        {finished && (
          <LevelWinOverlay
            confettiKey={`q-${level.id}`}
            stars={stars}
            message={messageForStars(stars)}
            reward={reward}
            alreadyMastered={alreadyMastered}
            awarding={awarding}
            hasNext={hasNext}
            onNext={onNext}
            onReplay={reset}
            onLevels={onExit}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function labelForType(type) {
  if (type === 'truefalse') return 'True / False'
  if (type === 'choice') return 'Choose'
  return 'Pick One'
}

function messageForStars(stars) {
  if (stars === 3) return 'Flawless — every answer right on the first try!'
  if (stars === 2) return 'Great thinking! A slip or two, but you cracked it.'
  return 'You made it through — replay for a cleaner run!'
}
