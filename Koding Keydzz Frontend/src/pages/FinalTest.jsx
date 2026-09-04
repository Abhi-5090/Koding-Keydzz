import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Clock,
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Flag,
  Trophy,
  RotateCcw,
  Home,
  Save,
  Lock,
  Code,
  Pencil,
  CircleDot,
  Wrench,
  Target,
} from 'lucide-react'
import {
  useGetFinalTestEligibilityQuery,
  useStartFinalTestMutation,
  useSaveProgressMutation,
  useSubmitFinalTestMutation,
} from '../features/finalTest/finalTestApi'
import { useGetCoursesQuery } from '../features/courses/coursesApi'
import {
  isAnswered,
  answersToSubmit,
  paperProgress,
  passMarkPosition,
  insertIndent,
  shouldSeedStarter,
} from '../features/finalTest/paper'
import PageTransition from '../components/layout/PageTransition'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Confetti from '../components/ui/Confetti'
import Mascot from '../components/ui/Mascot'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import { LoadingState, ErrorState } from '../components/ui/QueryState'

/**
 * THE FINAL TEST — the exam that gates the course ladder.
 *
 * This is NOT the Quiz Arena with a higher mark. It is the one place in the app
 * where a pupil can lose something, so it is built to different rules:
 *
 *   • NO feedback while sitting. The Quiz Arena colours an option green the
 *     moment it is picked, because practice should teach. An exam that did that
 *     would be marking itself in front of the candidate.
 *
 *   • FREE NAVIGATION. Quizzes march forward one question at a time. Across 24
 *     questions and 200 marks a pupil must be able to skip a hard one, come
 *     back, and check their work — that is how every real paper works, and a
 *     forced march costs marks for reasons that have nothing to do with what
 *     they know.
 *
 *   • STARTING COSTS SOMETHING. `POST /start` draws the paper and burns one of
 *     three attempts, so it happens on a deliberate click behind a briefing
 *     screen — never on mount, a refetch, or a remount.
 *
 *   • THE WORK IS SAVED AS THEY GO. A dropped connection or a closed tab
 *     during a long paper must not cost the attempt.
 *
 * The server owns every mark. This screen never sees a correct answer, so
 * there is nothing here to read in devtools.
 */

/** How often to push saved answers up while a pupil is working. */
const AUTOSAVE_MS = 12_000

const TYPE_META = {
  mcq: { icon: CircleDot, label: 'Choose one' },
  fillblank: { icon: Pencil, label: 'Fill in' },
  coding: { icon: Code, label: 'Write code' },
  task: { icon: Wrench, label: 'Build it' },
}

export default function FinalTest() {
  const { slug } = useParams()
  const navigate = useNavigate()

  // The live attempt, once started. Held in component state rather than the
  // RTK cache because it is the pupil's working copy: it changes on every
  // keystroke and must never be replaced by a refetch mid-exam.
  const [paper, setPaper] = useState(null)
  const [result, setResult] = useState(null)

  if (result) {
    return (
      <Result
        slug={slug}
        result={result}
        onRetake={() => {
          setResult(null)
          setPaper(null)
        }}
      />
    )
  }

  if (paper) {
    return (
      <Sitting
        slug={slug}
        paper={paper}
        onFinished={setResult}
        onAbandon={() => navigate('/courses')}
      />
    )
  }

  return <Briefing slug={slug} onStarted={setPaper} />
}

/* ========================================================================== */
/* 1. Briefing — the gate                                                     */
/* ========================================================================== */

/**
 * What the test is, whether it may be sat, and what starting costs.
 *
 * The rules are spelled out BEFORE the paper is drawn, because a pupil cannot
 * consent to spending an attempt they were not told about.
 */
function Briefing({ slug, onStarted }) {
  const eligibility = useGetFinalTestEligibilityQuery(slug)
  const coursesQuery = useGetCoursesQuery()
  const [start, { isLoading: starting, error: startError }] = useStartFinalTestMutation()

  const course = useMemo(
    () => (coursesQuery.data?.items || []).find((c) => c.slug === slug) || null,
    [coursesQuery.data, slug]
  )

  if (eligibility.isLoading || coursesQuery.isLoading) {
    return (
      <PageTransition>
        <LoadingState message="Checking your progress…" />
      </PageTransition>
    )
  }
  if (eligibility.isError) {
    return (
      <PageTransition>
        <ErrorState onRetry={eligibility.refetch} />
      </PageTransition>
    )
  }

  const data = eligibility.data || {}
  const total = coursesQuery.data?.total ?? 200
  const passMark = coursesQuery.data?.passMark ?? 150
  const tint = course?.tint || '#E8A33D'

  const begin = async () => {
    try {
      const drawn = await start(slug).unwrap()
      onStarted(drawn)
    } catch {
      // Surfaced inline below — never a thrown-away failure on a screen where
      // the pupil is about to spend an attempt.
    }
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl">
        <Link
          to="/courses"
          className="game-text mb-4 inline-flex items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Your journey
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: `${tint}22`, color: tint }}
          >
            <AnimatedIcon icon={ShieldCheck} size={26} animation="float" glow />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading truncate text-2xl font-extrabold">
              {course?.title || 'Final test'}
            </h1>
            <p className="text-sm text-text-secondary">The last step of this course.</p>
          </div>
        </div>

        <Card hover={false}>
          {/* The rules, stated plainly. A child sitting a 200-mark paper is
              entitled to know the shape of it before it starts. */}
          <h2 className="game-text mb-4 text-lg font-bold">Before you begin</h2>
          <ul className="space-y-3">
            <Rule icon={Target}>
              Score <strong className="text-text-primary">{passMark} out of {total}</strong> to pass
              and unlock the next course.
            </Rule>
            <Rule icon={RotateCcw}>
              You get <strong className="text-text-primary">three tries</strong> in total.
              {typeof data.attemptsLeft === 'number' && (
                <>
                  {' '}
                  You have{' '}
                  <strong className="text-text-primary">
                    {data.attemptsLeft} {data.attemptsLeft === 1 ? 'try' : 'tries'}
                  </strong>{' '}
                  left.
                </>
              )}
            </Rule>
            <Rule icon={ListChecks}>
              The questions are picked fresh from the question bank each time, so a new try is a
              new paper.
            </Rule>
            <Rule icon={Save}>
              Your answers save as you work. If you close the tab by accident you can come back to
              the same paper.
            </Rule>
            <Rule icon={Clock}>
              There is no timer. Take the time you need, and check your work before you finish.
            </Rule>
          </ul>

          <div className="mt-6 border-t border-k-border pt-5">
            {data.allowed ? (
              <>
                <p className="game-text mb-3 flex items-start gap-2 text-sm text-text-secondary">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-turmeric" aria-hidden="true" />
                  {/* The one thing that must be unmistakable: this click spends
                      something. */}
                  Starting uses one of your tries — even if you close the page.
                </p>
                {startError && (
                  <p role="alert" className="game-text mb-3 text-sm text-error">
                    {startError?.data?.message || 'That did not work. Please try again.'}
                  </p>
                )}
                <Button onClick={begin} disabled={starting} className="w-full sm:w-auto">
                  {starting ? 'Getting your paper ready…' : 'Start the final test'}
                  {!starting && <ArrowRight size={16} className="ml-1.5" aria-hidden="true" />}
                </Button>
              </>
            ) : (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-text-secondary">
                  {data.passed ? (
                    <Trophy size={20} className="text-success" aria-hidden="true" />
                  ) : (
                    <Lock size={20} aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  {/* The server writes this sentence and it names what is left
                      to do, so it is shown verbatim rather than reworded. */}
                  <p className="game-text text-sm text-text-primary">{data.reason}</p>
                  <Link to="/courses" className="mt-3 inline-block">
                    <Button variant="secondary">Back to your journey</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </PageTransition>
  )
}

function Rule({ icon: Icon, children }) {
  return (
    <li className="game-text flex items-start gap-3 text-sm text-text-secondary">
      <Icon size={16} className="mt-0.5 shrink-0 text-turmeric" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

/* ========================================================================== */
/* 2. Sitting — the exam                                                      */
/* ========================================================================== */

function Sitting({ slug, paper, onFinished, onAbandon }) {
  const questions = paper.questions || []
  const [index, setIndex] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const reduce = useReducedMotion()

  // questionId -> response, seeded with whatever a resumed attempt already had.
  const [answers, setAnswers] = useState(() =>
    Object.fromEntries(
      questions.filter((q) => isAnswered(q.response)).map((q) => [q.id, q.response])
    )
  )

  const [save, { isLoading: saving }] = useSaveProgressMutation()
  const [submit, { isLoading: submitting, error: submitError }] = useSubmitFinalTestMutation()

  const answerList = useCallback(() => answersToSubmit(answers), [answers])

  /* ---- autosave ---------------------------------------------------------
     `dirty` is a ref, not state: flipping state on every keystroke would
     re-render the whole paper while a pupil is typing into a code box. */
  const dirty = useRef(false)
  const latest = useRef(answerList)
  latest.current = answerList

  const flush = useCallback(async () => {
    if (!dirty.current) return
    dirty.current = false
    try {
      await save({ attemptId: paper.attemptId, answers: latest.current() }).unwrap()
    } catch {
      // A failed save is not fatal and must not interrupt the exam — the work
      // is still in component state and the next tick will try again. Marking
      // it dirty again is what makes the retry happen.
      dirty.current = true
    }
  }, [save, paper.attemptId])

  useEffect(() => {
    const id = setInterval(flush, AUTOSAVE_MS)
    return () => {
      clearInterval(id)
      // One last push on unmount, so leaving the page keeps the work.
      flush()
    }
  }, [flush])

  /* ---- don't lose the paper to a stray click ---------------------------- */
  useEffect(() => {
    const warn = (e) => {
      e.preventDefault()
      // Wording is the browser's, not ours; what matters is that the dialog
      // appears at all. Closing a tab mid-exam should take a second thought.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const setAnswer = (id, value) => {
    dirty.current = true
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const { answered: answeredCount, unanswered, percent } = paperProgress(questions, answers)
  const q = questions[index]

  const go = (next) => {
    // Save when moving between questions as well as on the timer: a pupil who
    // answers and immediately closes the tab has their work.
    flush()
    setIndex(Math.max(0, Math.min(questions.length - 1, next)))
  }

  const finish = async () => {
    try {
      const marked = await submit({
        attemptId: paper.attemptId,
        answers: answerList(),
      }).unwrap()
      dirty.current = false
      onFinished(marked)
    } catch {
      setConfirming(false)
    }
  }

  if (!q) {
    return (
      <PageTransition>
        <ErrorState message="This paper has no questions. Please tell your teacher." onRetry={onAbandon} />
      </PageTransition>
    )
  }

  const meta = TYPE_META[q.type] || { icon: Circle, label: q.type }

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl">
        {paper.resumed && (
          <p className="game-text mb-4 flex items-start gap-2 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary">
            <Save size={15} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
            Welcome back — this is the same paper you started, with your answers still in it.
          </p>
        )}

        {/* ---- header: where they are, and how much is left ---- */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading truncate text-xl font-extrabold">
              Final test
              <span className="ml-2 text-sm font-semibold text-text-secondary">
                Try {paper.attemptNumber} of 3
              </span>
            </h1>
            <p className="game-text text-sm text-text-secondary">
              {answeredCount} of {questions.length} answered · {paper.passMark} of {paper.total} to
              pass
            </p>
          </div>
          <span
            className="game-text rounded-full border border-k-border bg-surface/60 px-3 py-1 text-xs text-text-secondary"
            aria-live="polite"
          >
            {saving ? 'Saving…' : 'Answers saved'}
          </span>
        </div>

        <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-surface">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-turmeric to-accent"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={reduce ? { duration: 0 } : undefined}
          />
        </div>

        <Navigator
          questions={questions}
          answers={answers}
          current={index}
          onPick={go}
        />

        {/* ---- the question ---- */}
        <AnimatePresence mode="wait">
          <motion.div
            key={q.id}
            initial={reduce ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <Card hover={false} className="mt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="game-text text-sm text-text-secondary">
                  Question {index + 1} of {questions.length} · {q.sectionLabel}
                </span>
                <span className="game-text inline-flex items-center gap-1.5 rounded-full bg-turmeric/15 px-3 py-0.5 text-xs text-turmeric">
                  <meta.icon size={13} aria-hidden="true" />
                  {meta.label} · {q.points} {q.points === 1 ? 'mark' : 'marks'}
                </span>
              </div>

              <h2 className="game-text mb-4 text-lg font-bold leading-snug">{q.prompt}</h2>

              {q.context && (
                <pre className="mb-4 overflow-x-auto rounded-xl border border-k-border bg-malt/40 p-3 font-mono text-sm text-text-primary">
                  {q.context}
                </pre>
              )}

              <AnswerInput
                question={q}
                value={answers[q.id]}
                onChange={(v) => setAnswer(q.id, v)}
              />

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-k-border pt-4">
                <Button
                  variant="secondary"
                  onClick={() => go(index - 1)}
                  disabled={index === 0}
                >
                  <ArrowLeft size={16} className="mr-1.5" aria-hidden="true" /> Back
                </Button>

                {index + 1 < questions.length ? (
                  <Button onClick={() => go(index + 1)}>
                    Next <ArrowRight size={16} className="ml-1.5" aria-hidden="true" />
                  </Button>
                ) : (
                  <Button onClick={() => setConfirming(true)}>
                    <Flag size={16} className="mr-1.5" aria-hidden="true" /> Finish
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Reachable from any question, not just the last one — a pupil who is
            done at question 9 should not have to click through to 24. */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="game-text text-sm text-text-secondary underline decoration-dotted underline-offset-4 transition-colors can-hover:hover:text-turmeric"
          >
            Finish and hand in
          </button>
        </div>

        {confirming && (
          <ConfirmFinish
            unanswered={unanswered}
            total={questions.length}
            submitting={submitting}
            error={submitError}
            onCancel={() => setConfirming(false)}
            onConfirm={finish}
          />
        )}
      </div>
    </PageTransition>
  )
}

/**
 * The question grid.
 *
 * Carries three states, and never a fourth: answered, unanswered, and where
 * you are. It deliberately does NOT show whether an answer was right — that is
 * the whole difference between an exam and the Quiz Arena.
 */
function Navigator({ questions, answers, current, onPick }) {
  return (
    <nav aria-label="Questions on this paper">
      <ul className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => {
          const done = isAnswered(answers[q.id])
          const here = i === current
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => onPick(i)}
                aria-current={here ? 'true' : undefined}
                aria-label={`Question ${i + 1}${done ? ', answered' : ', not answered yet'}`}
                className={`game-text h-8 w-8 rounded-lg border text-xs font-bold transition-colors ${
                  here
                    ? 'border-turmeric bg-turmeric text-malt'
                    : done
                      ? 'border-success/40 bg-success/15 text-success'
                      : 'border-k-border bg-surface/50 text-text-secondary can-hover:hover:border-turmeric'
                }`}
              >
                {i + 1}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function ConfirmFinish({ unanswered, total, submitting, error, onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finish-title"
    >
      <Card hover={false} className="w-full max-w-md">
        <h2 id="finish-title" className="game-text mb-2 text-lg font-bold">
          Hand in your paper?
        </h2>
        {unanswered > 0 ? (
          // Named specifically, because "are you sure?" tells a child nothing.
          // Unanswered questions score zero, and that is worth one more look.
          <p className="game-text mb-4 flex items-start gap-2 text-sm text-text-secondary">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-turmeric" aria-hidden="true" />
            <span>
              You still have{' '}
              <strong className="text-text-primary">
                {unanswered} {unanswered === 1 ? 'question' : 'questions'}
              </strong>{' '}
              with no answer. Those score nothing. Would you like to go back and try them?
            </span>
          </p>
        ) : (
          <p className="game-text mb-4 text-sm text-text-secondary">
            All {total} questions are answered. Once you hand in, this try is finished and cannot
            be changed.
          </p>
        )}

        {error && (
          <p role="alert" className="game-text mb-3 text-sm text-error">
            {error?.data?.message || 'That did not send. Please try again.'}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            {unanswered > 0 ? 'Go back' : 'Keep checking'}
          </Button>
          <Button onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Handing in…' : 'Yes, hand it in'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

/* ========================================================================== */
/* Answer inputs                                                              */
/* ========================================================================== */

function AnswerInput({ question, value, onChange }) {
  switch (question.type) {
    case 'mcq':
      return <McqAnswer question={question} value={value} onChange={onChange} />
    case 'fillblank':
      return <BlankAnswer value={value} onChange={onChange} />
    case 'coding':
      return <CodeAnswer question={question} value={value} onChange={onChange} />
    case 'task':
      return <TaskAnswer question={question} value={value} onChange={onChange} />
    default:
      return <BlankAnswer value={value} onChange={onChange} />
  }
}

/**
 * Multiple choice.
 *
 * The A/B/C/D letters label POSITIONS, not questions — the server shuffles the
 * options per attempt, so the letter a pupil sees is not the letter the next
 * pupil sees for the same question. That is the point of the shuffle, and it is
 * also why the answer sent back is the position: the server maps it to its own
 * order when marking.
 */
function McqAnswer({ question, value, onChange }) {
  const options = question.options || []
  const name = `q-${question.id}`

  return (
    <fieldset>
      <legend className="sr-only">Choose one answer</legend>
      <div className="space-y-2.5">
        {options.map((opt, i) => {
          const picked = Number(value) === i && isAnswered(value)
          return (
            <label
              key={i}
              className={`game-text flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-[background-color,border-color] duration-200 ${
                picked
                  ? 'border-turmeric bg-turmeric/15'
                  : 'border-k-border bg-surface/50 can-hover:hover:border-turmeric/60'
              }`}
            >
              {/* A real radio, visually hidden — so arrow keys, screen readers
                  and form semantics all work without reimplementing them. */}
              <input
                type="radio"
                name={name}
                value={i}
                checked={picked}
                onChange={() => onChange(i)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                  picked ? 'bg-turmeric text-malt' : 'bg-malt text-text-secondary'
                }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1 text-text-primary">{opt}</span>
              {picked && <CheckCircle2 size={18} className="shrink-0 text-turmeric" aria-hidden="true" />}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function BlankAnswer({ value, onChange }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type your answer"
      aria-label="Your answer"
      autoComplete="off"
      spellCheck="false"
      className="game-text w-full rounded-xl border border-k-border bg-surface/60 px-4 py-3 font-mono text-text-primary outline-none transition-colors focus:border-turmeric"
    />
  )
}

/**
 * A coding answer.
 *
 * A deliberately plain editor rather than the Monaco the rest of the app uses.
 * Monaco is a lazily-loaded chunk, and a school network that stalls it mid-exam
 * would leave a pupil unable to answer a 40-mark question on an attempt they
 * have already spent. A textarea cannot fail to arrive.
 *
 * Tab inserts spaces instead of leaving the field, which is the one thing a
 * bare textarea gets badly wrong for code.
 */
function CodeAnswer({ question, value, onChange }) {
  const seeded = useRef(false)
  useEffect(() => {
    // Starter code goes in once, and only if the pupil has nothing there — a
    // resumed attempt must never have its work overwritten by the template.
    if (seeded.current) return
    seeded.current = true
    if (shouldSeedStarter(value, question.starterCode)) onChange(question.starterCode)
  }, [question.starterCode, value, onChange])

  const onKeyDown = (e) => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const el = e.target
    const { value: next, caret } = insertIndent(el.value, el.selectionStart, el.selectionEnd)
    onChange(next)
    // Restore the caret after the inserted spaces — otherwise it snaps to the
    // start of the line and the answer gets typed backwards.
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = caret
    })
  }

  return (
    <div>
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={12}
        spellCheck="false"
        autoComplete="off"
        aria-label="Your code"
        placeholder="Write your code here"
        className="game-text w-full resize-y rounded-xl border border-k-border bg-malt/50 p-4 font-mono text-sm leading-relaxed text-text-primary outline-none transition-colors focus:border-turmeric"
      />

      {/* The visible examples only. The hidden tests are what stop an answer
          that just prints what it was shown, so they are not sent here. */}
      {(question.examples || []).length > 0 && (
        <div className="mt-3 rounded-xl border border-k-border bg-surface/50 p-3">
          <p className="game-text mb-2 text-xs font-bold uppercase tracking-wide text-text-secondary">
            Your code should do this
          </p>
          <ul className="space-y-2">
            {question.examples.map((ex, i) => (
              <li key={i} className="font-mono text-xs text-text-secondary">
                {ex.stdin ? (
                  <>
                    <span className="text-text-secondary/70">input</span> {ex.stdin}{' '}
                    <span className="text-text-secondary/70">→</span>{' '}
                  </>
                ) : (
                  <span className="text-text-secondary/70">prints </span>
                )}
                <span className="text-success">{ex.expectedOutput}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function TaskAnswer({ question, value, onChange }) {
  return (
    <div>
      {question.brief && (
        <p className="game-text mb-3 rounded-xl border border-k-border bg-surface/50 p-3 text-sm text-text-secondary">
          {question.brief}
        </p>
      )}
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={14}
        spellCheck="false"
        aria-label="Your work"
        placeholder="Write your answer here"
        className="game-text w-full resize-y rounded-xl border border-k-border bg-malt/50 p-4 font-mono text-sm leading-relaxed text-text-primary outline-none transition-colors focus:border-turmeric"
      />
    </div>
  )
}

/* ========================================================================== */
/* 3. Result                                                                  */
/* ========================================================================== */

function Result({ slug, result, onRetake }) {
  const {
    score,
    total,
    passMark,
    passed,
    percent,
    breakdown = {},
    attemptsLeft,
    awaitingReview,
  } = result

  const sections = Object.entries(breakdown)

  return (
    <PageTransition>
      {passed && <Confetti pieces={140} />}
      <div className="mx-auto max-w-xl">
        <Mascot
          size={120}
          message={
            passed
              ? `You scored ${score} out of ${total}. You passed!`
              : `You scored ${score} out of ${total}. ${
                  attemptsLeft > 0 ? 'Have another go when you are ready.' : 'Ask your teacher for help.'
                }`
          }
        />

        <Card className="mt-8" hover={false} glow={passed}>
          <h1
            className={`game-text mb-1 text-center text-3xl font-bold ${
              passed ? 'text-success' : 'text-turmeric'
            }`}
          >
            {passed ? 'Course complete!' : 'Not this time'}
          </h1>
          <p className="game-text mb-6 text-center text-sm text-text-secondary">
            {score} of {total} · {percent}% · {passMark} needed to pass
          </p>

          {/* A single bar against the pass mark, so "how close was I?" is
              answerable at a glance rather than by arithmetic. */}
          <div className="relative mb-6 h-3 w-full overflow-hidden rounded-full bg-surface">
            <div
              className={`h-full rounded-full ${passed ? 'bg-success' : 'bg-turmeric'}`}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
            <span
              className="absolute inset-y-0 w-0.5 bg-text-secondary/60"
              style={{ left: `${passMarkPosition(passMark, total)}%` }}
              aria-hidden="true"
            />
          </div>

          {awaitingReview && (
            <p className="game-text mb-4 flex items-start gap-2 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary">
              <Clock size={15} className="mt-0.5 shrink-0 text-turmeric" aria-hidden="true" />
              Some of your answers need a teacher to look at them, so this mark may still change.
            </p>
          )}

          {/* Per-section marks — where it went well and where it did not.
              Never which question was wrong: there may be another attempt, and
              the paper is drawn from a bank that other pupils are still sitting. */}
          {sections.length > 0 && (
            <div className="mb-6 space-y-2">
              <p className="game-text text-xs font-bold uppercase tracking-wide text-text-secondary">
                How you did in each part
              </p>
              {sections.map(([id, part]) => (
                <div key={id} className="flex items-center gap-3">
                  <span className="game-text w-28 shrink-0 truncate text-sm capitalize text-text-secondary">
                    {id}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-turmeric to-accent"
                      style={{
                        width: `${part.possible ? (part.awarded / part.possible) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="game-text w-16 shrink-0 text-right font-mono text-sm text-text-primary">
                    {part.awarded}/{part.possible}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <Link to="/courses">
              <Button variant="secondary" className="w-full sm:w-auto">
                <Home size={16} className="mr-1.5" aria-hidden="true" /> Your journey
              </Button>
            </Link>
            {!passed && attemptsLeft > 0 && (
              <Button onClick={onRetake} className="w-full sm:w-auto">
                <RotateCcw size={16} className="mr-1.5" aria-hidden="true" />
                Try again ({attemptsLeft} left)
              </Button>
            )}
            {passed && (
              <Link to="/courses">
                <Button className="w-full sm:w-auto">
                  Next course <ArrowRight size={16} className="ml-1.5" aria-hidden="true" />
                </Button>
              </Link>
            )}
          </div>

          <p className="sr-only">
            Final test for {slug}: scored {score} out of {total}, {passed ? 'passed' : 'not passed'}.
          </p>
        </Card>
      </div>
    </PageTransition>
  )
}
