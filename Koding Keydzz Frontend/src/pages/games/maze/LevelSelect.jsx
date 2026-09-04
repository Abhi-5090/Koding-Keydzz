import { motion } from 'framer-motion'
import { Lock, Star, Trophy } from 'lucide-react'
import levels from '../../../data/mazeLevels'

const SECTIONS = [
  { key: 'easy', label: 'Easy', tint: '#34D399' },
  { key: 'medium', label: 'Medium', tint: '#FF6A3D' },
  { key: 'hard', label: 'Hard', tint: '#FF5470' },
]

const TOTAL_STARS = levels.length * 3

/**
 * LevelSelect — overview screen: progress header + Easy/Medium/Hard sections.
 *
 * Props:
 *  bestStars(id), isUnlocked(id), onPlay(level)
 */
export default function LevelSelect({ bestStars, isUnlocked, onPlay }) {
  const completed = levels.filter((l) => bestStars(l.id) >= 1).length
  const starsEarned = levels.reduce((sum, l) => sum + bestStars(l.id), 0)

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="game-text text-3xl font-extrabold text-turmeric">Maze Coding</h2>
        <p className="game-text mt-1 text-sm text-text-secondary">
          Program the robot to reach the flag in 50 mazes.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <ProgressPill icon={Trophy} value={`${completed}/${levels.length}`} label="completed" />
          <ProgressPill icon={Star} value={`${starsEarned}/${TOTAL_STARS}`} label="stars" />
        </div>
      </div>

      {SECTIONS.map((section) => {
        const items = levels.filter((l) => l.difficulty === section.key)
        return (
          <section key={section.key} className="mb-8">
            <h3
              className="game-text mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold"
              style={{ background: `${section.tint}22`, color: section.tint }}
            >
              {section.label}
              <span className="text-text-secondary">· {items.length} levels</span>
            </h3>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
              {items.map((level, i) => (
                <LevelNode
                  key={level.id}
                  level={level}
                  index={i}
                  tint={section.tint}
                  stars={bestStars(level.id)}
                  unlocked={isUnlocked(level.id)}
                  onPlay={() => onPlay(level)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function LevelNode({ level, index, tint, stars, unlocked, onPlay }) {
  const beaten = stars >= 1
  // Unlocked but unbeaten -> ember glow to draw the eye.
  const glow = unlocked && !beaten

  return (
    <motion.button
      type="button"
      disabled={!unlocked}
      onClick={onPlay}
      initial={{ opacity: 0, y: 14, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.05, 0.5),
        type: 'spring',
        stiffness: 320,
        damping: 24,
      }}
      whileTap={unlocked ? { scale: 0.97 } : undefined}
      className={[
        'group relative flex aspect-square flex-col items-center justify-center rounded-2xl border p-1.5 transition-colors duration-200',
        unlocked
          ? 'border-k-border bg-card can-hover:hover:border-turmeric'
          : 'cursor-not-allowed border-k-border/40 bg-surface/40 opacity-50',
        glow ? 'animate-pulse-glow border-turmeric/60' : '',
        unlocked ? 'can-hover:hover:-translate-y-1' : '',
      ].join(' ')}
      style={beaten ? { boxShadow: '0 0 14px rgba(255,96,47,0.18)' } : undefined}
      aria-label={
        unlocked
          ? `Level ${level.id}, ${level.name}, ${stars} of 3 stars`
          : `Level ${level.id}, locked`
      }
    >
      {!unlocked ? (
        <Lock size={20} className="text-text-secondary" />
      ) : (
        <>
          <span className="game-text text-lg font-extrabold leading-none text-text-primary">
            {level.id}
          </span>
          <span className="mt-1 flex gap-0.5">
            {[0, 1, 2].map((s) => (
              <Star
                key={s}
                size={9}
                strokeWidth={2.5}
                className={s < stars ? 'text-turmeric' : 'text-text-secondary/70'}
                fill={s < stars ? '#FF602F' : 'transparent'}
              />
            ))}
          </span>
        </>
      )}
    </motion.button>
  )
}

function ProgressPill({ icon: Icon, value, label }) {
  return (
    <div className="game-text inline-flex items-center gap-2 rounded-full border border-k-border bg-surface/60 px-4 py-1.5">
      <Icon size={16} className="text-turmeric" />
      <span className="text-sm font-bold text-text-primary tabular-nums">{value}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  )
}
