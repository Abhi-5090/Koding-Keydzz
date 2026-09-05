import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Map as MapIcon, Coins, Zap, Flame, Settings, Sparkles, Target, Code, HelpCircle, Trophy, Award, ArrowRight, X } from 'lucide-react'
import { useGetDashboardQuery } from '../features/student/studentApi'
import { AssignmentsPanel } from './Assignments'
import { useGetAvatarItemsQuery } from '../features/avatar/avatarApi'
import { useAuth } from '../hooks/useAuth'
import { buildStats, resolveAvatarIcon } from '../features/student/dashboardModel'
import { worldVisual } from '../data/worlds'
import { worldIcon } from '../data/iconMap'
import PageTransition from '../components/layout/PageTransition'
import Card from '../components/ui/Card'
import XPBar from '../components/ui/XPBar'
import { useCountUp, useGrowBar, useRevealIn } from '../motion/hooks'
import Button from '../components/ui/Button'
import GlowBadge from '../components/ui/GlowBadge'
import Particles from '../components/ui/Particles'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/QueryState'

const FIRSTRUN_KEY = 'kk_dismissed_firstrun'

export default function Dashboard() {
  const panelsRef = useRevealIn({ selector: ':scope > *', y: 22, stagger: 0.07 })
  const { user } = useAuth()
  const { data: catalog } = useGetAvatarItemsQuery()
  const { data: dash, isLoading, isError, refetch } = useGetDashboardQuery()

  // First-run spotlight: dismissed state persists in localStorage.
  const [firstRunDismissed, setFirstRunDismissed] = useState(() => {
    try {
      return localStorage.getItem(FIRSTRUN_KEY) === '1'
    } catch {
      return false
    }
  })
  const dismissFirstRun = () => {
    setFirstRunDismissed(true)
    try {
      localStorage.setItem(FIRSTRUN_KEY, '1')
    } catch {
      /* ignore storage failures */
    }
  }

  if (isLoading) return <PageTransition><LoadingState message="Loading your dashboard…" /></PageTransition>
  if (isError || !dash) return <PageTransition><ErrorState onRetry={refetch} /></PageTransition>

  const stats = buildStats(user, dash)
  // Brand-new player: no XP earned and no world progress yet.
  const isNewPlayer =
    (dash.xp ?? 0) === 0 && (dash.progress?.overallPercent ?? 0) === 0
  const showFirstRun = isNewPlayer && !firstRunDismissed
  const avatarIcon = resolveAvatarIcon(user, catalog || [])
  const dailyChallenges = dash.dailyChallenges || []
  const achievements = dash.achievements || []

  // Per-world progress preview, joined with backend world records.
  const worldProgress = (dash.progress?.worlds || []).map((w) => {
    const v = worldVisual(w.slug)
    return { id: String(w.worldId), name: w.world, percent: w.percent, icon: worldIcon(w.slug), ...v }
  })

  return (
    <PageTransition>
      {/* First-run spotlight — points brand-new players to the World Map. */}
      <AnimatePresence>
        {showFirstRun && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            className="relative mb-6 overflow-hidden rounded-2xl border border-turmeric/50 bg-gradient-to-r from-turmeric/15 to-accent/10 p-4 sm:p-5"
          >
            <div className="flex flex-col items-start gap-3 pr-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <AnimatedIcon icon={Sparkles} size={26} animation="float" className="text-turmeric" glow />
                <div>
                  <p className="game-text font-bold text-turmeric">New here? Start your adventure!</p>
                  <p className="text-xs text-text-secondary">Head to the World Map to begin your first quest.</p>
                </div>
              </div>
              <Link to="/map" onClick={dismissFirstRun} className="shrink-0">
                <Button size="sm" className="flex items-center gap-1.5">
                  World Map <ArrowRight size={16} />
                </Button>
              </Link>
            </div>
            <button
              type="button"
              onClick={dismissFirstRun}
              aria-label="Dismiss"
              className="absolute right-2.5 top-2.5 rounded-lg p-1 text-text-secondary transition-colors can-hover:hover:text-turmeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero / greeting */}
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-k-border bg-gradient-to-br from-card to-surface p-6 shadow-golden-glow sm:p-8">
        <Particles count={12} />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-turmeric to-accent text-4xl shadow-golden-glow"
          >
            {avatarIcon}
          </motion.div>
          <div className="flex-1">
            <p className="text-text-secondary">Welcome back,</p>
            <h1 className="game-text mb-3 text-3xl font-bold text-turmeric">{stats.name}</h1>
            <XPBar xp={stats.xpIntoLevel} xpToNext={stats.xpLevelSpan} level={stats.level} earnHint className="max-w-md" />
          </div>
          <div className="flex gap-4">
            <Stat icon={MapIcon} label="Progress" value={stats.overallPercent != null ? `${stats.overallPercent}%` : '—'} />
            <Stat icon={Coins} label="Coins" value={stats.coins} />
            {/* Only shown once there is a streak to show. A permanent "0 day
                streak" is a reproach, not encouragement. */}
            {stats.streak > 0 ? (
              <Stat
                icon={Flame}
                label={stats.streak === 1 ? 'Day streak' : 'Days running'}
                value={stats.streak}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Homework, immediately under the hero and only when something is owed.
          A pupil who has been set work should see it before the games. */}
      <AssignmentsPanel />

      {/* One staggered entrance for the panel row. The stagger is 70ms — long
          enough to read as a sequence, short enough that the last card is in
          place before a child could have reached for it. */}
      <div ref={panelsRef} className="grid gap-6 lg:grid-cols-3">
        {/* Daily challenges */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="game-text flex items-center gap-2 text-xl font-bold">
              <AnimatedIcon icon={Zap} size={20} animation="pulse" className="text-turmeric" glow />
              Daily Challenges
            </h2>
            <span className="text-sm text-text-secondary">Fresh quests daily</span>
          </div>
          {dailyChallenges.length === 0 ? (
            <EmptyState icon={Zap} title="No challenges today" message="Check back soon for new daily quests!" />
          ) : (
            <div className="space-y-3">
              {dailyChallenges.map((c, i) => (
                <motion.div
                  key={c._id || c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
                  whileHover={{ x: 4 }}
                  className="flex items-center gap-4 rounded-xl border border-k-border bg-surface/50 p-4"
                >
                  <AnimatedIcon
                    icon={c.difficulty === 'hard' ? Flame : c.difficulty === 'medium' ? Settings : Sparkles}
                    size={24}
                    animation={c.difficulty === 'hard' ? 'pulse' : 'float'}
                    className={c.difficulty === 'hard' ? 'text-error' : c.difficulty === 'medium' ? 'text-text-secondary' : 'text-turmeric'}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="game-text font-semibold">{c.title}</p>
                    {c.description && <p className="text-xs text-text-secondary">{c.description}</p>}
                  </div>
                  <span className="game-text flex shrink-0 items-center gap-1 font-bold text-turmeric tabular-nums">
                    +{c.coinReward ?? 0}
                    <AnimatedIcon icon={Coins} size={16} animation="none" className="text-turmeric" />
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick actions */}
        <Card>
          <h2 className="mb-4 game-text flex items-center gap-2 text-xl font-bold">
            <AnimatedIcon icon={Target} size={20} animation="float" className="text-turmeric" glow />
            Jump In
          </h2>
          <div className="space-y-3">
            <Link to="/map" className="block">
              <Button className="w-full flex items-center justify-center gap-2">
                <AnimatedIcon icon={MapIcon} size={18} animation="hover" />
                Continue Quest
              </Button>
            </Link>
            <Link to="/play" className="block">
              <Button variant="secondary" className="w-full flex items-center justify-center gap-2">
                <AnimatedIcon icon={Code} size={18} animation="hover" />
                Code Playground
              </Button>
            </Link>
            <Link to="/quiz" className="block">
              <Button variant="secondary" className="w-full flex items-center justify-center gap-2">
                <AnimatedIcon icon={HelpCircle} size={18} animation="hover" />
                Quiz Arena
              </Button>
            </Link>
          </div>
        </Card>

        {/* Achievements */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="game-text flex items-center gap-2 text-xl font-bold">
              <AnimatedIcon icon={Trophy} size={20} animation="float" className="text-turmeric" glow />
              Recent Badges
            </h2>
            <Link to="/achievements" className="text-sm text-turmeric hover:underline">View all</Link>
          </div>
          {achievements.length === 0 ? (
            <EmptyState icon={Trophy} title="No badges yet" message="Complete lessons and quizzes to earn your first badge!" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {achievements.slice(0, 4).map((a) => (
                <GlowBadge key={a._id || a.id} icon={Award} label={a.title} earned rarity="Rare" />
              ))}
            </div>
          )}
        </Card>

        {/* Progress map preview */}
        <Card>
          <h2 className="mb-4 game-text flex items-center gap-2 text-xl font-bold">
            <AnimatedIcon icon={MapIcon} size={20} animation="float" className="text-turmeric" glow />
            Your Map
          </h2>
          {worldProgress.length === 0 ? (
            <EmptyState icon={MapIcon} title="No worlds yet" message="Worlds will appear as your adventure begins." />
          ) : (
            <div className="space-y-3">
              {worldProgress.slice(0, 3).map((w) => (
                <div key={w.id} className="flex items-center gap-3">
                  <span className="shrink-0">
                    <AnimatedIcon icon={w.icon} size={24} animation="float" style={{ color: w.tint }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="game-text truncate text-sm" style={{ color: w.tint }}>{w.name}</p>
                    <WorldBar percent={w.percent ?? 0} tint={w.tint} />
                  </div>
                  <span className="shrink-0 text-xs text-text-secondary tabular-nums">{w.percent ?? 0}%</span>
                </div>
              ))}
            </div>
          )}
          <Link to="/map" className="mt-4 block">
            <Button variant="ghost" size="sm" className="w-full">Open full map</Button>
          </Link>
        </Card>
      </div>
    </PageTransition>
  )
}

/**
 * A world's progress bar.
 *
 * Animated with `scaleX` on a full-width fill, not by tweening `width`: a
 * width animation re-lays out the row every frame, which is visible as judder
 * on a tablet. The track keeps its `aria` role on the row above, so the bar
 * itself is decorative.
 */
function WorldBar({ percent, tint }) {
  const ref = useGrowBar(percent / 100)
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface">
      <div
        ref={ref}
        className="h-full w-full origin-left rounded-full"
        style={{ background: tint || undefined, transform: `scaleX(${(percent || 0) / 100})` }}
      />
    </div>
  )
}

function Stat({ icon, label, value }) {
  const numeric = typeof value === 'number'
  // Only NUMBERS count up. A percentage string or an em-dash placeholder has
  // nothing to count, and tweening one produces "NaN" on screen.
  const countRef = useCountUp(numeric ? value : 0, { enabled: numeric })

  return (
    <div className="rounded-xl border border-k-border bg-surface/60 px-4 py-3 text-center shadow-card">
      <div className="flex justify-center">
        <AnimatedIcon icon={icon} size={24} animation="float" className="text-turmeric" glow />
      </div>
      {/* The final figure is rendered as children as well as animated to.
          A screen reader reads the DOM, not the tween — and if GSAP never
          loads, the correct number is already on screen. `tnum` stops the
          digits jittering as they change width mid-count. */}
      <div ref={numeric ? countRef : null} className="game-text tnum text-lg font-bold text-turmeric">
        {numeric ? value.toLocaleString() : value}
      </div>
      <div className="text-xs text-text-secondary">{label}</div>
    </div>
  )
}
