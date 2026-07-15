import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import AnimatedIcon from './AnimatedIcon';

const variants = {
  primary:
    'bg-turmeric text-malt hover:bg-accent shadow-glow font-semibold',
  secondary:
    'bg-surface text-text-primary border border-k-border hover:border-turmeric',
  ghost: 'bg-transparent text-text-secondary hover:text-turmeric',
  danger: 'bg-error/90 text-white hover:bg-error font-semibold',
  outline:
    'bg-transparent border border-turmeric text-turmeric hover:bg-turmeric/10',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  disabled = false,
  loading = false,
  icon: Icon,
  ...props
}) {
  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
      disabled={disabled || loading}
      style={{
        transition:
          'background-color 140ms cubic-bezier(0.23,1,0.32,1), border-color 140ms cubic-bezier(0.23,1,0.32,1), color 140ms cubic-bezier(0.23,1,0.32,1)',
      }}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl
        disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <AnimatedIcon icon={Loader2} size={size === 'sm' ? 14 : 18} animation="spin" />
      ) : (
        Icon && <AnimatedIcon icon={Icon} size={size === 'sm' ? 14 : 18} animation="pop" />
      )}
      {children}
    </motion.button>
  );
}
