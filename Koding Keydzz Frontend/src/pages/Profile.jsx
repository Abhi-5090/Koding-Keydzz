import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  Star,
  Zap,
  Coins,
  Award,
  Map as MapIcon,
  Drama,
  Globe,
  Trophy,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useGetDashboardQuery } from '../features/student/studentApi'
import { useGetAvatarItemsQuery } from '../features/avatar/avatarApi'
import { buildStats, resolveAvatarIcon } from '../features/student/dashboardModel'
import { worldVisual } from '../data/worlds'
import PageTransition from '../components/layout/PageTransition'
import Card from '../components/ui/Card'
import XPBar from '../components/ui/XPBar'
import GlowBadge from '../components/ui/GlowBadge'
import Particles from '../components/ui/Particles'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/QueryState'

export default function Profile() {
  const { user } = useAuth()
  const { data: dash, isLoading, isError, refetch } = useGetDashboardQuery()
  const { data: catalog } = useGetAvatarItemsQuery()

  if (isLoading) return <PageTransition><LoadingState message="Loading your profile…" /></PageTransition>
  if (isError || !dash) return <PageTransition><ErrorState onRetry={refetch} /></PageTransition>

  const stats = buildStats(user, dash)
  const avatarIcon = resolveAvatarIcon(user, catalog || [])
  const earned = dash.achievements || []

  const worldProgress = (dash.progress?.worlds || []).map((w) => {
    const v = worldVisual(w.slug)
    return { id: String(w.worldId), name: w.world, percent: w.percent, ...v }
  })

  return (
    <PageTransition>
      {/* Banner */}
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-k-border bg-gradient-to-br from-card to-surface p-8 shadow-golden-glow">
        <Particles count={14} />
        <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-end">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring' }}
            className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-turmeric to-accent text-6xl shadow-golden-glow"
          >
            {avatarIcon}
          </motion.div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="game-text text-3xl font-bold text-turmeric">{stats.name}</h1>
            <p className="text-text-secondary">
              Grade {stats.grade || '—'} · {stats.school || 'Koding Keydzz Academy'}
            </p>
            <div className="mt-3 max-w-md">
              <XPBar xp={stats.xpIntoLevel} xpToNext={stats.xpLevelSpan} level={stats.level} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stats */}
        <Card>
          <h2 className="mb-4 game-text text-xl font-bold inline-flex items-center gap-2">
            <AnimatedIcon icon={TrendingUp} size={22} className="text-turmeric" animation="float" glow />
            Stats
          </h2>
          <div className="space-y-3">
            <Row label="Level" value={stats.level} icon={Star} iconClass="text-turmeric" />
            <Row label="Total XP" value={stats.xp.toLocaleString()} icon={Zap} iconClass="text-turmeric" />
            <Row label="Coins" value={stats.coins.toLocaleString()} icon={Coins} iconClass="text-accent" />
            <Row label="Badges Earned" value={earned.length} icon={Award} iconClass="text-turmeric" />
            <Row label="Kingdom Progress" value={`${stats.overallPercent ?? 0}%`} icon={MapIcon} iconClass="text-success" />
          </div>
        </Card>

        {/* Hero card */}
        <Card>
          <h2 className="mb-4 game-text text-xl font-bold inline-flex items-center gap-2">
            <AnimatedIcon icon={Drama} size={22} className="text-turmeric" animation="float" glow />
            Your Hero
          </h2>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-turmeric to-accent text-5xl shadow-golden-glow">
              {avatarIcon}
            </div>
            <p className="text-center text-xs text-text-secondary">
              Customize skins, pets &amp; effects in the full wardrobe.
            </p>
            <Link
              to="/avatar"
              className="game-text mt-1 inline-flex items-center gap-2 rounded-xl bg-turmeric px-4 py-2 text-sm font-bold text-malt shadow-golden-glow"
            >
              <Drama size={16} /> Open Wardrobe
            </Link>
          </div>
        </Card>

        {/* World progress */}
        <Card>
          <h2 className="mb-4 game-text text-xl font-bold inline-flex items-center gap-2">
            <AnimatedIcon icon={Globe} size={22} className="text-turmeric" animation="float" glow />
            World Progress
          </h2>
          {worldProgress.length === 0 ? (
            <EmptyState icon={MapIcon} title="No progress yet" message="Start a world to see your progress here." />
          ) : (
            <div className="space-y-3">
              {worldProgress.slice(0, 5).map((w) => (
                <div key={w.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="game-text min-w-0 truncate" style={{ color: w.tint }}>{w.emoji} {w.name}</span>
                    <span className="shrink-0 text-text-secondary tabular-nums">{w.percent ?? 0}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-malt">
                    <div className="h-full rounded-full" style={{ width: `${w.percent ?? 0}%`, background: w.tint }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Badges */}
        <Card className="lg:col-span-3">
          <h2 className="mb-4 game-text text-xl font-bold inline-flex items-center gap-2">
            <AnimatedIcon icon={Trophy} size={22} className="text-turmeric" animation="float" glow />
            Earned Badges
          </h2>
          {earned.length === 0 ? (
            <EmptyState icon={Trophy} title="No badges yet" message="Complete lessons and quizzes to earn your first badge!" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {earned.map((a) => (
                <GlowBadge key={a._id || a.id} icon={Award} label={a.title} rarity="Rare" earned />
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageTransition>
  )
}

function Row({ label, value, icon, iconClass }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-k-border bg-surface/40 px-4 py-2.5">
      <span className="flex items-center gap-2 text-text-secondary">
        <AnimatedIcon icon={icon} size={18} className={iconClass} animation="hover" /> {label}
      </span>
      <span className="game-text font-bold text-turmeric">{value}</span>
    </div>
  )
}
