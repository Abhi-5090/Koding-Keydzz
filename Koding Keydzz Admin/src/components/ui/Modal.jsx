import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import AnimatedIcon from './AnimatedIcon';

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const widths = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  // Close on Escape while the dialog is open.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        >
          {/*
            The backdrop is DECORATIVE, and its click is a convenience.
            Keyboard and screen-reader users close this dialog with Escape
            (wired above), so `aria-hidden` keeps assistive technology from
            announcing a nameless clickable region that duplicates a control
            they already have.
          */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            /* Modals stay centered — transform-origin: center is correct here
               (unlike popovers, which scale from their trigger). Cap the whole
               dialog at the viewport height and let only the body scroll so the
               header + footer stay reachable on short screens. */
            style={{ transformOrigin: 'center' }}
            className={`relative z-10 flex max-h-[90dvh] w-full flex-col ${widths[size]} k-card shadow-2xl`}
            initial={{ scale: 0.95, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: 8, opacity: 0, transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] } }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-k-border px-6 py-4">
              <h3 className="font-heading text-lg font-bold text-text-primary">
                {title}
              </h3>
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="rounded-lg p-1.5 text-text-secondary transition-colors duration-150 ease-out hover:bg-surface hover:text-turmeric active:scale-95"
              >
                <AnimatedIcon icon={X} size={18} animation="wiggle" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && (
              <div className="flex shrink-0 justify-end gap-3 border-t border-k-border px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
