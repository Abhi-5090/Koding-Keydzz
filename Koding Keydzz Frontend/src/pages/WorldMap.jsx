import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, ChevronRight, Map } from 'lucide-react'
import { useGetWorldsQuery, useGetDashboardQuery } from '../features/student/studentApi'
import { worldVisual } from '../data/worlds'
import { worldIcon } from '../data/iconMap'
import PageTransition from '../components/layout/PageTransition'
import Particles from '../components/ui/Particles'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/QueryState'

const EASE_OUT = [0.23, 1, 0.32, 1]

export default function WorldMap() {
  const navigate = useNavigate()
  const { data: rawWorlds, isLoading, isError, refetch } = useGetWorldsQuery()
  const { data: dash } = useGetDashboardQuery()

  const playerLevel = dash?.level ?? 1
  const progressBySlug = Object.fromEntries(
    (dash?.progress?.worlds || []).map((w) => [w.slug, w])
  )

  const worlds = (rawWorlds || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((w) => {
      const v = worldVisual(w.slug)
      const prog = progressBySlug[w.slug] || {}
      return {
        id: String(w._id),
        order: w.order,
        name: w.name,
        slug: w.slug,
        topics: w.topics || [],
        description: w.description || '',
        unlockLevel: w.requiredLevel ?? 1,
        percent: prog.percent ?? 0,
        icon: worldIcon(w.slug),
        tint: v.tint,
        unlocked: playerLevel >= (w.requiredLevel ?? 1),
      }
    })

  // The "current" world is the first unlocked-but-not-finished world; we give it
  // (and the next locked world) an ember glow to guide the player forward.
  const currentIndex = worlds.findIndex((w) => w.unlocked && w.percent < 100)
  const highlightIndex = currentIndex === -1 ? worlds.findIndex((w) => !w.unlocked) : currentIndex

  const openWorld = (w) => {
    if (w.unlocked) navigate(`/world/${w.slug}`)
  }

  return (
    <PageTransition>
      <div className="mb-6 text-center">
        <h1 className="font-heading text-4xl font-extrabold">
          The <span className="golden-text">Golden Coding Kingdom</span>
        </h1>
        <p className="mt-2 text-text-secondary">Follow the golden path through the magical worlds.</p>
      </div>

      {isLoading ? (
        <LoadingState message="Mapping the kingdom…" />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : worlds.length === 0 ? (
        <EmptyState icon={Map} title="No worlds yet" message="The kingdom is still being built — check back soon!" />
      ) : (
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-k-border bg-gradient-to-b from-card to-malt p-6 sm:p-10">
          <Particles count={18} />

          <div className="relative flex flex-col gap-10">
            {worlds.map((w, i) => {
              const alignRight = i % 2 === 1
              const highlight = i === highlightIndex
              return (
                <div key={w.id} className="relative">
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
                    whileHover={w.unlocked ? { scale: 1.04, boxShadow: `0 0 28px ${w.tint}66` } : {}}
                    whileTap={w.unlocked ? { scale: 0.97 } : {}}
                    onClick={() => openWorld(w)}
                    disabled={!w.unlocked}
                    aria-label={
                      w.unlocked
                        ? `Open ${w.name}`
                        : `${w.name} — locked, unlocks at level ${w.unlockLevel}`
                    }
                    className={`group relative z-10 flex w-full max-w-sm items-center gap-4 rounded-2xl border-2 p-4 text-left transition-[background-color,border-color,color,box-shadow] duration-200 ${
                      alignRight ? 'ml-auto' : 'mr-auto'
                    } ${
                      w.unlocked
                        ? 'cursor-pointer bg-surface/70'
                        : 'cursor-not-allowed border-k-border/40 bg-malt/60 opacity-60'
                    }`}
                    style={
                      w.unlocked
                        ? {
                            borderColor: `${w.tint}59`,
                            boxShadow: highlight ? `0 0 28px ${w.tint}66` : undefined,
                          }
                        : undefined
                    }
                  >
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: w.unlocked ? `${w.tint}33` : '#0A2E3C',
                        border: `2px solid ${w.unlocked ? w.tint : '#FF602F33'}`,
                      }}
                    >
                      {w.unlocked ? (
                        <AnimatedIcon icon={w.icon} size={32} animation="float" style={{ color: w.tint }} />
                      ) : (
                        <AnimatedIcon icon={Lock} size={28} animation="none" className="text-text-secondary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-text-secondary">World {w.order}</span>
                      <h3 className="game-text truncate text-lg font-bold" style={{ color: w.unlocked ? w.tint : '#9DB8C4' }}>
                        {w.name}
                      </h3>
                      {w.unlocked ? (
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-malt">
                          <div className="h-full rounded-full" style={{ width: `${w.percent}%`, background: w.tint }} />
                        </div>
                      ) : (
                        <p className="text-xs text-text-secondary">Unlocks at Level {w.unlockLevel}</p>
                      )}
                    </div>
                    {w.unlocked && (
                      <span className="shrink-0 text-text-secondary transition-transform duration-200 can-hover:group-hover:translate-x-1">
                        <ChevronRight size={20} style={{ color: w.tint }} />
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
