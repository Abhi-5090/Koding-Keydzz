import { useState } from 'react'
import { motion } from 'framer-motion'
import { Globe, School, BarChart3, Crown, Medal, Award } from 'lucide-react'
import { useGetLeaderboardQuery } from '../features/student/studentApi'
import { useGetAvatarItemsQuery } from '../features/avatar/avatarApi'
import { useAuth } from '../hooks/useAuth'
import PageTransition from '../components/layout/PageTransition'
import Card from '../components/ui/Card'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/QueryState'

// Only scopes the backend actually serves. A time-based "Weekly" board isn't
// supported server-side, so it's intentionally omitted rather than duplicating
// the global data under a second label.
const TABS = [
  { key: 'global', label: 'Global', icon: Globe },
  { key: 'school', label: 'My School', icon: School },
]

// Podium: 1st = primary #FF602F (turmeric), 2nd = #9DB8C4 (text-secondary), 3rd = #C98A5A (bronze).
const MEDALS = {
  1: { icon: Crown, className: 'text-turmeric' },
  2: { icon: Medal, className: 'text-text-secondary' },
  3: { icon: Award, style: { color: '#C98A5A' } },
}

export default function Leaderboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('global')
  const { data, isLoading, isError, refetch } = useGetLeaderboardQuery(tab)
  const { data: catalog } = useGetAvatarItemsQuery()

  const avatarEmoji = (avatar) => {
    const skinKey = avatar?.skin
    if (skinKey && catalog) {
      const item = catalog.find((i) => i.key === skinKey)
      if (item?.asset) return item.asset
    }
    return '🦊'
  }

  // Backend returns { scope, entries, me }; tolerate an older bare-array shape too.
  const rawList = Array.isArray(data) ? data : data?.entries || []
  const players = rawList.map((p) => ({
    ...p,
    emoji: avatarEmoji(p.avatar),
    isMe: user?.name && p.name === user.name,
  }))
  const top3 = players.slice(0, 3)
  const rest = players.slice(3)
  const me =
    players.find((p) => p.isMe) ||
    (data?.me ? { ...data.me, emoji: avatarEmoji(data.me.avatar), isMe: true } : null)

  return (
    <PageTransition>
      <div className="mb-6 text-center">
        <h1 className="font-heading text-3xl font-extrabold inline-flex items-center gap-2">
          <AnimatedIcon icon={BarChart3} size={30} className="text-turmeric" animation="float" glow />
          Leaderboard
        </h1>
        <p className="text-text-secondary">Climb the ranks of the Golden Kingdom!</p>
      </div>

      <div className="mb-8 flex justify-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`game-text pressable inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm transition-[background-color,border-color,color,box-shadow] duration-200 ${
              tab === t.key ? 'bg-turmeric text-malt shadow-golden-glow' : 'border border-k-border bg-surface/60 text-text-secondary hover:text-turmeric'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'school' && (
        <p className="mb-4 text-center text-xs text-text-secondary">
          Top players across your school.
        </p>
      )}

      {!isLoading && !isError && players.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className="mx-auto mb-6 flex max-w-md items-center justify-center gap-3 rounded-xl border border-turmeric/40 bg-turmeric/10 px-4 py-2.5 text-sm"
        >
          {me ? (
            <>
              <span className="game-text font-bold text-turmeric">Your rank</span>
              <span className="game-text rounded-full bg-turmeric px-2.5 py-0.5 text-xs font-bold text-malt">
                #{me.rank}
              </span>
              <span className="text-text-secondary">·</span>
              <span className="game-text text-text-secondary">{(me.xp ?? 0).toLocaleString()} XP</span>
            </>
          ) : (
            <span className="game-text text-text-secondary">
              You&apos;re not ranked yet — earn XP to climb the board!
            </span>
          )}
        </motion.div>
      )}

      {isLoading ? (
        <LoadingState message="Tallying the rankings…" />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : players.length === 0 ? (
        <EmptyState icon={BarChart3} title="No rankings yet" message="Be the first to earn XP and top the leaderboard!" />
      ) : (
        <>
          {/* Podium */}
          <div className="mb-8 flex items-end justify-center gap-3 sm:gap-6">
            {[top3[1], top3[0], top3[2]].filter(Boolean).map((p, i) => {
              const place = p.rank
              const heights = { 1: 'h-40', 2: 'h-32', 3: 'h-24' }
              const medal = MEDALS[place]
              return (
                <motion.div
                  key={p.rank}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.07, ease: [0.23, 1, 0.32, 1] }}
                  className="flex w-24 flex-col items-center sm:w-28"
                >
                  <span className="mb-1 text-3xl">{p.emoji}</span>
                  <span className="game-text mb-2 text-center text-xs font-bold text-text-secondary">{p.name}</span>
                  <div className={`flex w-full ${heights[place]} flex-col items-center justify-start rounded-t-2xl border border-k-border bg-gradient-to-b from-surface to-card pt-3 ${place === 1 ? 'shadow-golden-glow' : ''}`}>
                    {medal && (
                      <AnimatedIcon
                        icon={medal.icon}
                        size={32}
                        className={medal.className}
                        style={medal.style}
                        animation={place === 1 ? 'pop' : 'float'}
                        glow={place === 1}
                      />
                    )}
                    <span className="game-text mt-1 text-sm font-bold text-turmeric">{(p.xp ?? 0).toLocaleString()}</span>
                    <span className="text-[10px] text-text-secondary">XP</span>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Rest of list */}
          {rest.length > 0 && (
            <Card hover={false}>
              <ul className="divide-y divide-k-border">
                {rest.map((p, i) => (
                  <motion.li
                    key={p.rank}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04, ease: [0.23, 1, 0.32, 1] }}
                    whileHover={{ x: 4 }}
                    className={`flex items-center gap-4 py-3 ${p.isMe ? 'rounded-xl bg-turmeric/10 px-3' : ''}`}
                  >
                    <span className="game-text w-8 text-center font-bold text-text-secondary">#{p.rank}</span>
                    <span className="text-2xl">{p.emoji}</span>
                    <div className="flex-1">
                      <span className="game-text font-semibold">{p.name}</span>
                      {p.isMe && <span className="ml-2 rounded-full bg-turmeric px-2 py-0.5 text-[10px] font-bold text-malt">YOU</span>}
                      <p className="text-xs text-text-secondary">Level {p.level}</p>
                    </div>
                    <span className="game-text font-bold text-turmeric">{(p.xp ?? 0).toLocaleString()} XP</span>
                  </motion.li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </PageTransition>
  )
}
