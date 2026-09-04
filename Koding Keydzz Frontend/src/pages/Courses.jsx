import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Lock,
  Sparkles,
  Trophy,
  BookOpen,
  HelpCircle,
  Gamepad2,
  ShieldCheck,
} from 'lucide-react'
import { useGetCoursesQuery, useStartCourseMutation } from '../features/courses/coursesApi'
import PageTransition from '../components/layout/PageTransition'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import { EmptyState, ErrorState } from '../components/ui/QueryState'
import { useRevealIn, useGrowBar } from '../motion/hooks'
import { cssVar, ON_TINT } from '../theme/tokens'

/**
 * THE COURSE LADDER, as a pupil sees it.
 *
 * Four tracks in order, one open at a time. The design job here is to make the
 * locked ones feel like something to climb towards rather than a wall — so a
 * locked card still shows its name, its subject and exactly what unlocks it,
 * instead of a padlock and nothing else. A child who cannot tell what they are
 * working towards has no reason to keep going.
 *
 * Every bit of state — lock, status, readiness, the reason — comes from the
 * server. Nothing is recomputed here; see features/courses/coursesApi.js.
 */
export default function Courses() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useGetCoursesQuery()
  const [startCourse, { isLoading: starting }] = useStartCourseMutation()

  // 90ms stagger: long enough to read as a sequence down the ladder, short
  // enough that the last card has settled before a child reaches for it.
  const listRef = useRevealIn({ selector: ':scope > *', y: 24, stagger: 0.09 })

  const open = async (course) => {
    if (!course.unlocked) return
    // Idempotent, so firing it on every open is safe — and it is what makes
    // "in progress" a fact about the pupil rather than an admin setting.
    try {
      await startCourse(course.slug).unwrap()
    } catch {
      /* Starting is bookkeeping; never block the pupil on it. */
    }
    navigate('/map')
  }

  if (isLoading) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="skeleton h-8 w-56" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 w-full" />
          ))}
        </div>
      </PageTransition>
    )
  }

  if (isError) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-3xl">
          {/* The shared error state, so a dropped connection looks the same
              here as everywhere else in the app. */}
          <ErrorState
            message="We couldn't load your courses. Nothing was lost — try again."
            onRetry={refetch}
          />
        </div>
      </PageTransition>
    )
  }

  const courses = data?.items || []
  const passMark = data?.passMark ?? 150
  const total = data?.total ?? 200

  if (courses.length === 0) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-3xl">
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            message="Your school is still setting up. Check back soon!"
          />
        </div>
      </PageTransition>
    )
  }

  const done = courses.filter((c) => c.passed).length

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="game-text text-3xl font-extrabold text-turmeric">Your journey</h1>
          {/* Counts what is ON SCREEN, not a hardcoded four. Only courses with
              content are published, so promising "four languages" above a
              single card is a promise the page visibly does not keep. */}
          <p className="game-text mt-1 text-text-secondary">
            {done === courses.length
              ? 'Every course complete. You are a Koding Keydzz champion!'
              : done === 0
                ? courses.length === 1
                  ? 'Finish this course to unlock the next language.'
                  : `${courses.length} languages to master. Finish one to unlock the next.`
                : `${done} of ${courses.length} complete — keep climbing.`}
          </p>
        </header>

        <div ref={listRef} className="space-y-4">
          {courses.map((course, i) => (
            <CourseCard
              key={course.slug}
              course={course}
              step={i + 1}
              steps={courses.length}
              passMark={passMark}
              total={total}
              onOpen={() => open(course)}
              busy={starting}
            />
          ))}
        </div>
      </div>
    </PageTransition>
  )
}

/* -------------------------------------------------------------------------- */

function CourseCard({ course, step, steps, passMark, total, onOpen, busy }) {
  const { status, tint, readiness } = course
  const locked = !course.unlocked
  const passed = course.passed
  // Everything done and not yet passed — the one state where the exam is the
  // point of the card.
  const finalTestReady = Boolean(readiness?.finalTestUnlocked) && !passed

  return (
    <Card
      hover={!locked}
      /**
       * A locked card is dimmed WITHOUT container opacity.
       *
       * `opacity-70` on the card multiplied down every child's contrast: text
       * that passes 4.60:1 on a full-opacity card drops to about 3.2:1 inside
       * a 70%-opacity parent, and an axe audit flagged every locked card on
       * this page. Container opacity is the one dimming technique that cannot
       * be made accessible, because it degrades text and background together.
       *
       * The "locked" state was never carried by the dimming anyway — there is
       * a Locked pill and a sentence saying what unlocks it. So the card keeps
       * a muted BORDER instead, and the text stays readable.
       */
      className={`relative overflow-hidden ${locked ? 'border-k-border/60' : ''}`}
      style={{ borderColor: locked ? undefined : `${tint}66` }}
    >
      {/* The rail carries the course's own colour, so each track is
          recognisable at a glance before any text is read. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: locked ? cssVar('muted', 0.4) : tint }}
      />

      <div className="flex flex-col gap-4 pl-3 sm:flex-row sm:items-start">
        {/* Step number — the ladder is a real sequence, so the position is
            information rather than decoration. */}
        <div
          className="game-text flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-extrabold tabular-nums"
          style={{
            background: locked ? cssVar('surface') : tint,
            color: locked ? cssVar('muted') : ON_TINT,
          }}
          aria-hidden="true"
        >
          {passed ? <Check size={20} strokeWidth={3} /> : step}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className="game-text text-xl font-bold"
              style={{ color: locked ? cssVar('muted') : tint }}
            >
              {course.title}
            </h2>
            <StatusPill status={status} tint={tint} />
            <span className="game-text text-xs text-text-secondary/70">
              Step {step} of {steps}
            </span>
          </div>

          {course.tagline && (
            <p className="game-text mt-0.5 text-sm text-text-secondary">{course.tagline}</p>
          )}

          {/* A locked card still says what it is and what opens it. A bare
              padlock tells a child nothing they can act on. */}
          {locked && (
            <p className="game-text mt-3 flex items-start gap-2 rounded-xl border border-k-border bg-surface/50 px-3 py-2 text-sm text-text-secondary">
              <Lock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{course.lockedReason}</span>
            </p>
          )}

          {passed && (
            <p className="game-text mt-3 flex items-center gap-2 text-sm text-success">
              <Trophy size={15} aria-hidden="true" />
              Passed with {course.bestScore} of {total}
            </p>
          )}

          {/* Readiness: three strands, each named. "3 quizzes left" is
              something a child can act on; a single percentage is not. */}
          {readiness && (
            <div className="mt-4 space-y-3">
              <Strand
                icon={BookOpen}
                label="Lessons"
                strand={readiness.lessons}
                tint={tint}
              />
              <Strand icon={HelpCircle} label="Quizzes" strand={readiness.quizzes} tint={tint} />
              <Strand
                icon={Gamepad2}
                label="Game levels"
                strand={readiness.gameLevels}
                tint={tint}
              />

              <p className="game-text flex items-start gap-2 pt-1 text-xs text-text-secondary/80">
                <Sparkles size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                {readiness.finalTestUnlocked ? (
                  <span className="text-success">
                    Final test unlocked — score {passMark} of {total} to finish this course.
                  </span>
                ) : (
                  <span>
                    Finish everything above to unlock the final test ({passMark} of {total} to
                    pass, {course.attemptsLeft} tries left).
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

      </div>

      {/* The action sits at the FOOT of the card rather than beside the
          progress block. Vertically centred next to three progress rows it
          read as part of them, and crowded the "0 / 16" figures on a narrow
          column. At the bottom it is unmistakably the card's one action. */}
      {!locked && (
        <div className="mt-4 flex flex-col-reverse gap-2 border-t border-k-border pt-4 pl-3 sm:flex-row sm:justify-end">
          <Button
            variant={finalTestReady ? 'secondary' : 'primary'}
            onClick={onOpen}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            {passed ? 'Revisit' : status === 'in_progress' ? 'Continue' : 'Start'}
            <ArrowRight size={16} className="ml-1.5" />
          </Button>

          {/* Once the three strands are done the final test becomes the card's
              PRIMARY action, and revisiting the content steps back to
              secondary. The pupil has finished the course; the next thing to do
              is sit the paper, and it should not be the quieter of two
              buttons. */}
          {finalTestReady && (
            <Link to={`/courses/${course.slug}/final-test`} className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">
                <ShieldCheck size={16} className="mr-1.5" aria-hidden="true" />
                Sit the final test
              </Button>
            </Link>
          )}
        </div>
      )}
    </Card>
  )
}

/* -------------------------------------------------------------------------- */

function StatusPill({ status, tint }) {
  const map = {
    completed: { label: 'Complete', className: 'bg-success/15 text-success' },
    in_progress: { label: 'In progress', className: '' },
    available: { label: 'Ready to start', className: '' },
    /**
     * Full opacity, not /70.
     *
     * This pill sits on `bg-surface`, which is lighter than a card, so muted
     * text at /70 measures 4.16:1 there and fails — while the same value
     * passes at 4.60:1 on a card. An opacity that is safe on one ground is not
     * automatically safe on another, and a status pill is exactly the text a
     * pupil needs to read.
     */
    locked: { label: 'Locked', className: 'bg-surface text-text-secondary' },
  }
  const meta = map[status] || map.locked
  // The two active states wear the course's own colour; the rest use semantic
  // fills, so "complete" and "locked" never depend on which track it is.
  const styled = status === 'in_progress' || status === 'available'

  return (
    <span
      className={`game-text rounded-full px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide ${meta.className}`}
      style={styled ? { background: `${tint}22`, color: tint } : undefined}
    >
      {meta.label}
    </span>
  )
}

function Strand({ icon, label, strand, tint }) {
  const barRef = useGrowBar(strand.total === 0 ? 0 : strand.done / strand.total)

  return (
    <div className="flex items-center gap-3">
      <AnimatedIcon
        icon={icon}
        size={15}
        animation="none"
        className="shrink-0 text-text-secondary"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="game-text text-xs text-text-secondary">{label}</span>
          <span className="game-text tnum text-xs text-text-secondary/70">
            {strand.done} / {strand.total}
            {strand.complete && <Check size={11} className="ml-1 inline text-success" />}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            ref={barRef}
            className="h-full w-full origin-left rounded-full"
            style={{
              background: strand.complete ? cssVar('success') : tint,
              transform: `scaleX(${strand.total === 0 ? 0 : strand.done / strand.total})`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
