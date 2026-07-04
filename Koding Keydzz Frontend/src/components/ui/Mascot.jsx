import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

// Keydzz the mascot — a friendly golden robot fox.
export default function Mascot({ size = 120, message, className = '', bobbing = true }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <motion.div
        animate={bobbing ? { y: [0, -14, 0], rotate: [0, -3, 3, 0] } : undefined}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="relative flex items-center justify-center rounded-full bg-gradient-to-br from-turmeric to-accent shadow-golden-glow"
        style={{ width: size, height: size }}
      >
        <span style={{ fontSize: size * 0.55 }}>🦊</span>
        <motion.span
          className="absolute -right-1 -top-1 text-accent"
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7], rotate: [0, 20, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Sparkles size={Math.max(16, size * 0.18)} />
        </motion.span>
      </motion.div>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="game-text relative mt-4 max-w-xs rounded-2xl border border-k-border bg-card px-4 py-3 text-center text-sm text-text-secondary"
        >
          <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-k-border bg-card" />
          {message}
        </motion.div>
      )}
    </div>
  )
}
