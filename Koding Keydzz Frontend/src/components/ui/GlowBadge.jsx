import { motion } from 'framer-motion'
import AnimatedIcon from './AnimatedIcon'

const rarityColors = {
  Common: 'border-text-secondary/40 text-text-secondary',
  Rare: 'border-success text-success',
  Epic: 'border-turmeric text-turmeric',
  Legendary: 'border-accent text-accent shadow-golden-glow',
}

export default function GlowBadge({
  icon,
  label,
  rarity = 'Common',
  earned = true,
  className = '',
}) {
  // `icon` may be a lucide component (preferred) or an emoji/string from backend
  // content. Render components through AnimatedIcon; fall back to text otherwise.
  const isComponent = typeof icon === 'function' || typeof icon === 'object'

  return (
    <motion.div
      whileHover={{ scale: 1.08, rotate: earned ? 2 : 0 }}
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 bg-surface/60 px-4 py-4 text-center transition-[background-color,border-color,color,box-shadow] duration-200 ${
        rarityColors[rarity]
      } ${earned ? '' : 'opacity-40 grayscale'} ${className}`}
    >
      {isComponent ? (
        <AnimatedIcon icon={icon} size={36} animation={earned ? 'float' : 'none'} glow={earned} />
      ) : (
        <span className={`text-4xl ${earned ? 'animate-float' : ''}`}>{icon}</span>
      )}
      <span className="game-text w-full break-words text-sm font-semibold leading-tight text-text-primary">{label}</span>
      <span className="text-[10px] uppercase tracking-wider">{rarity}</span>
    </motion.div>
  )
}
