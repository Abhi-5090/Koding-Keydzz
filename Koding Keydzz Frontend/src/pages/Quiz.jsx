import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  CircleDot,
  Shuffle,
  Pencil,
  Link2,
  Code,
  CheckCircle2,
  Zap,
  Coins,
  Home,
  HelpCircle,
  Brain,
  Flag,
  Check,
  ArrowLeft,
  ArrowRight,
  Trophy,
  GripVertical,
} from 'lucide-react'
import {
  useGetQuizzesQuery,
  useGetQuizQuery,
  useSubmitQuizMutation,
} from '../features/quiz/quizApi'
import PageTransition from '../components/layout/PageTransition'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Confetti from '../components/ui/Confetti'
import Mascot from '../components/ui/Mascot'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/QueryState'

const TYPE_META = {
  mcq: { icon: CircleDot, label: 'Multiple Choice' },
  dragdrop: { icon: Shuffle, label: 'Order the Steps' },
  fillblank: { icon: Pencil, label: 'Fill the Blank' },
  match: { icon: Link2, label: 'Match Pairs' },
  coding: { icon: Code, label: 'Code It' },
}

const EASE_OUT = [0.23, 1, 0.32, 1]
const idOf = (q) => String(q?._id ?? q?.id ?? '')

// Fisher–Yates shuffle (used to scramble drag-drop steps so the initial
// order isn't already the answer).
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Is a collected answer complete enough to advance? The shape differs per type:
 * mcq → option index, fillblank → string(s), dragdrop → ordered array,
 * match → { left: right } object map.
 */
function isAnswered(q, ans) {
  // Missing-data ordering/matching questions have nothing to answer → skippable.
  if ((q?.type === 'dragdrop' || q?.type === 'match') && !(q.options || []).length) {
    return true
  }
  if (ans === undefined || ans === null) return false
  switch (q?.type) {
    case 'mcq':
      return ans !== ''
    case 'dragdrop':
      return Array.isArray(ans) && ans.length > 0
    case 'match':
      return (
        typeof ans === 'object' &&
        !Array.isArray(ans) &&
        (q.options || []).every((l) => String(ans[l] ?? '').trim() !== '')
      )
    case 'fillblank': {
      const vals = Array.isArray(ans) ? ans : [ans]
      return vals.length > 0 && vals.every((v) => String(v ?? '').trim() !== '')
    }
    default:
      return String(ans ?? '').trim() !== ''
  }
}

export default function Quiz() {
  // Selected quiz drives whether we show the card grid or the play screen.
  const [activeId, setActiveId] = useState(null)

  if (activeId) {
    return <QuizPlay quizId={activeId} onExit={() => setActiveId(null)} />
  }
  return <QuizArena onPick={setActiveId} />
}

/* ----------------------------- Card grid ----------------------------- */

function QuizArena({ onPick }) {
  const query = useGetQuizzesQuery()
  const quizzes = useMemo(
    () => (Array.isArray(query.data) ? query.data : []),
    [query.data]
  )

  if (query.isLoading) {
    return <PageTransition><LoadingState message="Loading the Quiz Arena…" /></PageTransition>
  }
  if (query.isError) {
    return <PageTransition><ErrorState onRetry={query.refetch} /></PageTransition>
  }

  return (
    <PageTransition>
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold inline-flex items-center gap-2">
          <AnimatedIcon icon={Brain} size={30} className="text-turmeric" animation="float" glow />
          Quiz Arena
        </h1>
        <p className="text-text-secondary">
          Pick a quiz, answer the questions, and earn XP for your account!
        </p>
      </div>

      {quizzes.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="No quizzes yet"
          message="Quizzes are on their way — check back soon to test your skills!"
          action={<Link to="/dashboard"><Button variant="secondary"><span className="inline-flex items-center gap-2"><Home size={18} /> Back to Dashboard</span></Button></Link>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz, i) => {
            const id = idOf(quiz)
            const completed = !!(quiz.completed || quiz.attempted || quiz.passed)
            const best =
              quiz.bestScore ?? quiz.best ?? (quiz.passed ? quiz.score : null)
            // world/lesson come back as objects from the API — render their string fields only.
            const topic =
              quiz.world?.name ||
              quiz.lesson?.title ||
              (typeof quiz.world === 'string' ? quiz.world : null) ||
              (typeof quiz.lesson === 'string' ? quiz.lesson : null) ||
              quiz.topic ||
              null
            const TypeIcon = TYPE_META[quiz.type]?.icon || HelpCircle
            return (
              <motion.button
                key={id || i}
                type="button"
                onClick={() => onPick(id)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.04, ease: EASE_OUT }}
                whileHover={{ y: -6 }}
                whileTap={{ scale: 0.97 }}
                className="group relative flex flex-col rounded-2xl border-2 border-k-border bg-card p-5 text-left transition-[border-color,box-shadow] duration-200 can-hover:hover:border-turmeric can-hover:hover:shadow-golden-glow"
              >
                {completed && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-success/50 bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase text-success game-text">
                    <Trophy size={11} /> {best != null ? `Best ${best}` : 'Done'}
                  </span>
                )}
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-turmeric/15 text-turmeric transition-transform duration-200 can-hover:group-hover:scale-110">
                  <TypeIcon size={22} />
                </div>
                <h3 className="game-text mb-1 pr-12 text-lg font-bold text-text-primary">
                  {quiz.title || 'Untitled Quiz'}
                </h3>
                {topic && (
                  <p className="mb-3 text-xs text-text-secondary">{topic}</p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  <span className="game-text inline-flex items-center gap-1 rounded-full bg-surface/70 px-2.5 py-1 text-xs text-text-secondary">
                    <HelpCircle size={13} /> {quiz.questionCount ?? quiz.questions?.length ?? '?'} Q
                  </span>
                  <span className="game-text inline-flex items-center gap-1 rounded-full bg-turmeric/15 px-2.5 py-1 text-xs text-turmeric">
                    <Zap size={13} /> +{quiz.xpReward ?? 50} XP
                  </span>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}
    </PageTransition>
  )
}

/* ------------------------------ Play one ------------------------------ */

function QuizPlay({ quizId, onExit }) {
  const quizQuery = useGetQuizQuery(quizId, { skip: !quizId })
  const quiz = quizQuery.data
  const [submitQuiz, { isLoading: submitting }] = useSubmitQuizMutation()

  const questions = useMemo(() => quiz?.questions || [], [quiz])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({}) // questionId -> answer
  const [result, setResult] = useState(null)

  if (quizQuery.isLoading) {
    return <PageTransition><LoadingState message="Loading the quiz…" /></PageTransition>
  }
  if (quizQuery.isError) {
    return <PageTransition><ErrorState onRetry={quizQuery.refetch} /></PageTransition>
  }
  if (!questions.length) {
    return (
      <PageTransition>
        <EmptyState
          icon={HelpCircle}
          title="This quiz has no questions"
          message="Try another quiz from the Arena."
          action={<Button variant="secondary" onClick={onExit}><span className="inline-flex items-center gap-2"><ArrowLeft size={18} /> Back to Arena</span></Button>}
        />
      </PageTransition>
    )
  }

  // ---- Result screen ----
  if (result) {
    return (
      <PageTransition>
        {result.passed && <Confetti key="final" pieces={100} />}
        <div className="mx-auto max-w-lg text-center">
          <Mascot
            size={120}
            message={
              result.passed
                ? `You scored ${result.correctCount}/${questions.length}! Amazing work!`
                : `You got ${result.correctCount}/${questions.length}. Keep practicing, hero!`
            }
          />
          <Card className="mt-8" glow>
            <h1 className="game-text mb-4 text-3xl font-bold text-turmeric">
              {result.passed ? 'Quiz Complete!' : 'Quiz Finished'}
            </h1>
            <div className="mb-6 flex justify-center gap-6">
              <Reward icon={CheckCircle2} iconClass="text-success" value={`${result.correctCount}/${questions.length}`} label="Correct" />
              <Reward icon={Zap} iconClass="text-turmeric" value={`+${result.xpEarned ?? 0}`} label="XP" />
              <Reward icon={Coins} iconClass="text-accent" value={`+${result.coinsEarned ?? 0}`} label="Coins" />
            </div>
            {result.alreadyAttempted && (
              <p className="mb-4 text-xs text-text-secondary">
                You already completed this quiz before, so no new rewards this time.
              </p>
            )}
            <div className="flex justify-center gap-3">
              <Button onClick={onExit}>
                <span className="inline-flex items-center gap-2"><ArrowLeft size={18} /> Back to Arena</span>
              </Button>
              <Link to="/dashboard">
                <Button variant="secondary"><span className="inline-flex items-center gap-2"><Home size={18} /> Dashboard</span></Button>
              </Link>
            </div>
            <p className="sr-only">Score {result.score}/{result.total || questions.length}</p>
          </Card>
        </div>
      </PageTransition>
    )
  }

  // ---- Question flow (graded by the backend on submit) ----
  const q = questions[index]
  const qid = idOf(q)
  const setAnswer = (val) => setAnswers((a) => ({ ...a, [qid]: val }))
  const answered = isAnswered(q, answers[qid])

  const next = async () => {
    if (index + 1 < questions.length) {
      setIndex((i) => i + 1)
      return
    }
    try {
      // Submitting invalidates the Dashboard tag so the topbar XP/coins refresh.
      const res = await submitQuiz({ id: quizId, answers }).unwrap()
      setResult(res)
    } catch {
      setResult({ correctCount: 0, total: questions.length, passed: false, xpEarned: 0, coinsEarned: 0 })
    }
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onExit}
            className="game-text inline-flex items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
          >
            <ArrowLeft size={16} /> Arena
          </button>
          <span className="rounded-full border border-k-border bg-surface/60 px-3 py-1 text-sm text-turmeric game-text">
            {index + 1} / {questions.length}
          </span>
        </div>

        <h1 className="font-heading mb-4 inline-flex items-center gap-2 text-2xl font-extrabold">
          <AnimatedIcon icon={Brain} size={26} className="text-turmeric" animation="float" glow />
          {quiz.title || 'Quiz Arena'}
        </h1>

        <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-surface">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-turmeric to-accent"
            animate={{ width: `${((index + 1) / questions.length) * 100}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={qid} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <Card hover={false}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-text-secondary">Question {index + 1} of {questions.length}</span>
                <span className="game-text inline-flex items-center gap-1.5 rounded-full bg-turmeric/15 px-3 py-0.5 text-xs text-turmeric">
                  {TYPE_META[q.type]?.icon && <AnimatedIcon icon={TYPE_META[q.type].icon} size={14} className="text-turmeric" animation="none" />}
                  {TYPE_META[q.type]?.label || q.type}
                </span>
              </div>
              <h2 className="game-text mb-6 mt-2 text-xl font-bold">{q.prompt || q.question}</h2>

              <QuestionInput
                question={q}
                value={answers[qid]}
                onChange={setAnswer}
              />

              <div className="mt-5 flex justify-end">
                <Button onClick={next} disabled={!answered || submitting}>
                  {submitting ? (
                    'Submitting…'
                  ) : index + 1 >= questions.length ? (
                    <span className="inline-flex items-center gap-2"><Flag size={18} /> Finish</span>
                  ) : (
                    <span className="inline-flex items-center gap-2">Next <ArrowRight size={18} /></span>
                  )}
                </Button>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </PageTransition>
  )
}

/* --------------------------- Per-type inputs --------------------------- */
// The backend serves a sanitized question ({ _id, type, prompt, options, points })
// and grades server-side. Each input below collects the answer in the EXACT
// shape quizService.gradeQuestion expects for its type.

function QuestionInput({ question, value, onChange }) {
  switch (question.type) {
    case 'mcq':
      return Array.isArray(question.options) && question.options.length ? (
        <McqInput question={question} value={value} onChange={onChange} />
      ) : (
        <FreeTextInput value={value} onChange={onChange} />
      )
    case 'fillblank':
      return <FillBlankInput question={question} value={value} onChange={onChange} />
    case 'dragdrop':
      return question.options?.length ? (
        <DragDropInput key={idOf(question)} question={question} value={value} onChange={onChange} />
      ) : (
        <MissingData note="This ordering question is missing its steps." />
      )
    case 'match':
      return question.options?.length ? (
        <MatchInput question={question} value={value} onChange={onChange} />
      ) : (
        <MissingData note="This matching question is missing its pairs." />
      )
    // coding + any unknown type: a plain text area (grader normalizes the string).
    default:
      return <FreeTextInput value={value} onChange={onChange} />
  }
}

// mcq → sends the selected option's INDEX (the grader accepts index or value).
function McqInput({ question, value, onChange }) {
  return (
    <div className="space-y-3">
      {question.options.map((opt, i) => {
        const selected = value === i
        return (
          <motion.button
            key={i}
            type="button"
            whileHover={{ scale: 1.02, x: 4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(i)}
            aria-pressed={selected}
            className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-[background-color,border-color,color,box-shadow] duration-200 game-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric ${
              selected ? 'border-turmeric bg-turmeric/15 text-turmeric' : 'border-k-border bg-surface/50 can-hover:hover:border-turmeric'
            }`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-malt text-sm font-bold">
              {String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1">{opt}</span>
            {selected && <AnimatedIcon icon={Check} size={18} className="text-turmeric" animation="pop" />}
          </motion.button>
        )
      })}
    </div>
  )
}

// fillblank → sends the typed string (grader trims + lowercases). Renders the
// blank inline where the prompt's "____" marker sits; single-blank is the norm.
function FillBlankInput({ question, value, onChange }) {
  const parts = useMemo(() => String(question.prompt || '').split('____'), [question])
  const blanks = Math.max(1, parts.length - 1)
  const [vals, setVals] = useState(() => {
    if (Array.isArray(value)) return value.slice(0, blanks)
    if (typeof value === 'string') return [value, ...Array(Math.max(0, blanks - 1)).fill('')].slice(0, blanks)
    return Array(blanks).fill('')
  })

  const setVal = (i, v) => {
    const next = vals.map((x, idx) => (idx === i ? v : x))
    setVals(next)
    onChange(next.length === 1 ? next[0] : next)
  }

  if (parts.length > 1) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-k-border bg-malt p-4 font-mono text-sm">
        {parts.map((part, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {part && <span className="text-text-secondary">{part}</span>}
            {i < blanks && (
              <input
                value={vals[i] ?? ''}
                onChange={(e) => setVal(i, e.target.value)}
                placeholder="?"
                aria-label={`Blank ${i + 1}`}
                className="w-32 rounded-lg border-2 border-k-border bg-card px-2 py-1 text-center text-turmeric outline-none transition-colors focus:border-turmeric focus-visible:ring-2 focus-visible:ring-turmeric"
              />
            )}
          </span>
        ))}
      </div>
    )
  }
  return (
    <input
      value={vals[0] ?? ''}
      onChange={(e) => setVal(0, e.target.value)}
      placeholder="Type your answer…"
      aria-label="Your answer"
      className="w-full rounded-xl border-2 border-k-border bg-surface/50 px-4 py-3 text-turmeric outline-none transition-colors focus:border-turmeric focus-visible:ring-2 focus-visible:ring-turmeric"
    />
  )
}

// dragdrop → sends the ordered array of option strings. Steps are shuffled for
// display; the grader compares the submitted order to the correct order.
function DragDropInput({ question, value, onChange }) {
  const options = useMemo(() => question.options || [], [question])
  const [order, setOrder] = useState(() => {
    const base =
      Array.isArray(value) && value.length === options.length ? value : shuffle(options)
    return base.map((label, i) => ({ id: `${i}::${label}`, label }))
  })

  // Seed the parent answer on mount so "Next" enables even without a reorder.
  useEffect(() => {
    onChange(order.map((o) => o.label))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handle = (next) => {
    setOrder(next)
    onChange(next.map((o) => o.label))
  }

  return (
    <div>
      <p className="mb-3 text-sm text-text-secondary">Drag the steps into the correct order:</p>
      <Reorder.Group axis="y" values={order} onReorder={handle} className="space-y-2.5">
        {order.map((item, i) => (
          <Reorder.Item
            key={item.id}
            value={item}
            whileDrag={{ scale: 1.02 }}
            className="game-text flex cursor-grab items-center gap-3 rounded-xl border-2 border-k-border bg-surface/50 px-4 py-3 transition-colors duration-200 can-hover:hover:border-turmeric active:cursor-grabbing"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-malt text-sm font-bold text-turmeric">
              {i + 1}
            </span>
            <span className="flex-1">{item.label}</span>
            <GripVertical size={18} className="text-text-secondary" />
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  )
}

// match → sends a { left: right } object map (grader is order-independent).
// The sanitized payload only ships the LEFT items (question.options); the
// right-side candidates live in the stripped correctAnswer, so we collect the
// match as free text per left item rather than a two-column click-to-pair.
function MatchInput({ question, value, onChange }) {
  const lefts = question.options || []
  const map = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const setPair = (left, right) => onChange({ ...map, [left]: right })
  return (
    <div>
      <p className="mb-3 text-sm text-text-secondary">Type the match for each item:</p>
      <div className="space-y-2.5">
        {lefts.map((left, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-xl border-2 border-k-border bg-surface/50 p-3 sm:flex-row sm:items-center"
          >
            <span className="game-text flex-1 font-semibold text-text-primary">{left}</span>
            <ArrowRight size={16} className="hidden shrink-0 text-text-secondary sm:block" />
            <input
              value={map[left] ?? ''}
              onChange={(e) => setPair(left, e.target.value)}
              placeholder="Its match…"
              aria-label={`Match for ${left}`}
              className="flex-1 rounded-lg border-2 border-k-border bg-card px-3 py-2 text-turmeric outline-none transition-colors focus:border-turmeric focus-visible:ring-2 focus-visible:ring-turmeric"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function FreeTextInput({ value, onChange }) {
  return (
    <textarea
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      placeholder="Type your answer…"
      className="w-full rounded-xl border-2 border-k-border bg-surface/50 px-4 py-3 font-mono text-sm text-turmeric outline-none transition-colors focus:border-turmeric focus-visible:ring-2 focus-visible:ring-turmeric"
    />
  )
}

function MissingData({ note }) {
  return (
    <div className="rounded-xl border border-k-border bg-surface/50 px-4 py-6 text-center text-sm text-text-secondary">
      {note} You can skip ahead.
    </div>
  )
}

function Reward({ icon, iconClass, value, label }) {
  return (
    <div className="flex flex-col items-center text-center">
      <AnimatedIcon icon={icon} size={32} className={iconClass} animation="pop" glow />
      <div className="game-text mt-1 text-xl font-bold text-turmeric">{value}</div>
      <div className="text-xs text-text-secondary">{label}</div>
    </div>
  )
}
