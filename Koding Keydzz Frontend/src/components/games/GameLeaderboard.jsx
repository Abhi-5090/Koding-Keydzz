import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Crown, Medal, Globe, School, Star, Timer, Move, Trophy, Users } from 'lucide-react'
import {
  useGetGameLeaderboardQuery,
  useGetLevelLeaderboardQuery,
} from '../../features/games/leaderboardApi'
import { useGetAvatarItemsQuery } from '../../features/avatar/avatarApi'
import { formatMs } from '../../games/shared/useLevelTimer'
import QueryState from '../ui/QueryState'

const EASE_OUT = [0.23, 1, 0.32, 1]

// Podium colours per spec: 1st turmeric, 2nd text-secondary, 3rd bronze.
const MEDALS = {
  1: { icon: Crown, color: '#FF602F' },
  2: { icon: Medal, color: '#9DB8C4' },
  3: { icon: Medal, color: '#C98A5A' },
}

const SCOPES = [
  { key: 'global', label: 'Global', icon: Globe },
  { key: 'org', label: 'My School', icon: School },
]

/**
 * GameLeaderboard — themed move-count / time leaderboard for a mini-game.
 *
 * Renders either the per-game board (levels completed / total stars / total
 * time) or a per-level board (moves / time / stars). It owns its scope toggle
 * (Global / My School) and, when `levels` is provided, a per-level selector
 * (Overall + each level). The current player's row is highlighted; if the
 * player is outside the visible list, a pinned "me" row is shown below a
 * divider. All network states are friendly (loading / empty / error) and never
 * fabricate entries.
 *
 * Props:
 *   gameKey        game slug (required)
 *   levels?        ordered level list -> enables the per-level selector
 *   initialLevelId?  levelId to show a level board directly (no selector)
 *   tint?          accent colour (defaults to turmeric)
 *   defaultScope?  'global' | 'org'  (default 'global')
 *   showScopeToggle?  boolean (default true)
 *   showLevelSelector?  boolean (default: true when `levels` given)
 *   limit?         number of rows to fetch
 *   compact?       boolean — tight top-N layout for the win overlay
 */
export default function GameLeaderboard({
  gameKey,
  levels = null,
  initialLevelId = null,
  tint = '#FF602F',
  defaultScope = 'global',
  showScopeToggle = true,
  showLevelSelector,
  limit,
  compact = false,
}) {
  const [scope, setScope] = useState(defaultScope)
  const [levelId, setLevelId] = useState(initialLevelId)

  const withSelector = (showLevelSelector ?? Boolean(levels)) && !compact
  const isLevel = levelId != null

  const { data: catalog } = useGetAvatarItemsQuery()
  const avatarEmoji = (avatar) => {
    const skinKey = avatar?.skin
    if (skinKey && catalog) {
      const item = catalog.find((i) => i.key === skinKey)
      if (item?.asset) return item.asset
    }
    return '🦊'
  }

  const gameQuery = useGetGameLeaderboardQuery(
    { gameKey, scope, limit: limit ?? (compact ? 5 : 25) },
    { skip: isLevel }
  )
  const levelQuery = useGetLevelLeaderboardQuery(
    { gameKey, levelId, scope, limit: limit ?? (compact ? 3 : 15) },
    { skip: !isLevel }
  )
  const query = isLevel ? levelQuery : gameQuery

  const entries = Array.isArray(query.data?.entries) ? query.data.entries : []
  const me = query.data?.me || null
  const totalPlayers = query.data?.totalPlayers

  const meInList = useMemo(
    () => (me ? entries.some((e) => e.userId === me.userId) : false),
    [entries, me]
  )

  const isEmpty = !query.isLoading && !query.isError && entries.length === 0

  return (
    <div className={compact ? '' : 'space-y-4'}>
      {!compact && (showScopeToggle || withSelector) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {withSelector ? (
            <LevelSelector levels={levels} value={levelId} onChange={setLevelId} tint={tint} />
          ) : (
            <span />
          )}
          {showScopeToggle && <ScopeToggle scope={scope} onChange={setScope} tint={tint} />}
        </div>
      )}

      <QueryState
        query={query}
        isEmpty={isEmpty}
        loadingMessage="Tallying the rankings…"
        errorMessage="We couldn't load the leaderboard. Check your connection and try again."
        emptyProps={{
          icon: Trophy,
          title: 'No runs yet',
          message: isLevel
            ? 'Be the first to set a time on this level!'
            : 'Play a few levels to appear on the board.',
        }}
      >
        {!compact && !isLevel && Number.isFinite(totalPlayers) && (
          <p className="game-text mb-1 inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <Users size={13} /> {totalPlayers.toLocaleString()} players
          </p>
        )}

        <ul className={compact ? 'space-y-1.5' : 'space-y-1.5'}>
          {entries.map((entry, i) => (
            <Row
              key={entry.userId ?? entry.rank}
              entry={entry}
              index={i}
              isLevel={isLevel}
              isMe={me && entry.userId === me.userId}
              emoji={avatarEmoji(entry.avatar)}
              tint={tint}
              compact={compact}
            />
          ))}
        </ul>

        {/* Pin the player's own row when they fall outside the visible list. */}
        {me && !meInList && (
          <>
            <div className="my-2 flex items-center gap-2">
              <span className="h-px flex-1 bg-k-border" />
              <span className="game-text text-[10px] uppercase tracking-wide text-text-secondary">
                your rank
              </span>
              <span className="h-px flex-1 bg-k-border" />
            </div>
            <ul className="space-y-1.5">
              <Row
                entry={me}
                index={0}
                isLevel={isLevel}
                isMe
                emoji={avatarEmoji(me.avatar)}
                tint={tint}
                compact={compact}
              />
            </ul>
          </>
        )}
      </QueryState>
    </div>
  )
}

function Row({ entry, index, isLevel, isMe, emoji, tint, compact }) {
  const medal = MEDALS[entry.rank]
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.035, ease: EASE_OUT }}
      className={[
        'flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors',
        isMe ? 'border-turmeric/60 bg-turmeric/10' : 'border-k-border bg-surface/40',
        compact ? '' : 'can-hover:hover:border-turmeric/50',
      ].join(' ')}
    >
      <span className="flex w-7 shrink-0 items-center justify-center">
        {medal ? (
          <medal.icon size={compact ? 16 : 18} style={{ color: medal.color }} />
        ) : (
          <span className="game-text text-sm font-bold text-text-secondary tabular-nums">
            {entry.rank}
          </span>
        )}
      </span>

      <span className={compact ? 'text-lg' : 'text-2xl'}>{emoji}</span>

      <div className="min-w-0 flex-1">
        <span className="game-text truncate text-sm font-semibold text-text-primary">
          {entry.name || 'Player'}
        </span>
        {isMe && (
          <span className="ml-2 rounded-full bg-turmeric px-1.5 py-0.5 text-[9px] font-bold text-malt">
            YOU
          </span>
        )}
      </div>

      <Metrics entry={entry} isLevel={isLevel} tint={tint} compact={compact} />
    </motion.li>
  )
}

function Metrics({ entry, isLevel, tint, compact }) {
  if (isLevel) {
    return (
      <div className="flex shrink-0 items-center gap-2.5 sm:gap-3.5">
        {!compact && (
          <MetricCell icon={Move} value={fmtInt(entry.moves)} label="moves" tint={tint} />
        )}
        <MetricCell icon={Timer} value={fmtTime(entry.timeMs)} label="time" tint={tint} />
        <StarCell stars={entry.stars} />
      </div>
    )
  }
  return (
    <div className="flex shrink-0 items-center gap-2.5 sm:gap-3.5">
      <MetricCell icon={Trophy} value={fmtInt(entry.levelsCompleted)} label="levels" tint={tint} />
      <MetricCell icon={Star} value={fmtInt(entry.totalStars)} label="stars" tint={tint} />
      {!compact && (
        <MetricCell icon={Timer} value={fmtTime(entry.totalTimeMs)} label="time" tint={tint} />
      )}
    </div>
  )
}

function MetricCell({ icon: Icon, value, label, tint }) {
  return (
    <div className="flex flex-col items-center">
      <span className="game-text inline-flex items-center gap-1 text-sm font-bold text-text-primary tabular-nums">
        <Icon size={13} style={{ color: tint }} />
        {value}
      </span>
      <span className="game-text text-[9px] uppercase tracking-wide text-text-secondary">
        {label}
      </span>
    </div>
  )
}

function StarCell({ stars }) {
  const s = Math.max(0, Math.min(3, Number(stars) || 0))
  return (
    <div className="flex shrink-0 items-center gap-0.5" aria-label={`${s} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          size={12}
          strokeWidth={2.5}
          className={i < s ? 'text-turmeric' : 'text-text-secondary/40'}
          fill={i < s ? '#FF602F' : 'transparent'}
        />
      ))}
    </div>
  )
}

function ScopeToggle({ scope, onChange, tint }) {
  return (
    <div className="inline-flex gap-1.5">
      {SCOPES.map((s) => {
        const active = scope === s.key
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            aria-pressed={active}
            className={`game-text pressable inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-[background-color,border-color,color] duration-200 ${
              active
                ? 'text-malt shadow-golden-glow'
                : 'border border-k-border bg-surface/60 text-text-secondary can-hover:hover:text-turmeric'
            }`}
            style={active ? { backgroundColor: tint } : undefined}
          >
            <s.icon size={14} />
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

function LevelSelector({ levels, value, onChange, tint }) {
  return (
    <label className="game-text inline-flex items-center gap-2 text-xs text-text-secondary">
      <span className="uppercase tracking-wide">Board</span>
      <select
        value={value ?? 'overall'}
        onChange={(e) => onChange(e.target.value === 'overall' ? null : coerceId(e.target.value))}
        className="game-text rounded-lg border border-k-border bg-surface/70 px-2.5 py-1.5 text-xs font-semibold text-text-primary transition-colors can-hover:hover:border-turmeric"
        style={{ colorScheme: 'dark' }}
      >
        <option value="overall">Overall</option>
        {levels.map((l) => (
          <option key={l.id} value={String(l.id)}>
            Level {l.id}
            {l.name ? ` · ${l.name}` : ''}
          </option>
        ))}
      </select>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tint }} aria-hidden="true" />
    </label>
  )
}

// Level ids can be numeric or string; keep numbers numeric for the API path.
function coerceId(raw) {
  const n = Number(raw)
  return Number.isFinite(n) && String(n) === raw ? n : raw
}

function fmtInt(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString() : '—'
}

function fmtTime(ms) {
  const n = Number(ms)
  return Number.isFinite(n) && n > 0 ? formatMs(n) : '—'
}
