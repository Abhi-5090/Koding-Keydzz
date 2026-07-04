import { motion } from 'framer-motion'

export default function Card({
  children,
  className = '',
  hover = true,
  glow = false,
  tint,
  style,
  ...props
}) {
  // Default hover glow is Ember; a world-scoped card passes `tint` to glow in
  // its own accent so the surface reads as part of that realm.
  const hoverGlow = tint ? `0 0 32px ${tint}73` : '0 0 32px rgba(255,96,47,0.45)'
  return (
    <motion.div
      whileHover={hover ? { y: -6, boxShadow: hoverGlow } : undefined}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      style={tint && glow ? { boxShadow: `0 0 24px ${tint}80`, ...style } : style}
      className={`bg-card border border-k-border rounded-2xl p-6 ${
        glow && !tint ? 'shadow-golden-glow' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  )
}
