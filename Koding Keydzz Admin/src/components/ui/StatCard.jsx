import { motion, useReducedMotion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import AnimatedIcon from './AnimatedIcon';

export default function StatCard({ label, value, icon: Icon, delta, hint, index = 0 }) {
  const positive = typeof delta === 'number' ? delta >= 0 : null;
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="k-card group relative overflow-hidden p-5"
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-turmeric/5 transition-transform duration-300 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-125" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {label}
          </p>
          <p className="mt-2 font-heading text-3xl font-extrabold text-text-primary">
            {value}
          </p>
          {(hint || delta != null) && (
            <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary/70">
              {delta != null && (
                <span className={`inline-flex items-center gap-0.5 ${positive ? 'text-success' : 'text-error'}`}>
                  <AnimatedIcon
                    icon={positive ? TrendingUp : TrendingDown}
                    size={13}
                    animation="pop"
                  />
                  {Math.abs(delta)}%
                </span>
              )}
              {hint}
            </p>
          )}
        </div>
        {Icon && (
          <motion.div
            className="rounded-xl bg-turmeric/15 p-2.5 text-turmeric"
            animate={reduce ? undefined : { y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: index * 0.2 }}
          >
            <AnimatedIcon icon={Icon} size={22} animation="pulse" className="text-turmeric" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
