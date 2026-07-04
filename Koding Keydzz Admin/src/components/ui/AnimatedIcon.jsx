import { motion, useReducedMotion } from 'framer-motion';

/**
 * AnimatedIcon — a tasteful framer-motion wrapper around a lucide-react icon.
 *
 * Keeps the admin's Golden (Turmeric + Malt) theme consistent: the icon
 * inherits `currentColor`, so callers control the colour purely with classes
 * (e.g. `className="text-turmeric"`). Animations are intentionally subtle.
 *
 * Props:
 *   icon        lucide-react component (required), e.g. `LayoutDashboard`
 *   size        pixel size (default 18)
 *   className   passed to the icon so callers set colour / spacing
 *   animation   one of: 'hover' | 'spin' | 'pulse' | 'pop' | 'wiggle' | 'none'
 *   glow        when true, adds a soft golden drop-shadow
 *   strokeWidth lucide stroke width (default 2)
 *   ...rest     forwarded to the motion wrapper (onClick, aria-*, etc.)
 *
 * Usage:
 *   <AnimatedIcon icon={Bell} animation="wiggle" className="text-turmeric" />
 */

// Spring used for mount "pop" + hover so motion feels physical, not linear.
const SPRING = { type: 'spring', stiffness: 420, damping: 18 };

const VARIANTS = {
  hover: {
    whileHover: { scale: 1.12, rotate: 4 },
    whileTap: { scale: 0.94 },
    transition: SPRING,
  },
  pop: {
    // Never animate from scale(0) — start from a visible 0.95 so it grows in,
    // not out of nothing (Emil).
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: SPRING,
  },
  pulse: {
    animate: { scale: [1, 1.08, 1], opacity: [0.9, 1, 0.9] },
    transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
  },
  spin: {
    animate: { rotate: 360 },
    transition: { duration: 1, repeat: Infinity, ease: 'linear' },
  },
  wiggle: {
    whileHover: { rotate: [0, -12, 12, -8, 8, 0] },
    transition: { duration: 0.6 },
  },
  none: {},
};

const GLOW_STYLE = {
  filter: 'drop-shadow(0 0 6px rgba(255, 96, 47, 0.55))',
};

export default function AnimatedIcon({
  icon: Icon,
  size = 18,
  className = '',
  animation = 'hover',
  glow = false,
  strokeWidth = 2,
  style,
  ...rest
}) {
  const reduce = useReducedMotion();
  if (!Icon) return null;
  let motionProps = VARIANTS[animation] || VARIANTS.hover;

  // Respect reduced motion: drop transform-based + infinite-loop motion,
  // keep opacity/colour. spin/pulse/wiggle/hover become static.
  if (reduce && ['pulse', 'spin', 'wiggle', 'hover'].includes(animation)) {
    motionProps = {};
  }

  return (
    <motion.span
      className="inline-flex"
      style={glow ? { ...GLOW_STYLE, ...style } : style}
      {...motionProps}
      {...rest}
    >
      <Icon size={size} strokeWidth={strokeWidth} className={className} />
    </motion.span>
  );
}
