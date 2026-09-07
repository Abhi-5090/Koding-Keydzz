import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, ChevronRight, Map as MapIcon, CheckCircle2, Brain } from 'lucide-react'
import { useGetCoursesQuery } from '../features/courses/coursesApi'
import { courseIcon } from '../data/iconMap'
import PageTransition from '../components/layout/PageTransition'
import Particles from '../components/ui/Particles'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/QueryState'
import { BOARD_MUTED, BOARD_SURFACE } from '../theme/tokens'

const EASE_OUT = [0.23, 1, 0.32, 1]

/**
 * THE KINGDOM: all four realms, and the one you may walk into.
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * This page used to list the twenty worlds of whichever course the pupil was
 * currently on — a flat golden path with no sense of where it sat in the
 * ladder. Two things were wrong with that.
 *
 * First, a child could not see what came next. The three courses ahead of them
 * were not merely locked, they were INVISIBLE, so the map gave no answer to
 * "what am I working towards?" — which is most of what a map is for.
 *
 * Second, the lock it did show was the wrong rule: worlds were gated on the
 * pupil's XP level, so grinding mini-games opened Algorithm Desert to somebody
 * who had never written a line in Coding Forest.
 *
 * So the map is now two screens. This one shows every realm, with the ones
 * ahead plainly locked and told, in a sentence, what opens them. Opening one
 * leads to its worlds, where the rule is the same sentence again: finish the
 * previous one.
 *
 * The first realm is Cognitive Games, which has no worlds — four mini-games
 * instead — so its tile leads to its own screen and carries its own icon
 * rather than a map pin.
 */
export default function WorldMap() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useGetCoursesQuery()

  const courses = (data?.items || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  // The realm to draw the eye to: the first one open and unfinished.
  const highlightIndex = courses.findIndex((c) => c.unlocked && c.status !== 'passed')

  const openCourse = (course) => {
    if (course.unlocked) navigate(`/map/${course.slug}`)
  }

  /**
   * A games realm has no worlds, so its tile leads to its own screen. The
   * route handles the redirect by matching the slug first; this exists so the
   * icon and the label can differ too — a realm of games should not be drawn
   * with a map pin.
   */
  const iconFor = (course) => (course.kind === 'games' ? Brain : courseIcon(course.slug))

  return (
    <PageTransition>
      <div className="mb-6 text-center">
        <h1 className="font-heading text-4xl font-extrabold">
          The <span className="golden-text">Golden Coding Kingdom</span>
        </h1>
        <p className="mt-2 text-text-secondary">
          {courses.length} realms to master, one after another. Start with the games, then
          the code.
        </p>
      </div>

      {isLoading ? (
        <LoadingState message="Mapping the kingdom…" />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={MapIcon}
          title="No realms yet"
          message="The kingdom is still being built — check back soon!"
        />
      ) : (
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-k-border bg-gradient-to-b from-card to-malt p-6 sm:p-10">
          <Particles count={18} />

          <div className="relative flex flex-col gap-10">
            {courses.map((course, i) => {
              const alignRight = i % 2 === 1
              const highlight = i === highlightIndex
              const tint = course.tint || '#FF602F'
              const Icon = iconFor(course)
              const passed = course.status === 'passed'

              return (
                <div key={course.id} className="relative">
                  {i < courses.length - 1 && (
                    <div
                      className="absolute left-1/2 top-full z-0 h-10 w-1 -translate-x-1/2 bg-gradient-to-b from-turmeric/60 to-transparent"
                      aria-hidden
                    />
                  )}
                  <motion.button
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06, duration: 0.35, ease: EASE_OUT }}
                    whileHover={course.unlocked ? { scale: 1.04, boxShadow: `0 0 28px ${tint}66` } : {}}
                    whileTap={course.unlocked ? { scale: 0.97 } : {}}
                    onClick={() => openCourse(course)}
                    disabled={!course.unlocked}
                    /**
                     * The locked state is announced, not merely drawn. A pupil
                     * using a screen reader gets the same sentence a sighted
                     * pupil reads under the title, rather than an unexplained
                     * unavailable button.
                     */
                    aria-label={
                      course.unlocked
                        ? `Open the ${course.title} realm`
                        : `${course.title} — locked. ${course.lockedReason || ''}`
                    }
                    className={`group relative z-10 flex w-full max-w-sm items-center gap-4 rounded-2xl border-2 p-4 text-left transition-[background-color,border-color,color,box-shadow] duration-200 ${
                      alignRight ? 'ml-auto' : 'mr-auto'
                    } ${
                      course.unlocked
                        ? 'cursor-pointer bg-surface/70'
                        : 'cursor-not-allowed border-k-border/40 bg-malt/60 opacity-70'
                    }`}
                    style={
                      course.unlocked
                        ? {
                            borderColor: `${tint}59`,
                            boxShadow: highlight ? `0 0 28px ${tint}66` : undefined,
                          }
                        : undefined
                    }
                  >
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: course.unlocked ? `${tint}33` : BOARD_SURFACE,
                        border: `2px solid ${course.unlocked ? tint : '#FF602F33'}`,
                      }}
                    >
                      {!course.unlocked ? (
                        <AnimatedIcon icon={Lock} size={28} animation="none" className="text-text-secondary" />
                      ) : passed ? (
                        <AnimatedIcon icon={CheckCircle2} size={32} animation="none" style={{ color: tint }} />
                      ) : (
                        <AnimatedIcon icon={Icon} size={32} animation="float" style={{ color: tint }} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-text-secondary">Realm {course.order}</span>
                      <h3
                        className="game-text truncate text-lg font-bold"
                        style={{ color: course.unlocked ? tint : BOARD_MUTED }}
                      >
                        {course.title}
                      </h3>

                      {course.unlocked ? (
                        <p className="mt-0.5 truncate text-xs text-text-secondary">
                          {passed ? 'Completed — revisit any world' : course.tagline || 'Open'}
                        </p>
                      ) : (
                        /**
                         * The sentence comes from the server, which is the only
                         * thing that knows the rule. Writing "Complete the
                         * previous course" here would be a second copy of that
                         * rule, free to drift out of step with the one that
                         * actually gates the content.
                         */
                        <p className="mt-0.5 text-xs leading-snug text-text-secondary">
                          {course.lockedReason || 'Finish the realm before this one to unlock it.'}
                        </p>
                      )}
                    </div>

                    {course.unlocked && (
                      <span className="shrink-0 text-text-secondary transition-transform duration-200 can-hover:group-hover:translate-x-1">
                        <ChevronRight size={20} style={{ color: tint }} />
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
