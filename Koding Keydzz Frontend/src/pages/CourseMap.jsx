import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, ChevronRight, ArrowLeft, Map as MapIcon, CheckCircle2 } from 'lucide-react'
import { useGetWorldsQuery } from '../features/student/studentApi'
import { useGetCoursesQuery } from '../features/courses/coursesApi'
import { worldVisual } from '../data/worlds'
import { worldIcon } from '../data/iconMap'
import PageTransition from '../components/layout/PageTransition'
import Particles from '../components/ui/Particles'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/QueryState'
import { BOARD_MUTED, BOARD_SURFACE } from '../theme/tokens'

const EASE_OUT = [0.23, 1, 0.32, 1]

/**
 * ONE REALM'S GOLDEN PATH — five worlds, walked in order.
 *
 * THE RULE, AND WHERE IT LIVES
 * ----------------------------
 * A world opens when the one before it is FINISHED — every lesson in it, not
 * a percentage and not an XP level. None of that is decided here: each world
 * arrives from the server already carrying `unlocked`, `lockedReason` and its
 * completion counts, and this file renders them.
 *
 * That split is deliberate. The previous version computed the lock in the
 * browser by comparing the pupil's level against `requiredLevel`, which meant
 * the map and the API could disagree — and they did: the map would offer a
 * world the API then refused to serve lessons for. A client-side lock is also
 * only ever a suggestion, since the ids it hides are in the page already.
 */
export default function CourseMap() {
  const navigate = useNavigate()
  const { courseSlug } = useParams()

  const worldsQuery = useGetWorldsQuery(courseSlug)
  const coursesQuery = useGetCoursesQuery()

  const course = (coursesQuery.data?.items || []).find((c) => c.slug === courseSlug)
  const tint = course?.tint || '#FF602F'

  const worlds = (worldsQuery.data || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  // The world to draw the eye to: the first one open and unfinished.
  const highlightIndex = worlds.findIndex((w) => w.unlocked && !w.complete)

  const openWorld = (world) => {
    if (world.unlocked) navigate(`/world/${world.slug}`)
  }

  /**
   * A locked REALM reaches here only by a typed address; the server answers
   * 403 and this is the readable version of that. Sending the pupil back to
   * the map is better than an error page, because the map explains what opens
   * it.
   */
  const forbidden = worldsQuery.error?.status === 403

  return (
    <PageTransition>
      {/* Every screen below the map carries its way back. */}
      <Link
        to="/map"
        className="mb-4 inline-flex items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
      >
        <ArrowLeft size={16} /> All realms
      </Link>

      <div className="mb-6 text-center">
        <h1 className="font-heading text-4xl font-extrabold">
          <span className="golden-text">{course?.title || 'Realm'}</span>
        </h1>
        <p className="mt-2 text-text-secondary">
          {course?.tagline || 'Walk the golden path, one world at a time.'}
        </p>
      </div>

      {worldsQuery.isLoading || coursesQuery.isLoading ? (
        <LoadingState message="Mapping the realm…" />
      ) : forbidden ? (
        <EmptyState
          icon={Lock}
          title="This realm is still locked"
          message={
            course?.lockedReason ||
            'Finish the realm before this one to unlock it.'
          }
        />
      ) : worldsQuery.isError ? (
        <ErrorState onRetry={worldsQuery.refetch} />
      ) : worlds.length === 0 ? (
        <EmptyState
          icon={MapIcon}
          title="No worlds yet"
          message="This realm is still being built — check back soon!"
        />
      ) : (
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-k-border bg-gradient-to-b from-card to-malt p-6 sm:p-10">
          <Particles count={18} />

          <div className="relative flex flex-col gap-10">
            {worlds.map((world, i) => {
              const alignRight = i % 2 === 1
              const highlight = i === highlightIndex
              const visual = worldVisual(world.slug)
              const wTint = visual.tint || tint
              const Icon = worldIcon(world.slug)

              return (
                <div key={world.id} className="relative">
                  {i < worlds.length - 1 && (
                    <div
                      className="absolute left-1/2 top-full z-0 h-10 w-1 -translate-x-1/2 bg-gradient-to-b from-turmeric/60 to-transparent"
                      aria-hidden
                    />
                  )}
                  <motion.button
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06, duration: 0.35, ease: EASE_OUT }}
                    whileHover={world.unlocked ? { scale: 1.04, boxShadow: `0 0 28px ${wTint}66` } : {}}
                    whileTap={world.unlocked ? { scale: 0.97 } : {}}
                    onClick={() => openWorld(world)}
                    disabled={!world.unlocked}
                    aria-label={
                      world.unlocked
                        ? `Open ${world.name}`
                        : `${world.name} — locked. ${world.lockedReason || ''}`
                    }
                    className={`group relative z-10 flex w-full max-w-sm items-center gap-4 rounded-2xl border-2 p-4 text-left transition-[background-color,border-color,color,box-shadow] duration-200 ${
                      alignRight ? 'ml-auto' : 'mr-auto'
                    } ${
                      world.unlocked
                        ? 'cursor-pointer bg-surface/70'
                        : 'cursor-not-allowed border-k-border/40 bg-malt/60 opacity-70'
                    }`}
                    style={
                      world.unlocked
                        ? {
                            borderColor: `${wTint}59`,
                            boxShadow: highlight ? `0 0 28px ${wTint}66` : undefined,
                          }
                        : undefined
                    }
                  >
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: world.unlocked ? `${wTint}33` : BOARD_SURFACE,
                        border: `2px solid ${world.unlocked ? wTint : '#FF602F33'}`,
                      }}
                    >
                      {!world.unlocked ? (
                        <AnimatedIcon icon={Lock} size={28} animation="none" className="text-text-secondary" />
                      ) : world.complete ? (
                        <AnimatedIcon icon={CheckCircle2} size={32} animation="none" style={{ color: wTint }} />
                      ) : (
                        <AnimatedIcon icon={Icon} size={32} animation="float" style={{ color: wTint }} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-text-secondary">World {world.order}</span>
                      <h3
                        className="game-text truncate text-lg font-bold"
                        style={{ color: world.unlocked ? wTint : BOARD_MUTED }}
                      >
                        {world.name}
                      </h3>

                      {world.unlocked ? (
                        <>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-malt">
                            <div
                              className="h-full rounded-full transition-[width] duration-300"
                              style={{ width: `${world.percent ?? 0}%`, background: wTint }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-text-secondary">
                            {world.completedLessons ?? 0} of {world.lessonCount ?? 0} lessons
                          </p>
                        </>
                      ) : (
                        <p className="mt-0.5 text-xs leading-snug text-text-secondary">
                          {world.lockedReason || 'Finish the world before this one to unlock it.'}
                        </p>
                      )}
                    </div>

                    {world.unlocked && (
                      <span className="shrink-0 text-text-secondary transition-transform duration-200 can-hover:group-hover:translate-x-1">
                        <ChevronRight size={20} style={{ color: wTint }} />
                      </span>
                    )}
                  </motion.button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </PageTransition>
  )
}
