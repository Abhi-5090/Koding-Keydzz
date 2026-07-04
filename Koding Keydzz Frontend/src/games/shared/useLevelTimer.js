import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * formatMs(ms) -> "mm:ss.d" (deci-seconds). Big runs cap gracefully at
 * "99:59.9" so a runaway timer never overflows the HUD.
 */
export function formatMs(ms) {
  const total = Math.max(0, Math.floor(Number(ms) || 0))
  const CAP = (99 * 60 + 59) * 1000 + 900 // 99:59.9
  const capped = Math.min(total, CAP)
  const minutes = Math.floor(capped / 60000)
  const seconds = Math.floor((capped % 60000) / 1000)
  const deci = Math.floor((capped % 1000) / 100)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${deci}`
}

/**
 * useLevelTimer — a tiny stopwatch for a single mini-game run.
 *
 * It measures wall-clock time with performance.now() (accurate) and ticks a
 * display value roughly every 100 ms for a smooth mm:ss.d HUD. The precise,
 * up-to-the-millisecond value is always available via `elapsedMs()` — use that
 * when recording the metric on a win (the ticked `elapsed` can lag by <100 ms).
 *
 * @param {object}  [options]
 * @param {boolean} [options.autoStart=true]  start counting on mount
 *
 * Returns:
 *   elapsed      number   ticked elapsed ms (for display; re-renders)
 *   formatted    string   `formatMs(elapsed)`
 *   running      boolean  whether the clock is currently counting
 *   elapsedMs()  ()=>num  precise current elapsed ms (no re-render)
 *   start()      begin (or resume) counting; no-op if already running
 *   stop()       pause; returns the precise elapsed ms
 *   reset(opts?) zero the clock; `{ start }` controls whether it resumes
 *                (defaults to `autoStart`)
 */
export default function useLevelTimer(options = {}) {
  const { autoStart = true } = options

  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)

  const runningRef = useRef(false)
  const baseRef = useRef(0) // accumulated ms from previous run segments
  const startTsRef = useRef(0) // performance.now() at the current segment start
  const intervalRef = useRef(null)

  const now = () =>
    typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()

  const clearTick = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const elapsedMs = useCallback(
    () => (runningRef.current ? baseRef.current + (now() - startTsRef.current) : baseRef.current),
    []
  )

  const startTick = useCallback(() => {
    clearTick()
    intervalRef.current = setInterval(() => {
      if (!runningRef.current) return
      setElapsed(baseRef.current + (now() - startTsRef.current))
    }, 100)
  }, [])

  const start = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)
    startTsRef.current = now()
    startTick()
  }, [startTick])

  const stop = useCallback(() => {
    if (!runningRef.current) return baseRef.current
    baseRef.current += now() - startTsRef.current
    runningRef.current = false
    setRunning(false)
    clearTick()
    setElapsed(baseRef.current)
    return baseRef.current
  }, [])

  const reset = useCallback(
    (opts = {}) => {
      const shouldStart = opts.start ?? autoStart
      baseRef.current = 0
      setElapsed(0)
      if (shouldStart) {
        runningRef.current = true
        setRunning(true)
        startTsRef.current = now()
        startTick()
      } else {
        runningRef.current = false
        setRunning(false)
        clearTick()
      }
    },
    [autoStart, startTick]
  )

  // Start on mount when requested; always clean up the interval on unmount.
  useEffect(() => {
    if (autoStart) start()
    return clearTick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { elapsed, formatted: formatMs(elapsed), running, elapsedMs, start, stop, reset }
}
