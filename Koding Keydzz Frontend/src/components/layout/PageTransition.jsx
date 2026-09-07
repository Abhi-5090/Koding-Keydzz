import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { revealIn } from '../../motion/animations'

/** The app's standard ease-out curve — slow to settle, no overshoot. */
const EASE_OUT = [0.23, 1, 0.32, 1]

// `useLayoutEffect` warns while server rendering. This app is client-only, but
// the guard keeps the jsdom tests quiet and correct.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * THE PAGE CHANGE, AND THE CONTENT ARRIVING TOP TO BOTTOM.
 *
 * WHY THE PAGE TRANSITION LIVES HERE
 * ----------------------------------
 * The exit half of it never used to run. `AnimatePresence` was wrapped around
 * a bare `<Outlet />`, which carries the same (absent) key on every route, so
 * Framer never saw one child leave and another arrive. The outgoing page was
 * removed by React in a single frame and the incoming one animated in from
 * `y: 16` — content blanking, then jumping up into place.
 *
 * With the outlet keyed on the pathname, `mode="wait"` runs the exit first and
 * the enter after, so one page hands over to the next.
 *
 * WHY THE STAGGER LIVES HERE TOO
 * ------------------------------
 * Only two screens revealed their sections in sequence; the other nineteen
 * appeared all at once, so the app settled differently depending on where you
 * were. Doing it per page would mean nineteen more edits and nineteen more
 * chances for the timing to drift apart.
 *
 * Almost every page already wraps its content in this component, so staggering
 * its DIRECT children gives every screen the same top-to-bottom arrival from
 * one place. Sections that already have their own inner reveal keep it — they
 * target different elements, so the two nest rather than fight.
 *
 * WHY IT RE-RUNS ON THE CHILD COUNT
 * ---------------------------------
 * A page mounts showing a spinner and swaps in its content when the query
 * resolves. React reconciles the same component here, so a mount-only effect
 * would stagger the SPINNER and then drop the real content in unannounced —
 * which is the opposite of what is wanted. Watching how many element children
 * there are catches that swap without the page having to say anything.
 */
export default function PageTransition({ children, className = '' }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const [childCount, setChildCount] = useState(0)

  /**
   * Read the child count after each render. Cheap — it is one DOM property —
   * and it is what tells the reveal below that the page swapped its loader for
   * real content.
   */
  useIsomorphicLayoutEffect(() => {
    const next = ref.current?.children.length ?? 0
    setChildCount((current) => (current === next ? current : next))
  })

  useIsomorphicLayoutEffect(() => {
    if (reduce || !ref.current) return undefined
    const targets = Array.from(ref.current.children)
    if (targets.length === 0) return undefined
    /**
     * A single section gets no stagger — there is nothing to stagger against,
     * and a lone card sliding up reads as a stutter on top of the page
     * transition that is already running.
     */
    if (targets.length === 1) return undefined
    return revealIn(targets, { y: 14, duration: 0.42, stagger: 0.05 })
  }, [reduce, childCount])

  if (reduce) {
    /**
     * Reduced motion keeps the fade and drops the travel. Removing the
     * transition altogether would put back the hard cut this exists to
     * smooth, which is not what the preference asks for.
     */
    return (
      <motion.div
        ref={ref}
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
      ref={ref}
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
