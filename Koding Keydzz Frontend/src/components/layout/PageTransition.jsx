import { motion, useReducedMotion } from 'framer-motion'

/** The app's standard ease-out curve — slow to settle, no overshoot. */
const EASE_OUT = [0.23, 1, 0.32, 1]

/**
 * THE PAGE CHANGE.
 *
 * WHY IT USED TO FLICKER
 * ----------------------
 * The exit half of this never ran. `AnimatePresence` was wrapped around a bare
 * `<Outlet />`, which renders the same element with the same (absent) key on
 * every route — so Framer never saw one child leave and another arrive. The
 * outgoing page was therefore removed by React in a single frame, and the
 * incoming one animated in from `y: 16`. What that looks like is the content
 * blanking and then jumping up into place: the flicker.
 *
 * With the outlet keyed on the pathname, `mode="wait"` runs the exit first and
 * the enter after, so one page hands over to the next.
 *
 * WHY THE MOVEMENT IS SMALL AND THE EXIT IS QUICK
 * -----------------------------------------------
 * `mode="wait"` costs exit + enter before anything is readable, so a
 * symmetrical 350ms each way makes every navigation feel slow. The exit is
 * shortened to a near-instant fade and the entrance carries the easing; the
 * travel is 8px rather than 16px, which reads as settling rather than sliding.
 */
export default function PageTransition({ children, className = '' }) {
  const reduce = useReducedMotion()

  /**
   * Reduced motion keeps the fade and drops the travel. Removing the
   * transition altogether would put back the hard cut this exists to smooth,
   * which is not what the preference asks for.
   */
  if (reduce) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        className={className}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{
        duration: 0.32,
        ease: EASE_OUT,
        // The outgoing page should get out of the way quickly; the incoming
        // one is what the reader is waiting for.
        exit: { duration: 0.16, ease: 'easeIn' },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
