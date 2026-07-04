import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Info } from 'lucide-react'
import AnimatedIcon from './AnimatedIcon'

// Ways to earn XP, surfaced in the "How to earn XP" popover.
const EARN_METHODS = [
  { label: 'Finish a lesson', xp: '+100' },
  { label: 'Pass a quiz', xp: '+50' },
  { label: 'Clear a game level', xp: 'varies' },
  { label: 'Daily streak bonus', xp: '+150' },
]

export default function XPBar({
  xp = 0,
  xpToNext = 100,
  level,
  showLabel = true,
  earnHint = false,
  className = '',
}) {
  const pct = Math.min(100, Math.round((xp / xpToNext) * 100))
  const remaining = Math.max(0, Math.round(xpToNext - xp))
  const [openHint, setOpenHint] = useState(false)

  return (
    <div className={`relative w-full ${className}`}>
      {showLabel && (
        <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
          <span className="game-text flex items-center gap-1">
            <AnimatedIcon icon={Zap} size={13} animation="pulse" className="text-turmeric" />
            {level != null ? `Level ${level}` : 'XP'}
            {earnHint && (
              <button
                type="button"
                onClick={() => setOpenHint((o) => !o)}
                onBlur={() => setOpenHint(false)}
                aria-label="How to earn XP"
                aria-expanded={openHint}
                className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-text-secondary transition-colors can-hover:hover:text-turmeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric"
              >
                <Info size={13} />
              </button>
            )}
          </span>
          <span className="game-text">
            {level != null
              ? remaining > 0
                ? `${remaining.toLocaleString()} XP to Level ${level + 1}`
                : `Level ${level + 1} ready!`
              : `${xp} / ${xpToNext} XP`}
          </span>
        </div>
      )}
      <div className="h-3 w-full overflow-hidden rounded-full bg-malt border border-k-border">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          className="h-full rounded-full bg-gradient-to-r from-turmeric to-accent shadow-golden-glow"
        />
      </div>

      <AnimatePresence>
        {earnHint && openHint && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: 'top left' }}
            className="absolute left-0 top-full z-50 mt-2 w-60 rounded-2xl border border-k-border bg-card p-3 shadow-golden-glow"
            role="dialog"
          >
            <p className="game-text mb-2 flex items-center gap-1.5 text-xs font-bold text-turmeric">
              <Zap size={13} /> How to earn XP
            </p>
            <ul className="space-y-1.5">
              {EARN_METHODS.map((m) => (
                <li key={m.label} className="flex items-center justify-between text-xs text-text-secondary">
                  <span className="game-text">{m.label}</span>
                  <span className="game-text font-bold text-turmeric">{m.xp}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
