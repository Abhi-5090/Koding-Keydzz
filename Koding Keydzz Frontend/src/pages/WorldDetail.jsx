import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Lock, Sparkles, Play, Gamepad2, Brain, ScrollText, GraduationCap, BookOpen, CheckCircle2, Circle, Map } from 'lucide-react'
import { useGetWorldsQuery, useGetDashboardQuery } from '../features/student/studentApi'
import { worldIcon } from '../data/iconMap'
import { worldTheme, buildLearnList } from '../data/worldThemes'
import { getLesson, normalizeTopic } from '../data/lessons'
import { isTopicComplete, markTopicComplete } from '../features/lessons/lessonProgress'
import PageTransition from '../components/layout/PageTransition'
import Button from '../components/ui/Button'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import TopicLessonModal from '../components/lessons/TopicLessonModal'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/QueryState'

const EASE_OUT = [0.23, 1, 0.32, 1]

// Deterministic-ish scatter so decorative elements don't jump every render.
const DECOR_SLOTS = [
  { left: '6%', top: '18%', size: 46, dur: 9 },
  { left: '84%', top: '14%', size: 38, dur: 7.5 },
  { left: '72%', top: '64%', size: 54, dur: 8.5 },
  { left: '14%', top: '70%', size: 34, dur: 6.5 },
  { left: '46%', top: '10%', size: 30, dur: 7 },
  { left: '90%', top: '44%', size: 42, dur: 10 },
  { left: '30%', top: '40%', size: 28, dur: 6 },
]

/**
 * Drifting, themed decorative icons behind the hero. Hardware-accelerated
 * transforms only; calms to a static layer under prefers-reduced-motion.
 */
function ThemedDecor({ icons, tint }) {
  const reduce = useReducedMotion()
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {DECOR_SLOTS.map((slot, i) => {
        const Icon = icons[i % icons.length]
        return (
          <motion.span
            key={i}
            className="absolute will-change-transform"
            style={{
              left: slot.left,
              top: slot.top,
              color: tint,
              opacity: 0.22,
              filter: `drop-shadow(0 0 14px ${tint}66)`,
            }}
            animate={reduce ? {} : { y: [0, -26, 0], rotate: [0, 8, -8, 0] }}
            transition={{ duration: slot.dur, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
          >
            <Icon size={slot.size} />
          </motion.span>
        )
      })}
    </div>
  )
}

export default function WorldDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  const worldsQuery = useGetWorldsQuery()
  const { data: rawWorlds, isLoading, isError, refetch } = worldsQuery
  const { data: dash } = useGetDashboardQuery()

  // Which topic's lesson is open (null = none). Shared-element layoutId keys
  // the fly-to-center animation to the exact card that was tapped.
  const [activeTopic, setActiveTopic] = useState(null)

  // Completed sessions for THIS world, as a Set of NORMALISED topic keys.
  // Seeded from persisted lesson progress; flips live when a lesson finishes.
  const [completed, setCompleted] = useState(() => new Set())

  const playerLevel = dash?.level ?? 1

  const world = useMemo(
    () => (rawWorlds || []).find((w) => w.slug === slug) || null,
    [rawWorlds, slug]
  )

  // Seed / re-seed the completed set from storage whenever the world changes.
  useEffect(() => {
    if (!world) return
    const done = new Set()
    ;(world.topics || []).forEach((t) => {
      if (isTopicComplete(world.slug, t)) done.add(normalizeTopic(t))
    })
    setCompleted(done)
  }, [world])

  // Called when a lesson is completed in the modal: persist + flip the tag live.
  const handleTopicComplete = (topic) => {
    if (!world) return
    markTopicComplete(world.slug, topic)
    setCompleted((prev) => {
      const next = new Set(prev)
      next.add(normalizeTopic(topic))
      return next
    })
  }

  if (isLoading) {
    return (
      <PageTransition>
        <LoadingState message="Opening the world gates…" />
      </PageTransition>
    )
  }
  if (isError) {
    return (
      <PageTransition>
        <ErrorState onRetry={refetch} />
      </PageTransition>
    )
  }
  if (!world) {
    return (
      <PageTransition>
        <EmptyState
          icon={Sparkles}
          title="World not found"
          message="That realm has wandered off the map. Head back and pick another!"
          action={
            <Button onClick={() => navigate('/map')} className="flex items-center gap-2">
              <AnimatedIcon icon={ArrowLeft} size={16} animation="hover" />
              Back to Map
            </Button>
          }
        />
      </PageTransition>
    )
  }

  const theme = worldTheme(world.slug)
  const Icon = worldIcon(world.slug)
  const requiredLevel = world.requiredLevel ?? 1
  const locked = playerLevel < requiredLevel
  const learnList = buildLearnList(world.slug, world.topics)

  // Live "X / N sessions completed" for this world's mastery topics.
  const completedCount = learnList.filter((it) => completed.has(normalizeTopic(it.topic))).length

  // Next world in the coding journey, by `order` from GET /worlds. When this is
  // the last world, there is no next → the button falls back to the World Map.
  const sortedWorlds = [...(rawWorlds || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const curIdx = sortedWorlds.findIndex((w) => w.slug === world.slug)
  const nextWorld = curIdx >= 0 ? sortedWorlds[curIdx + 1] || null : null

  const BackButton = (
    <button
      onClick={() => navigate('/map')}
      className="game-text mb-6 inline-flex items-center gap-2 rounded-xl border border-k-border bg-surface/60 px-4 py-2 text-sm text-text-secondary transition-[color,border-color,background-color] duration-200 can-hover:hover:[border-color:var(--tint)] can-hover:hover:[color:var(--tint)]"
    >
      <AnimatedIcon icon={ArrowLeft} size={16} animation="hover" />
      Back to Map
    </button>
  )

  return (
    <PageTransition>
      {/* World-scoped tint: everything inside reads in this realm's accent via
          `--tint` (focus rings, hover colours). Global chrome sits outside. */}
      <div className="tint-scope" style={{ '--tint': theme.tint }}>
        {BackButton}

      {/* HERO */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className={`relative overflow-hidden rounded-3xl border border-k-border bg-gradient-to-br ${theme.gradient} px-6 py-12 text-center sm:px-10 sm:py-16`}
        style={{ boxShadow: `0 0 48px ${theme.tint}33` }}
      >
        <ThemedDecor icons={theme.icons} tint={theme.tint} />

        <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.1 }}
            className="mb-5 flex h-28 w-28 items-center justify-center rounded-full"
            style={{
              background: `${theme.tint}22`,
              border: `2px solid ${theme.tint}`,
              boxShadow: `0 0 40px ${theme.tint}55`,
            }}
          >
            <AnimatedIcon icon={Icon} size={56} animation={reduce ? 'none' : 'float'} style={{ color: theme.tint }} />
          </motion.div>

          <span className="game-text mb-2 inline-block rounded-full border border-k-border bg-malt/40 px-3 py-1 text-xs uppercase tracking-wide text-text-secondary">
            World {world.order}
          </span>
          <h1 className="font-heading text-4xl font-extrabold sm:text-5xl" style={{ color: theme.tint }}>
            {world.name}
          </h1>
          <p className="game-text mt-3 text-lg text-text-primary/90">{theme.tagline}</p>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-secondary">{theme.intro}</p>

          {locked && (
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-error">
              <AnimatedIcon icon={Lock} size={16} animation="none" className="text-error" />
              Reach Level {requiredLevel} to unlock this realm
            </div>
          )}
        </div>
      </motion.section>

      {locked ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.1 }}
          className="mx-auto mt-8 max-w-lg rounded-3xl border border-k-border bg-card p-8 text-center"
        >
          <div className="mb-3 flex justify-center">
            <AnimatedIcon icon={Lock} size={56} animation={reduce ? 'none' : 'float'} className="text-text-secondary" glow glowColor={`${theme.tint}b3`} />
          </div>
          <h2 className="game-text mb-2 text-xl font-bold" style={{ color: theme.tint }}>This realm is still locked</h2>
          <p className="mb-6 text-sm text-text-secondary">
            Keep coding to reach <span className="font-bold" style={{ color: theme.tint }}>Level {requiredLevel}</span> and the gates of{' '}
            {world.name} will open. You are at Level {playerLevel} — almost there!
          </p>
          <Button tint={theme.tint} onClick={() => navigate('/map')} className="flex w-full items-center justify-center gap-2">
            <AnimatedIcon icon={ArrowLeft} size={16} animation="hover" />
            Back to the Map
          </Button>
        </motion.div>
      ) : (
        <>
          {/* WHAT YOU'LL MASTER — the interactive centerpiece */}
          <section className="mt-10">
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex min-w-0 items-center gap-2">
                <AnimatedIcon icon={GraduationCap} size={22} animation="none" style={{ color: theme.tint }} />
                <h2 className="font-heading text-2xl font-extrabold">What you'll master here</h2>
              </div>
              {learnList.length > 0 && (
                <span
                  className="game-text shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold"
                  style={{
                    borderColor: `${theme.tint}55`,
                    background: completedCount > 0 ? `${theme.tint}18` : 'transparent',
                    color: completedCount > 0 ? theme.tint : undefined,
                  }}
                >
                  <CheckCircle2 size={13} className="shrink-0" style={{ color: theme.tint }} />
                  {completedCount} / {learnList.length} sessions completed
                </span>
              )}
            </div>
            <p className="game-text mb-5 text-sm text-text-secondary">Tap a topic to start learning — each one opens an interactive lesson.</p>

            {learnList.length === 0 ? (
              <p className="text-sm text-text-secondary">New lessons are being prepared for this realm — check back soon!</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {learnList.map((item, i) => {
                  const layoutId = `topic-${world.slug}-${normalizeTopic(item.topic)}`
                  const isDone = completed.has(normalizeTopic(item.topic))
                  return (
                    <motion.button
                      type="button"
                      key={item.topic}
                      layoutId={layoutId}
                      onClick={() => setActiveTopic(item.topic)}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT, delay: i * 0.05 }}
                      whileHover={reduce ? undefined : { y: -6, boxShadow: `0 0 26px ${theme.tint}66` }}
                      whileTap={{ scale: 0.98 }}
                      className="group relative overflow-hidden rounded-2xl border border-k-border bg-card p-5 text-left transition-shadow duration-200"
                      style={{ borderColor: `${theme.tint}40` }}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-xl"
                          style={{ background: theme.panelTint, color: theme.tint }}
                        >
                          <Sparkles size={20} />
                        </div>
                        <span
                          className="game-text inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold opacity-80 transition-opacity duration-200 can-hover:group-hover:opacity-100"
                          style={{ background: `${theme.tint}22`, color: theme.tint }}
                        >
                          <BookOpen size={13} />
                          Learn
                        </span>
                      </div>
                      <h3 className="game-text text-lg font-bold capitalize" style={{ color: theme.tint }}>
                        {item.topic}
                      </h3>
                      <p className="mt-1 text-sm text-text-secondary">{item.desc}</p>

                      {/* STATUS TAG — flips to a glowing "Session Completed" pill
                          the moment the lesson is finished (live, no reload). */}
                      <div className="mt-4">
                        {isDone ? (
                          <span
                            className="game-text session-glow inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold"
                            style={{ '--glow-color': `${theme.tint}80`, borderColor: theme.tint, background: `${theme.tint}1f`, color: theme.tint }}
                          >
                            <CheckCircle2 size={13} className="shrink-0" />
                            <span className="truncate">Session Completed</span>
                          </span>
                        ) : (
                          <span className="game-text inline-flex max-w-full items-center gap-1.5 rounded-full border border-k-border px-3 py-1 text-xs font-semibold text-text-secondary">
                            <Circle size={11} className="shrink-0" />
                            <span className="truncate">Session Not Attended</span>
                          </span>
                        )}
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            )}
          </section>

          {/* RULES OF THE REALM */}
          <section className="mt-10">
            <div className="mb-5 flex items-center gap-2">
              <AnimatedIcon icon={ScrollText} size={22} animation="none" style={{ color: theme.tint }} />
              <h2 className="font-heading text-2xl font-extrabold">Rules of the realm</h2>
            </div>
            <div
              className="rounded-3xl border border-k-border p-6 sm:p-8"
              style={{ background: theme.panelTint, borderColor: `${theme.tint}40` }}
            >
              <ul className="grid gap-4 sm:grid-cols-2">
                {theme.rules.map((rule, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, ease: EASE_OUT, delay: i * 0.06 }}
                    className="flex items-start gap-3 text-sm text-text-primary/90"
                  >
                    <span
                      className="game-text mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: `${theme.tint}`, color: '#001621' }}
                    >
                      {i + 1}
                    </span>
                    {rule}
                  </motion.li>
                ))}
              </ul>
            </div>
          </section>

          {/* CTA ROW */}
          <section className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button tint={theme.tint} onClick={() => navigate('/play')} className="flex flex-1 items-center justify-center gap-2 sm:flex-none">
              <AnimatedIcon icon={Play} size={18} animation="hover" />
              Start Learning
            </Button>
            <Button
              variant="secondary"
              tint={theme.tint}
              glow={false}
              onClick={() => navigate('/games')}
              className="flex flex-1 items-center justify-center gap-2 sm:flex-none"
            >
              <AnimatedIcon icon={Gamepad2} size={18} animation="hover" />
              Play a Game
            </Button>
            <Button
              variant="secondary"
              tint={theme.tint}
              glow={false}
              onClick={() => navigate('/quiz')}
              className="flex flex-1 items-center justify-center gap-2 sm:flex-none"
            >
              <AnimatedIcon icon={Brain} size={18} animation="hover" />
              Take a Quiz
            </Button>

            {/* ADVANCE — jump to the next world by `order`, or back to the map
                when this is the final realm. Rightmost, tint-filled, distinct. */}
            {nextWorld ? (
              <Button
                tint={theme.tint}
                onClick={() => navigate(`/world/${nextWorld.slug}`)}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:ml-auto sm:flex-none"
              >
                <span className="truncate">Continue to {nextWorld.name}</span>
                <AnimatedIcon icon={ArrowRight} size={18} animation="hover" className="shrink-0" />
              </Button>
            ) : (
              <Button
                tint={theme.tint}
                onClick={() => navigate('/map')}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:ml-auto sm:flex-none"
              >
                <AnimatedIcon icon={Map} size={18} animation="hover" className="shrink-0" />
                <span className="truncate">Back to World Map</span>
              </Button>
            )}
          </section>
        </>
      )}

      {/* Interactive topic lesson — shared-element fly-to-center + flip. */}
      <AnimatePresence>
        {activeTopic && (
          <TopicLessonModal
            key={activeTopic}
            slug={world.slug}
            topic={activeTopic}
            tint={theme.tint}
            lesson={getLesson(world.slug, activeTopic)}
            layoutId={`topic-${world.slug}-${normalizeTopic(activeTopic)}`}
            onComplete={handleTopicComplete}
            onClose={() => setActiveTopic(null)}
          />
        )}
      </AnimatePresence>
      </div>
    </PageTransition>
  )
}
