import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, HelpCircle } from 'lucide-react'
import Button from '../ui/Button'

/**
 * HowToPlayModal — accessible, reusable "How to Play" dialog for mini-games.
 * Closes on backdrop click, the X button, or Escape. Scrollable body so a
 * little visual example + tips fit comfortably on small screens.
 *
 * Props:
 *   open      boolean
 *   onClose   () => void
 *   title     string
 *   tint      accent color (defaults to turmeric)
 *   children  the explanation content
 */
export default function HowToPlayModal({ open, onClose, title, tint = '#FF602F', children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.85, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border bg-card p-6 shadow-golden-glow-lg"
            style={{ borderColor: `${tint}66` }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="game-text flex items-center gap-2 text-xl font-extrabold text-text-primary">
                <HelpCircle size={22} style={{ color: tint }} />
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close how to play"
                className="rounded-lg border border-k-border bg-surface/60 p-1.5 text-text-secondary transition-colors can-hover:hover:text-turmeric"
              >
                <X size={18} />
              </button>
            </div>

            <div className="game-text space-y-4 text-sm leading-relaxed text-text-secondary">
              {children}
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={onClose}>Got it!</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
