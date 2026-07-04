import { motion } from 'framer-motion'

const EASE_OUT = [0.23, 1, 0.32, 1]

const variants = {
  primary:
    'bg-turmeric text-malt hover:bg-accent shadow-golden-glow font-bold',
  secondary:
    'bg-surface text-text-primary border border-k-border hover:border-turmeric',
  ghost: 'bg-transparent text-text-secondary hover:text-turmeric',
  danger: 'bg-error text-white hover:opacity-90',
}

const sizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
}

// Per-world accent variants. When `tint` is passed, the button drops the global
// Ember styling and adopts the world colour: primary → solid tint fill with DARK
// (malt) text for contrast + a tint glow; secondary/ghost → tint border/text on
// hover via a scoped `--tint` CSS var. Global chrome omits `tint` and stays Ember.
const tintVariants = {
  primary: 'text-malt font-bold',
  secondary:
    'bg-surface text-text-primary border border-k-border can-hover:hover:[border-color:var(--tint)]',
  ghost: 'bg-transparent text-text-secondary can-hover:hover:[color:var(--tint)]',
  danger: 'bg-error text-white hover:opacity-90',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  glow = true,
  tint,
  type = 'button',
  disabled = false,
  style,
  ...props
}) {
  const tinted = Boolean(tint)
  let tintStyle = style
  if (tinted) {
    tintStyle = { '--tint': tint, ...style }
    if (variant === 'primary') {
      tintStyle = { background: tint, boxShadow: `0 0 24px ${tint}80`, ...tintStyle }
    } else if (variant === 'secondary') {
      tintStyle = { borderColor: `${tint}55`, ...tintStyle }
    }
  }

  const variantClass = tinted ? tintVariants[variant] : variants[variant]

  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      transition={{ duration: 0.15, ease: EASE_OUT }}
      style={tintStyle}
      className={`game-text rounded-xl transition-[background-color,border-color,color,box-shadow,opacity] duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variantClass} ${sizes[size]} ${!tinted && glow && variant === 'primary' ? 'hover:shadow-golden-glow-lg' : ''} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  )
}
