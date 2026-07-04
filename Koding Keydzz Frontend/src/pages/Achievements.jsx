import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Trophy,
  Lock,
  Footprints,
  Repeat,
  Shield,
  Code2,
  Wand2,
  Crown,
  Bot,
  Flame,
  Zap,
  Star,
  Target,
  Medal,
} from 'lucide-react'
import { useGetAchievementsQuery } from '../features/student/studentApi'
import PageTransition from '../components/layout/PageTransition'
import Card from '../components/ui/Card'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/QueryState'

const FILTERS = ['All', 'Unlocked', 'Locked']
const EASE_OUT = [0.23, 1, 0.32, 1]

// Map the backend `icon` string to a lucide icon (fallback Trophy).
const ICON_MAP = {
  spark: Zap,
  loop: Repeat,
  shield: Shield,
  python: Code2,
  code: Code2,
  wand: Wand2,
  crown: Crown,
  robot: Bot,
  fire: Flame,
  flame: Flame,
  star: Star,
  target: Target,
  steps: Footprints,
  medal: Medal,
  trophy: Trophy,
}
const iconFor = (a) => ICON_MAP[a.icon] || Trophy

const pctOf = (a) => {
  if (a.unlocked) return 100
  if (typeof a.percent === 'number') return Math.max(0, Math.min(100, Math.round(a.percent)))
  if (a.target) return Math.max(0, Math.min(100, Math.round(((a.progress || 0) / a.target) * 100)))
  return 0
}

export default function Achievements() {
  const [filter, setFilter] = useState('All')
  const { data, isLoading, isError, refetch } = useGetAchievementsQuery()

  const items = useMemo(() => {
    const list = (Array.isArray(data) ? data : []).map((a) => ({
      key: String(a.key ?? a._id ?? a.id),
      title: a.title,
      desc: a.description,
      Icon: iconFor(a),
      progress: a.progress ?? 0,
      target: a.target ?? 0,
      percent: pctOf(a),
      unlocked: !!a.unlocked,
    }))
    // Sort: unlocked first, then closest-to-complete.
    return list.sort((x, y) => {
      if (x.unlocked !== y.unlocked) return x.unlocked ? -1 : 1
      return y.percent - x.percent
    })
  }, [data])

  if (isLoading) return <PageTransition><LoadingState message="Polishing your trophies…" /></PageTransition>
  if (isError) return <PageTransition><ErrorState onRetry={refetch} /></PageTransition>

  const unlockedCount = items.filter((a) => a.unlocked).length
  const list = items.filter((a) =>
    filter === 'All' ? true : filter === 'Unlocked' ? a.unlocked : !a.unlocked
  )
  const collectionPct = items.length ? Math.round((unlockedCount / items.length) * 100) : 0

  return (
    <PageTransition>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold inline-flex items-center gap-2">
            <AnimatedIcon icon={Trophy} size={30} className="text-turmeric" animation="float" glow />
            Achievements
          </h1>
          <p className="text-text-secondary">
            {unlockedCount} of {items.length} badges unlocked
          </p>
        </div>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`game-text rounded-xl px-4 py-2 text-sm transition-[background-color,border-color,color,box-shadow] duration-200 ${
                filter === f ? 'bg-turmeric text-malt shadow-golden-glow' : 'border border-k-border bg-surface/60 text-text-secondary hover:text-turmeric'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Trophy} title="No achievements yet" message="Go earn your first badge by completing a lesson!" />
      ) : (
        <>
          <Card hover={false} className="mb-6">
            <div className="mb-2 flex justify-between text-sm text-text-secondary">
              <span className="game-text">Collection Progress</span>
              <span className="game-text text-turmeric">{collectionPct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-malt">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${collectionPct}%` }}
                transition={{ duration: 0.9, ease: EASE_OUT }}
                className="h-full rounded-full bg-gradient-to-r from-turmeric to-accent shadow-golden-glow"
              />
            </div>
          </Card>

          {list.length === 0 ? (
            <EmptyState
              icon={filter === 'Unlocked' ? Trophy : Lock}
              title={filter === 'Unlocked' ? 'No badges unlocked yet' : 'Nothing locked here'}
              message={filter === 'Unlocked' ? 'Keep playing to unlock your first badge!' : 'You have unlocked everything in this view.'}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((a, i) => (
                <AchievementCard key={a.key} a={a} i={i} />
              ))}
            </div>
          )}
        </>
      )}
    </PageTransition>
  )
}

function AchievementCard({ a, i }) {
  const unlocked = a.unlocked
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.04, ease: EASE_OUT }}
      className={`relative flex flex-col gap-3 rounded-2xl border-2 p-5 transition-[border-color,box-shadow] duration-200 ${
        unlocked
          ? 'border-turmeric bg-card shadow-golden-glow'
          : 'border-k-border bg-card/70'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            unlocked ? 'bg-turmeric/20 text-turmeric' : 'bg-surface text-text-secondary'
          }`}
        >
          {unlocked ? (
            <AnimatedIcon icon={a.Icon} size={26} animation="float" className="text-turmeric" glow />
          ) : (
            <a.Icon size={26} className="opacity-60" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={`game-text font-bold ${unlocked ? 'text-turmeric' : 'text-text-primary'}`}>
            {a.title}
          </h3>
          <p className="text-xs text-text-secondary">{a.desc}</p>
        </div>
        {unlocked && (
          <span className="inline-flex items-center gap-1 rounded-full border border-turmeric/50 bg-turmeric/10 px-2 py-0.5 text-[10px] font-bold uppercase text-turmeric game-text">
            <Trophy size={11} /> Earned
          </span>
        )}
      </div>

      {/* Animated progress bar = real per-user percent */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
          <span className="game-text">
            {a.target ? `${Math.min(a.progress, a.target)} / ${a.target}` : unlocked ? 'Complete' : 'In progress'}
          </span>
          <span className={`game-text ${unlocked ? 'text-turmeric' : 'text-text-secondary'}`}>{a.percent}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-malt">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${a.percent}%` }}
            transition={{ duration: 0.8, ease: EASE_OUT }}
            className={`h-full rounded-full ${
              unlocked
                ? 'bg-gradient-to-r from-turmeric to-accent shadow-golden-glow'
                : 'bg-gradient-to-r from-turmeric/60 to-accent/60'
            }`}
          />
        </div>
      </div>
    </motion.div>
  )
}
