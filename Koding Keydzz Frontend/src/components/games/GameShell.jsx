import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, Coins, RotateCcw, Gamepad2, Sparkles } from 'lucide-react'
import PageTransition from '../layout/PageTransition'
import Confetti from '../ui/Confetti'
import Button from '../ui/Button'
import Mascot from '../ui/Mascot'
import AnimatedIcon from '../ui/AnimatedIcon'

/**
 * Shared chrome for every mini-game: themed header, concept badge,
 * and an animated win/celebration overlay that awards XP + coins.
 */
export default function GameShell({
  game,
  children,
  won = false,
  xp = 0,
  coins = 0,
  alreadyMastered = false,
  winMessage,
  onPlayAgain,
}) {
  const hasReward = xp > 0 || coins > 0
  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/games"
              className="game-text inline-flex shrink-0 items-center gap-1 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
            >
              <ArrowLeft size={16} /> Hub
            </Link>
            <motion.span
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              style={{ color: game.tint }}
            >
              {game.icon ? <game.icon size={36} /> : null}
            </motion.span>
            <div>
              <h1 className="font-heading text-2xl font-extrabold">{game.title}</h1>
              <span
                className="game-text inline-block rounded-full px-2.5 py-0.5 text-xs font-bold"
                style={{ background: `${game.tint}22`, color: game.tint }}
              >
                Teaches: {game.concept}
              </span>
            </div>
          </div>
        </div>

        {children}
      </div>

      <AnimatePresence>
        {won && (
          <>
            <Confetti key="game-win" pieces={110} />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.6, y: 40 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 240, damping: 18 }}
                className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-turmeric bg-card p-8 text-center shadow-golden-glow-lg scrollbar-thin"
              >
                <Mascot size={96} message={winMessage || 'You cracked it, hero!'} />
                <h2 className="game-text mt-6 flex items-center justify-center gap-2 text-2xl font-bold text-turmeric">
                  Victory! <AnimatedIcon icon={Sparkles} size={24} animation="pulse" glow />
                </h2>
                {hasReward ? (
                  <div className="mt-5 flex justify-center gap-6">
                    <Reward icon={Zap} value={`+${xp}`} label="XP" />
                    <Reward icon={Coins} value={`+${coins}`} label="Coins" />
                  </div>
                ) : alreadyMastered ? (
                  <p className="game-text mx-auto mt-5 max-w-[18rem] rounded-xl border border-k-border bg-surface/40 px-3 py-2 text-xs text-text-secondary">
                    Already mastered — no new reward this time.
                  </p>
                ) : null}
                <div className="mt-6 flex justify-center gap-3">
                  {onPlayAgain && (
                    <Button onClick={onPlayAgain} className="flex items-center gap-2">
                      <AnimatedIcon icon={RotateCcw} size={18} animation="hover" /> Play Again
                    </Button>
                  )}
                  <Link to="/games">
                    <Button variant="secondary" className="flex items-center gap-2">
                      <AnimatedIcon icon={Gamepad2} size={18} animation="hover" /> More Games
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </PageTransition>
  )
}

function Reward({ icon, value, label }) {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.2 }}
      className="text-center"
    >
      <div className="flex justify-center text-turmeric">
        <AnimatedIcon icon={icon} size={30} animation="pop" glow />
      </div>
      <div className="game-text text-xl font-bold text-turmeric">{value}</div>
      <div className="text-xs text-text-secondary">{label}</div>
    </motion.div>
  )
}
