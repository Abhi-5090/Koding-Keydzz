import { motion } from 'framer-motion'
import { Globe, Bot, Rocket, Star, Sparkles, Settings, Lightbulb } from 'lucide-react'

// Big floating game elements: planets, robots, stars, gears.
const SHAPES = [
  { Icon: Globe, size: 80, x: '8%', y: '15%', dur: 9 },
  { Icon: Bot, size: 64, x: '82%', y: '20%', dur: 7 },
  { Icon: Rocket, size: 56, x: '70%', y: '70%', dur: 8 },
  { Icon: Star, size: 40, x: '20%', y: '75%', dur: 6 },
  { Icon: Sparkles, size: 36, x: '50%', y: '12%', dur: 7.5 },
  { Icon: Settings, size: 48, x: '90%', y: '60%', dur: 10 },
  { Icon: Lightbulb, size: 44, x: '35%', y: '45%', dur: 6.5 },
]

export default function FloatingShapes({ className = '' }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {SHAPES.map((s, i) => (
        <motion.div
          key={i}
          /* Decoration tuned for a DARK ground. On the light parchment the
             same 60% ember reads as clutter instead of atmosphere, and the
             halo reads as smudge — so both are scaled by the theme:
             --deco-opacity and --glow-strength (see theme.css). */
          className="absolute text-turmeric"
          style={{
            opacity: 'var(--deco-opacity, 0.6)',
            filter:
              'drop-shadow(0 0 calc(18px * var(--glow-strength, 1)) rgb(var(--c-ember) / 0.5))',
          }}
          style={{ left: s.x, top: s.y }}
          animate={{ y: [0, -28, 0], rotate: [0, 8, -8, 0] }}
          transition={{ duration: s.dur, repeat: Infinity, ease: 'easeInOut' }}
        >
          <s.Icon size={s.size} />
        </motion.div>
      ))}
    </div>
  )
}
