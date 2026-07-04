import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Trophy, LayoutGrid } from 'lucide-react'
import PageTransition from '../../components/layout/PageTransition'
import { getGame } from '../../data/games'
import levels from '../../data/mazeLevels'
import useMazeProgress from './maze/useMazeProgress'
import LevelSelect from './maze/LevelSelect'
import PlayScreen from './maze/PlayScreen'
import GameLeaderboard from '../../components/games/GameLeaderboard'

const GAME_KEY = 'maze-coding'
const game = getGame(GAME_KEY)

/**
 * Maze Coding — 50-level mini-game.
 * Two screens (level select <-> play) with a Back control between them.
 * Progress (best stars per level) persists to localStorage.
 */
export default function MazeCoding() {
  const { bestStars, recordStars, isUnlocked } = useMazeProgress()
  const [activeId, setActiveId] = useState(null)
  const [showBoard, setShowBoard] = useState(false)
  const tint = game?.tint || '#FF602F'

  const activeLevel = activeId != null ? levels.find((l) => l.id === activeId) : null
  const hasNext = activeLevel ? activeLevel.id < levels.length : false

  const goToLevels = () => setActiveId(null)
  const goToNext = () => {
    if (activeLevel && activeLevel.id < levels.length) setActiveId(activeLevel.id + 1)
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            to="/games"
            className="game-text inline-flex items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
          >
            <ArrowLeft size={16} /> Games Hub
          </Link>
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
              <PlayScreen
                level={activeLevel}
                onBack={goToLevels}
                onNext={goToNext}
                hasNext={hasNext}
                recordStars={recordStars}
                gameKey={GAME_KEY}
              />
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
              <GameLeaderboard gameKey={GAME_KEY} levels={levels} tint={tint} />
            </motion.div>
          ) : (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              <LevelSelect
                bestStars={bestStars}
                isUnlocked={isUnlocked}
                onPlay={(level) => setActiveId(level.id)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  )
}
