import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'

/**
 * TOASTS — acknowledgement for everything the user does.
 *
 * WHY HAND-ROLLED RATHER THAN A LIBRARY
 * -------------------------------------
 * Three reasons, in order of weight:
 *
 *   1. ACCESSIBILITY. A toast is an announcement, and getting the live-region
 *      semantics right is the entire job: errors must interrupt a screen
 *      reader, confirmations must not. Most libraries put everything in one
 *      region with one politeness setting, which either interrupts constantly
 *      or never announces the failure. Two regions with different politeness
 *      is a handful of lines here and unavailable as a configuration there.
 *   2. This codebase carries no UI dependencies beyond framer-motion and
 *      lucide, and a notification system is not where that should change.
 *   3. Errors have to be de-duplicated and made pausable, and both are easier
 *      to write than to configure around.
 *
 * TWO LIVE REGIONS, DELIBERATELY
 * ------------------------------
 *   • errors      -> role="alert",  aria-live="assertive" — interrupts.
 *   • everything  -> role="status",  aria-live="polite"    — waits its turn.
 *
 * A failed save must be heard immediately; "Saved" must not talk over whatever
 * the user is reading. One region cannot do both.
 *
 * ERRORS DO NOT AUTO-DISMISS. A confirmation that vanishes is fine — the user
 * saw the thing happen. A failure that vanishes leaves somebody who looked
 * away believing their work saved. Errors stay until dismissed.
 */

const ToastContext = createContext(null)

/** How long each kind of toast survives. `null` means "until dismissed". */
const DURATIONS = {
  success: 4000,
  info: 5000,
  warning: 7000,
  error: null,
}

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
}

const TONE = {
  success: 'border-success/50 bg-card text-text-primary',
  info: 'border-k-border bg-card text-text-primary',
  warning: 'border-turmeric/50 bg-card text-text-primary',
  error: 'border-error/60 bg-card text-text-primary',
}

const ICON_TONE = {
  success: 'text-success',
  info: 'text-turmeric',
  warning: 'text-turmeric',
  error: 'text-error',
}

/** Most toasts on screen at once. Older ones are dropped, not queued. */
const MAX_VISIBLE = 4

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    ({ type = 'info', title, message, duration }) => {
      const id = nextId
      nextId += 1

      setToasts((list) => {
        /**
         * DE-DUPLICATE identical messages.
         *
         * A failing request retried three times, or a list mutation that fires
         * per row, would otherwise stack three copies of the same sentence.
         * The existing toast's timer is left alone: re-announcing the same
         * thing tells the user nothing new.
         */
        const duplicate = list.find(
          (t) => t.type === type && t.title === title && t.message === message
        )
        if (duplicate) return list

        // Oldest out first, so the newest is always visible.
        const next = [...list, { id, type, title, message }]
        return next.slice(-MAX_VISIBLE)
      })

      const ms = duration === undefined ? DURATIONS[type] : duration
      if (ms != null) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), ms)
        )
      }
      return id
    },
    [dismiss]
  )

  // Clear every pending timer on unmount so a dismissed provider cannot call
  // setState afterwards.
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      timers.current.clear()
    },
    []
  )

  const api = useMemo(
    () => ({
      push,
      dismiss,
      success: (message, title) => push({ type: 'success', message, title }),
      error: (message, title) => push({ type: 'error', message, title }),
      warning: (message, title) => push({ type: 'warning', message, title }),
      info: (message, title) => push({ type: 'info', message, title }),
    }),
    [push, dismiss]
  )

  /**
   * Published on `window` as well as through context.
   *
   * The RTK Query error middleware is not a React component and cannot use a
   * hook, but it is the single most valuable place to raise a toast from —
   * one listener there covers every failed request in the application. A
   * narrow, documented global is a better answer than threading a dispatcher
   * through the store's middleware chain.
   */
  useEffect(() => {
    window.__kkToast = api
    return () => {
      if (window.__kkToast === api) delete window.__kkToast
    }
  }, [api])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, onDismiss }) {
  const reduce = useReducedMotion()
  if (typeof document === 'undefined') return null

  const errors = toasts.filter((t) => t.type === 'error')
  const others = toasts.filter((t) => t.type !== 'error')

  return createPortal(
    /*
      ONE positioned column, TWO live regions inside it.
      ------------------------------------------------
      The politeness split is the whole reason this component is hand-written:
      a failed save has to interrupt a screen reader, and "Saved" must not talk
      over what the user is reading. One region cannot do both.

      But two separately-positioned `fixed` stacks would sit on top of each
      other, and the obvious patch — offsetting one by a per-toast height —
      is wrong the moment a message wraps to a second line. So both regions are
      ordinary children of a single flex column instead: the browser does the
      stacking, the toasts cannot overlap whatever their height, and each
      region keeps its own `aria-live`.

      Polite toasts render ABOVE errors (errors last, nearest the bottom
      corner) so a stack of confirmations never pushes a failure off-screen.
    */
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="flex flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {others.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} reduce={reduce} />
          ))}
        </AnimatePresence>
      </div>

      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="false"
        className="flex flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {errors.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} reduce={reduce} />
          ))}
        </AnimatePresence>
      </div>
    </div>,
    document.body
  )
}

function ToastCard({ toast, onDismiss, reduce }) {
  const Icon = ICONS[toast.type] || Info

  return (
    <motion.div
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      // The container is pointer-events-none so it never blocks the page
      // each card re-enables them for its own dismiss button.
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg ${
        TONE[toast.type] || TONE.info
      }`}
    >
      <span className={`mt-0.5 shrink-0 ${ICON_TONE[toast.type] || ICON_TONE.info}`}>
        <Icon size={18} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        {toast.title ? (
          <p className="text-sm font-bold leading-snug">{toast.title}</p>
        ) : null}
        {toast.message ? (
          <p className={`text-sm leading-snug ${toast.title ? 'mt-0.5 text-text-secondary' : ''}`}>
            {toast.message}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-m-1 shrink-0 rounded-lg p-1 text-text-secondary transition hover:bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
      >
        <X size={15} aria-hidden="true" />
      </button>
    </motion.div>
  )
}

/**
 * Raise a toast from a component.
 *
 * Returns a no-op shaped like the real thing when there is no provider, so a
 * component rendered in a test without one does not explode over a
 * notification. A missing toast is never worth failing a render for.
 */
export function useToast() {
  const ctx = useContext(ToastContext)
  return (
    ctx || {
      push: () => {},
      dismiss: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    }
  )
}

/** The same API for non-React code (the RTK Query error middleware). */
export function toast() {
  return (
    window.__kkToast || {
      push: () => {},
      dismiss: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    }
  )
}

export default ToastProvider
