import { motion } from 'framer-motion'
import { Coins } from 'lucide-react'

export default function CoinCounter({ coins = 0, className = '' }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`flex items-center gap-2 rounded-full border border-k-border bg-surface/70 px-3 py-1.5 ${className}`}
    >
      <motion.span
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        className="text-turmeric"
      >
        <Coins size={20} />
      </motion.span>
      <span className="game-text font-bold text-turmeric">{coins.toLocaleString()}</span>
    </motion.div>
  )
}
