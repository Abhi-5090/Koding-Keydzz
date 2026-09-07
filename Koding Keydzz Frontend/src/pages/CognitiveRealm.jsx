import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Brain, CheckCircle2, Circle, Lock, Sparkles } from 'lucide-react'
import { useGetCoursesQuery } from '../features/courses/coursesApi'
import { getGame } from '../data/games'
import PageTransition from '../components/layout/PageTransition'
import Particles from '../components/ui/Particles'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import { LoadingState, ErrorState } from '../components/ui/QueryState'

const EASE_OUT = [0.23, 1, 0.32, 1]

/**
 * THE COGNITIVE GAMES REALM — the first rung of the ladder.
 *
 * WHY THIS SCREEN IS NOT `CourseMap`
 * ----------------------------------
 * Every other realm is a golden path of worlds, each holding lessons.
 * This one has neither: its content is four mini-games, and it is passed by
 * finishing the first level of each. Rendering it through the world map would
 * mean a map with nothing on it, because the API correctly reports that the
 * realm has no worlds.
 *
 * WHY THE FOUR GAMES AND WHY THE FIRST LEVEL
 * ------------------------------------------
 * They are the language-neutral ones — routes, patterns, thinking a move
 * ahead — which is what a child needs before any syntax means anything. The
 * bar is the FIRST level of each rather than all of them, because this is an
 * on-ramp and not a wall: a pupil should meet Python in their first session,
 * having shown they can plan.
 *
 * Progress comes from the server's `readiness.games`, which is the same
 * function the unlock rule and the staff screen read. A count assembled here
 * would eventually disagree with the gate, and this screen is where a child
 * would notice.
 */
export default function CognitiveRealm() {
  const reduce = useReducedMotion()
  const { data, isLoading, isError, refetch } = useGetCoursesQuery()

  const realm = (data?.items || []).find((c) => c.kind === 'games') || null
  const games = realm?.readiness?.games || []
  const done = games.filter((g) => g.levelsDone > 0).length
  const tint = realm?.tint || '#A78BFA'

  if (isLoading) {
    return (
      <PageTransition>
        <LoadingState message="Opening the games…" />
      </PageTransition>
    )
  }
  if (isError || !realm) {
    return (
      <PageTransition>
        <ErrorState onRetry={refetch} />
      </PageTransition>
    )
  }

  const complete = done >= games.length && games.length > 0

  return (
    <PageTransition>
      <Link
        to="/map"
        className="game-text mb-4 inline-flex items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
      >
        <ArrowLeft size={16} /> All realms
      </Link>

      <div className="mb-6 text-center">
        <div className="mb-3 flex justify-center">
          <AnimatedIcon
            icon={Brain}
            size={48}
            animation={reduce ? 'none' : 'float'}
            style={{ color: tint }}
            glow
          />
        </div>
        <h1 className="font-heading text-4xl font-extrabold" style={{ color: tint }}>
          {realm.title}
        </h1>
        <p className="mt-2 text-text-secondary">{realm.tagline}</p>
      </div>

      {/* Progress towards opening the next realm. */}
      <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-k-border bg-card p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="game-text text-sm font-bold text-text-primary">
            {done} of {games.length} games started
          </span>
          <span className="game-text text-xs text-text-secondary">
            {complete
              ? 'Python is open — head back to the map'
              : 'Finish the first level of each to unlock Python'}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-malt">
          <motion.div
            className="h-full rounded-full"
            style={{ background: tint }}
            initial={{ width: 0 }}
            animate={{ width: `${games.length ? (done / games.length) * 100 : 0}%` }}
            transition={reduce ? { duration: 0 } : { duration: 0.6, ease: EASE_OUT }}
          />
        </div>
      </div>

      <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-k-border bg-gradient-to-b from-card to-malt p-6 sm:p-8">
        <Particles count={14} />

        <div className="relative grid gap-4 sm:grid-cols-2">
          {games.map((entry, i) => {
            /**
             * The presentation — title, tagline, icon, colour — comes from the
             * games catalogue the mini-games themselves use, so a game renamed
             * in one place cannot read differently here.
             */
            const game = getGame(entry.gameKey)
            const played = entry.levelsDone > 0
            const gameTint = game?.tint || tint

            return (
              <motion.div
                key={entry.gameKey}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06, ease: EASE_OUT }}
              >
                {/*
                  Every one of these is OPEN. The realm is the first rung, so
                  nothing inside it is gated — the lock lives between realms,
                  not within this one. A child who wants to start with noughts
                  and crosses should be allowed to.
                */}
                <Link
                  to={`/games/${entry.gameKey}`}
                  className="group flex h-full flex-col rounded-2xl border-2 bg-surface/70 p-5 transition-[border-color,box-shadow] duration-200 can-hover:hover:shadow-golden-glow"
                  style={{ borderColor: `${gameTint}59` }}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${gameTint}22`, color: gameTint }}
                    >
                      <AnimatedIcon
                        icon={game?.icon || Sparkles}
                        size={26}
                        animation="none"
                      />
                    </div>
                    {played ? (
                      <span
                        className="game-text inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold"
                        style={{
                          borderColor: gameTint,
                          background: `${gameTint}1f`,
                          color: gameTint,
                        }}
                      >
                        <CheckCircle2 size={12} />
                        {entry.levelsDone} done
                      </span>
                    ) : (
                      <span className="game-text inline-flex items-center gap-1.5 rounded-full border border-k-border px-2.5 py-1 text-xs font-semibold text-text-secondary">
                        <Circle size={11} /> Not started
                      </span>
                    )}
                  </div>

                  <h3 className="game-text text-lg font-bold" style={{ color: gameTint }}>
                    {game?.title || entry.gameKey}
                  </h3>
                  <p className="mt-1 flex-1 text-sm leading-snug text-text-secondary">
                    {game?.tagline || 'A thinking game.'}
                  </p>
                  {game?.concept && (
                    <span className="game-text mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-malt px-2.5 py-1 text-xs text-text-secondary">
                      {game.concept}
                    </span>
                  )}
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>

      {!complete && (
        <p className="mx-auto mt-6 flex max-w-2xl items-center justify-center gap-2 text-center text-sm text-text-secondary">
          <Lock size={14} />
          Python opens when all four have been started — or when your teacher opens it for you.
        </p>
      )}
    </PageTransition>
  )
}
