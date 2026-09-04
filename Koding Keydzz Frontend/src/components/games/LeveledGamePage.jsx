import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Trophy, LayoutGrid, Lock, Sparkles } from 'lucide-react'
import PageTransition from '../layout/PageTransition'
import useGameLevels from '../../games/shared/useGameLevels'
import { useGetCoursesQuery } from '../../features/courses/coursesApi'
import { unlockedLevels, nextTierCount, isTiered } from '../../games/shared/levelTiers'
import LevelSelectGrid from './LevelSelectGrid'
import GameLeaderboard from './GameLeaderboard'

/**
 * LeveledGamePage — shared page chrome for a leveled mini-game:
 * Games-Hub back link, a LevelSelectGrid, and an animated swap into the
 * per-level play view. Wires useGameLevels (progress + reward persistence)
 * and passes completeLevel through to the play engine via renderPlay.
 *
 * Props:
 *   gameKey   game slug (also the localStorage progress key)
 *   game      meta { title, icon?, concept?, tint? }
 *   levels    ordered level list
 *   renderPlay({ level, onExit, onNext, hasNext, completeLevel }) -> ReactNode
 *   backSlot? OPTIONAL node rendered in place of the default "Games Hub" link
 *             (e.g. a "Back to lobby" button). When omitted, behavior is
 *             unchanged.
 */
export default function LeveledGamePage({
  gameKey,
  game,
  levels: allLevels,
  renderPlay,
  backSlot,
}) {
  /**
   * TIERED LEVELS.
   *
   * The puzzle games hold several tiers, and a tier opens when a pupil passes
   * a course. `gameTier` comes from the server with the course ladder — it is
   * not counted here, because these levels pay XP, coins and leaderboard
   * places, and a browser-side count would be one edit away from unlocking
   * everything.
   *
   * Every game funnels its level list through this component, so filtering
   * here is what makes tiering work everywhere at once. Games whose levels
   * carry no `tier` are unaffected: absent means tier 0, i.e. always open.
   *
   * `isLoading` is treated as tier 0 rather than as "no levels": a pupil on a
   * slow connection sees the base set and then the rest appear, instead of an
   * empty game.
   */
  const coursesQuery = useGetCoursesQuery()
  const gameTier = coursesQuery.data?.gameTier ?? 0

  const levels = useMemo(() => unlockedLevels(allLevels, gameTier), [allLevels, gameTier])
  const comingNext = useMemo(() => nextTierCount(allLevels, gameTier), [allLevels, gameTier])
  const tiered = useMemo(() => isTiered(allLevels), [allLevels])

  const { progress, isUnlocked, completeLevel } = useGameLevels(gameKey, levels)
  const [activeId, setActiveId] = useState(null)
  const [showBoard, setShowBoard] = useState(false)

  const activeLevel = activeId != null ? levels.find((l) => l.id === activeId) : null
  const hasNext = activeLevel ? activeLevel.id < levels[levels.length - 1]?.id : false
  const tint = game?.tint || '#FF602F'

  const pick = (level) => {
    const index = levels.indexOf(level)
    if (!isUnlocked(level, index)) return
    setActiveId(level.id)
  }
  const goToLevels = () => setActiveId(null)
  const goToNext = () => {
    if (!activeLevel) return
    const idx = levels.indexOf(activeLevel)
    const next = levels[idx + 1]
    if (next) setActiveId(next.id)
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          {backSlot ?? (
            <Link
              to="/games"
              className="game-text inline-flex items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
            >
              <ArrowLeft size={16} /> Games Hub
            </Link>
          )}
          {!activeLevel && (
            <button
              type="button"
              onClick={() => setShowBoard((v) => !v)}
              aria-pressed={showBoard}
              className={`game-text pressable inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-[background-color,border-color,color] duration-200 ${
                showBoard
                  ? 'text-malt shadow-golden-glow'
                  : 'border border-k-border bg-surface/60 text-text-secondary can-hover:hover:text-turmeric'
              }`}
              style={showBoard ? { backgroundColor: tint } : undefined}
            >
              {showBoard ? <LayoutGrid size={16} /> : <Trophy size={16} />}
              {showBoard ? 'Levels' : 'Leaderboard'}
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {activeLevel ? (
            <motion.div
              key={`play-${activeLevel.id}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              {renderPlay({
                level: activeLevel,
                onExit: goToLevels,
                onNext: goToNext,
                hasNext,
                completeLevel,
                gameKey,
              })}
            </motion.div>
          ) : showBoard ? (
            <motion.div
              key="board"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="mb-5 text-center">
                <h2 className="game-text inline-flex items-center gap-2 text-2xl font-extrabold text-turmeric">
                  <Trophy size={24} style={{ color: tint }} /> {game.title} Leaderboard
                </h2>
              </div>
              <GameLeaderboard gameKey={gameKey} levels={levels} tint={tint} />
            </motion.div>
          ) : (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              {/* Name the reward. "12 more puzzles when you pass the next
                  course" is a reason to go back to the lessons; a silent
                  absence is no reason at all. */}
              {tiered && comingNext > 0 && (
                <p className="game-text mb-3 flex items-start gap-2 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary">
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-turmeric" aria-hidden="true" />
                  <span>
                    <strong className="text-text-primary">{comingNext} more levels</strong> unlock
                    here when you pass your next course.
                  </span>
                </p>
              )}
              {tiered && comingNext === 0 && gameTier > 0 && (
                <p className="game-text mb-3 flex items-start gap-2 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary">
                  <Lock size={15} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                  You have unlocked every level in this game. Nicely done.
                </p>
              )}
              <LevelSelectGrid game={game} levels={levels} progress={progress} onPick={pick} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  )
}
