import { motion, useReducedMotion } from 'framer-motion'

/**
 * AnimatedIcon — a composable framer-motion wrapper around a lucide-react icon.
 *
 *   import { Trophy } from 'lucide-react'
 *   <AnimatedIcon icon={Trophy} size={24} className="text-turmeric" animation="pop" glow />
 *
 * Props:
 *  - icon        lucide icon component (required)
 *  - size        px size of the glyph (default 20)
 *  - className   passed to the icon (use text-turmeric etc. — color = currentColor)
 *  - animation   'hover' | 'spin' | 'pulse' | 'bounce' | 'float' | 'pop' | 'none'
 *  - glow        adds a soft golden drop-shadow
 *  - strokeWidth lucide stroke width (default 2)
 *
 * Respects prefers-reduced-motion: looping/continuous animations are disabled,
 * leaving a static (but still styled) icon.
 */
export default function AnimatedIcon({
  icon: Icon,
  size = 20,
  className = '',
  animation = 'hover',
  glow = false,
  glowColor = 'rgba(255, 96, 47, 0.7)',
  strokeWidth = 2,
  style,
  ...props
}) {
  const reduce = useReducedMotion()
  if (!Icon) return null

  // Glow defaults to Ember; pass `glowColor` (e.g. `${tint}b3`) so a world-scoped
  // icon glows in its own accent.
  // The blur radius is scaled by --glow-strength, which theme.css sets to 1 in
  // dark and 0 in light. At 0 the shadow sits exactly behind the icon and is
  // invisible — so a glow that reads as atmosphere on deep teal does not read
  // as an out-of-focus icon on cream. One variable, all 44 call sites.
  const glowStyle = glow
    ? {
        filter: `drop-shadow(0 0 calc(6px * var(--glow-strength, 1)) ${glowColor})`,
        ...style,
      }
    : style

  // Per-variant motion config. Hover/pop are safe under reduced-motion;
  // continuous loops are dropped when the user asks for less motion.
  const variants = {
    hover: {
      whileHover: { scale: 1.15, rotate: 6 },
      whileTap: { scale: 0.92 },
      transition: { type: 'spring', stiffness: 400, damping: 15 },
    },
    spin: {
      animate: reduce ? {} : { rotate: 360 },
      transition: { duration: 1, repeat: Infinity, ease: 'linear' },
    },
    pulse: {
      animate: reduce ? {} : { scale: [1, 1.18, 1] },
      transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
    },
    bounce: {
      animate: reduce ? {} : { y: [0, -6, 0] },
      transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
    },
    float: {
      animate: reduce ? {} : { y: [0, -8, 0], rotate: [0, -3, 3, 0] },
      transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
    },
    pop: {
      initial: { scale: 0, rotate: -30 },
      animate: { scale: 1, rotate: 0 },
      transition: { type: 'spring', stiffness: 500, damping: 14 },
    },
    none: {},
  }

  const motionProps = variants[animation] || variants.hover

  return (
    <motion.span
      className={`inline-flex items-center justify-center ${className}`}
      style={glowStyle}
      {...motionProps}
      {...props}
    >
      <Icon size={size} strokeWidth={strokeWidth} />
    </motion.span>
  )
}
