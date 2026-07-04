import { motion } from 'framer-motion';

export default function ChartCard({ title, subtitle, children, action, index = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className={`k-card p-5 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-heading text-base font-bold text-text-primary">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-text-secondary/70">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className="h-64 w-full">{children}</div>
    </motion.div>
  );
}
