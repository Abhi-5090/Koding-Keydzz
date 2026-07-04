import { motion } from 'framer-motion'
import { Star, Zap, Coins, ArrowRight, RotateCcw, LayoutGrid, Loader2, Timer, Move, Trophy } from 'lucide-react'
import Confetti from '../ui/Confetti'
import Button from '../ui/Button'
import GameLeaderboard from './GameLeaderboard'
import { formatMs } from '../../games/shared/useLevelTimer'

/**
 * LevelWinOverlay — shared celebration overlay for the level-based mini-games.
 * Spring-pops 3 stars (stagger), shows a message and the BACKEND-awarded
 * XP/coins (never client-fabricated). When awaiting the award, a small spinner
 * shows; when the level was already mastered, a subtle 0-reward note appears.
 *
 * When run metrics are provided it also shows the player's run (time + moves),
 * their level rank ("You're #3 on this level!") and a compact top-3 for that
 * level (fetched live via GameLeaderboard).
 *
 * Props:
 *   stars           0..3 earned this attempt
 *   message         string (engine/feedback message)
 *   reward          { xp, coins } | null   (first-completion award)
 *   alreadyMastered boolean
 *   awarding        boolean (true while the backend award is in flight)
 *   stats?          [{ icon, value, label }]   optional extra stat chips
 *   runTime?        number  this run's elapsed ms (shown in a run summary)
 *   runMoves?       number  this run's move metric
 *   levelRank?      number|null  the player's rank on this level after the run
 *   gameKey?        string  enables the compact per-level leaderboard
 *   levelId?        string|number  the level to show the compact board for
 *   hasNext         boolean
 *   onNext, onReplay, onLevels
 *   confettiKey?    string (change to re-fire the burst)
 */
export default function LevelWinOverlay({
  stars,
  message,
  reward,
  alreadyMastered,
  awarding = false,
  stats,
  runTime,
  runMoves,
  levelRank,
  gameKey,
  levelId,
  hasNext,
  onNext,
  onReplay,
  onLevels,
  confettiKey = 'level-win',
}) {
  const hasRun = Number.isFinite(runTime) || Number.isFinite(runMoves)
  const showBoard = Boolean(gameKey) && levelId != null
  return (
    <>
      <Confetti key={confettiKey} pieces={120} />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      >
        <motion.div
          role="dialog"
          aria-label="Level complete"
          initial={{ scale: 0.7, y: 32, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-turmeric bg-card p-7 text-center shadow-golden-glow-lg scrollbar-thin"
        >
          <div className="mb-4 flex items-center justify-center gap-3">
            {[0, 1, 2].map((i) => {
              const earned = i < stars
              return (
                <motion.span
                  key={i}
                  initial={{ scale: 0.6, opacity: 0, rotate: -25 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 360,
                    damping: 14,
                    delay: 0.15 + i * 0.16,
                  }}
                >
                  <Star
                    size={i === 1 ? 52 : 44}
                    strokeWidth={2}
                    className={earned ? 'text-turmeric' : 'text-surface'}
                    fill={earned ? '#FF602F' : 'transparent'}
                    style={earned ? { filter: 'drop-shadow(0 0 10px rgba(255,96,47,0.7))' } : undefined}
                  />
                </motion.span>
              )
            })}
          </div>

          <h2 className="game-text text-2xl font-extrabold text-turmeric">
            {stars === 3 ? 'Perfect!' : stars === 2 ? 'Nice work!' : 'Solved!'}
          </h2>
          {message && (
            <p className="game-text mx-auto mt-2 max-w-[20rem] text-sm text-text-secondary">
              {message}
            </p>
          )}

          {stats && stats.length > 0 && (
            <div className="mt-5 flex justify-center gap-3">
              {stats.map((s, i) => (
                <Stat key={i} icon={s.icon} value={s.value} label={s.label} />
              ))}
            </div>
          )}

          {/* Reward area — backend award is the source of truth. */}
          {awarding ? (
            <div className="mt-5 flex items-center justify-center gap-2 text-text-secondary">
              <Loader2 size={16} className="animate-spin" />
              <span className="game-text text-sm">Saving your reward…</span>
            </div>
          ) : reward ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-5 flex items-center justify-center gap-5 rounded-2xl border border-k-border bg-surface/60 py-3"
            >
              <RewardChip icon={Zap} value={`+${reward.xp}`} label="XP" />
              <span className="h-8 w-px bg-k-border" />
              <RewardChip icon={Coins} value={`+${reward.coins}`} label="Coins" />
            </motion.div>
          ) : alreadyMastered ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="game-text mx-auto mt-5 max-w-[18rem] rounded-xl border border-k-border bg-surface/40 px-3 py-2 text-xs text-text-secondary"
            >
              Already mastered — no new reward this time.
            </motion.p>
          ) : null}

          {/* This run's time + moves. */}
          {hasRun && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-5 flex items-center justify-center gap-5 rounded-2xl border border-k-border bg-surface/50 py-2.5"
            >
              {Number.isFinite(runTime) && (
                <RunChip icon={Timer} value={formatMs(runTime)} label="your time" />
              )}
              {Number.isFinite(runTime) && Number.isFinite(runMoves) && (
                <span className="h-7 w-px bg-k-border" />
              )}
              {Number.isFinite(runMoves) && (
                <RunChip icon={Move} value={runMoves} label="moves" />
              )}
            </motion.div>
          )}

          {/* Level rank shout-out. */}
          {Number.isFinite(levelRank) && (
            <motion.p
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45, type: 'spring', stiffness: 300, damping: 18 }}
              className="game-text mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-turmeric/60 bg-turmeric/10 px-3 py-1.5 text-sm font-bold text-turmeric"
            >
              <Trophy size={15} /> You&apos;re #{levelRank} on this level!
            </motion.p>
          )}

          {/* Compact top-3 for this level. */}
          {showBoard && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-4 text-left"
            >
              <p className="game-text mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-text-secondary">
                Top of this level
              </p>
              <GameLeaderboard
                gameKey={gameKey}
                initialLevelId={levelId}
                showScopeToggle={false}
                showLevelSelector={false}
                compact
                limit={3}
              />
            </motion.div>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {hasNext && (
              <Button onClick={onNext} className="inline-flex items-center gap-1.5">
                Next Level <ArrowRight size={17} />
              </Button>
            )}
            <Button variant="secondary" onClick={onReplay} className="inline-flex items-center gap-1.5">
              <RotateCcw size={16} /> Replay
            </Button>
            <Button variant="ghost" onClick={onLevels} className="inline-flex items-center gap-1.5">
              <LayoutGrid size={16} /> Levels
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="flex min-w-[5rem] flex-col items-center rounded-xl border border-k-border bg-surface/50 px-4 py-2">
      {Icon ? <Icon size={18} className="text-text-secondary" /> : null}
      <span className="game-text mt-1 text-lg font-bold text-text-primary tabular-nums">{value}</span>
      <span className="game-text text-[11px] text-text-secondary">{label}</span>
    </div>
  )
}

function RewardChip({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-2 text-turmeric">
      <Icon size={22} />
      <div className="text-left">
        <div className="game-text text-lg font-bold leading-none">{value}</div>
        <div className="game-text text-[11px] text-text-secondary">{label}</div>
      </div>
    </div>
  )
}

function RunChip({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-2 text-text-primary">
      <Icon size={18} className="text-turmeric" />
      <div className="text-left">
        <div className="game-text text-base font-bold leading-none tabular-nums">{value}</div>
        <div className="game-text text-[11px] text-text-secondary">{label}</div>
      </div>
    </div>
  )
}
