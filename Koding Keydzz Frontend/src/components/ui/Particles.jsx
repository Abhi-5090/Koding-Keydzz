import { useMemo } from 'react'
import { motion } from 'framer-motion'

// Floating golden coding particles (0/1, {}, <>, etc.)
const SYMBOLS = ['0', '1', '{ }', '< >', '( )', ';', '=>', '#', '✦', '★']

export default function Particles({ count = 24, className = '' }) {
  const items = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 10 + Math.random() * 22,
        delay: Math.random() * 6,
        duration: 6 + Math.random() * 8,
        symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        opacity: 0.1 + Math.random() * 0.4,
      })),
    [count]
  )

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {items.map((p) => (
        <motion.span
          key={p.id}
          className="game-text absolute select-none font-bold text-turmeric"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            fontSize: p.size,
            // Scaled by the theme: the same speck density that reads as
            // depth on deep navy reads as dust on parchment.
            opacity: `calc(${p.opacity} * var(--deco-opacity-mult, 1))`,
          }}
          animate={{ y: [0, -40, 0], rotate: [0, 12, -12, 0] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        >
          {p.symbol}
        </motion.span>
      ))}
    </div>
  )
}
