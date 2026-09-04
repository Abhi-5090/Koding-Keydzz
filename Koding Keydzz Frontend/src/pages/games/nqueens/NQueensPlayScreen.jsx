import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, RotateCcw, Lightbulb, HelpCircle, Crown, AlertTriangle, Timer, LayoutGrid } from 'lucide-react'
import { attacks, conflicts as findConflicts, isSolved, findSolution } from '../../../games/nqueens/engine'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import LevelWinOverlay from '../../../components/games/LevelWinOverlay'
import NQueensBoard from './NQueensBoard'

const TINT = '#FF8A4D'
const key = (q) => `${q.r},${q.c}`

/** Default countdown if a level somehow omits timeLimit. */
const DEFAULT_TIME = 120

/** mm:ss for the countdown display. */
function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

/**
 * Stars:
 *   3 = no hints AND no more than 2 "misplacements" (placing a queen that
 *       created a conflict);
 *   2 = used at most 1 hint;
 *   1 = solved otherwise.
 */
function starsFor(hints, misplacements) {
  if (hints === 0 && misplacements <= 2) return 3
  if (hints <= 1) return 2
  return 1
}

/**
 * NQueensPlayScreen — play one N-Queens level: tap squares to place/remove
 * queens (Crown), live attack highlighting, hint, reset, win overlay.
 *
 * Props: level, onExit, onNext, hasNext, completeLevel, onHelp, helpOpen
 */
export default function NQueensPlayScreen({ level, onExit, onNext, hasNext, completeLevel, onHelp, helpOpen = false, gameKey }) {
  const { n } = level
  // Hints ramp down by level; never allow more than 2.
  const maxHints = Math.min(2, Math.max(0, level.maxHints ?? 2))
  const timeLimit = Math.max(1, level.timeLimit ?? DEFAULT_TIME)
  const fixedQueens = useMemo(
    () => (level.fixed || []).map(([r, c]) => ({ r, c })),
    [level]
  )
  const fixedSet = useMemo(() => new Set(fixedQueens.map(key)), [fixedQueens])

  const [queens, setQueens] = useState(fixedQueens)
  const [hints, setHints] = useState(0)
  const [misplacements, setMisplacements] = useState(0)
  const [result, setResult] = useState(null)
  const [reward, setReward] = useState(null)
  const [alreadyMastered, setAlreadyMastered] = useState(false)
  const [awarding, setAwarding] = useState(false)
  const [timeLeft, setTimeLeft] = useState(timeLimit)
  const [timedOut, setTimedOut] = useState(false)
  const [runTime, setRunTime] = useState(null)
  const [levelRank, setLevelRank] = useState(null)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    setQueens(fixedQueens)
    setHints(0)
    setMisplacements(0)
    setResult(null)
    setReward(null)
    setAlreadyMastered(false)
    setAwarding(false)
    setTimeLeft(timeLimit)
    setTimedOut(false)
    setRunTime(null)
    setLevelRank(null)
    return () => {
      cancelled.current = true
    }
  }, [level, fixedQueens, timeLimit])

  // Countdown: ticks each second; pauses on win, timeout, and while the
  // How-to-Play modal is open. On reaching 0 -> timeout fail (no reward).
  useEffect(() => {
    if (result || timedOut || helpOpen) return
    if (timeLeft <= 0) return
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id)
          setTimedOut(true)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [result, timedOut, helpOpen, timeLeft])

  const conflictSet = useMemo(
    () => new Set(findConflicts(queens, n).map(key)),
    [queens, n]
  )

  // Every empty square that at least one placed queen attacks.
  const attackedSet = useMemo(() => {
    const set = new Set()
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = { r, c }
        if (queens.some((q) => key(q) === key(cell))) continue
        if (queens.some((q) => attacks(q, cell))) set.add(key(cell))
      }
    }
    return set
  }, [queens, n])

  const win = useCallback(
    async (placedQueens, hintsUsed, missUsed) => {
      if (cancelled.current) return
      const timeMs = Math.max(0, (timeLimit - timeLeft) * 1000)
      setRunTime(timeMs)
      const stars = starsFor(hintsUsed, missUsed)
      setResult({ stars, timeLeft })
      setReward(null)
      setAlreadyMastered(false)
      setLevelRank(null)
      setAwarding(true)
      const res = await completeLevel(level, stars, {
        moves: Array.isArray(placedQueens) ? placedQueens.length : n,
        timeMs,
        // Reported so the SERVER can grade the stars from the same rule the
        // player was shown; its verdict is what the account records.
        // An N-Queens "mistake" is a queen placed where it was attacked.
        performance: { hintsUsed, mistakes: missUsed },
      })
      if (cancelled.current) return
      setLevelRank(Number.isFinite(res?.levelRank) ? res.levelRank : null)
      const awarded = res?.awarded || { xp: 0, coins: 0 }
      if (res?.alreadyCompleted || (!awarded.xp && !awarded.coins)) {
        setAlreadyMastered(!!res?.alreadyCompleted)
        setReward(null)
      } else {
        setReward({ xp: awarded.xp || 0, coins: awarded.coins || 0 })
      }
      setAwarding(false)
    },
    [completeLevel, level, timeLeft, timeLimit, n]
  )

  const toggle = useCallback(
    (r, c) => {
      if (result || timedOut) return
      const k = `${r},${c}`
      if (fixedSet.has(k)) return // can't move a fixed queen
      setQueens((prev) => {
        const exists = prev.some((q) => key(q) === k)
        let next
        if (exists) {
          next = prev.filter((q) => key(q) !== k)
        } else {
          const cell = { r, c }
          // Placing onto an attacked square counts as a misplacement.
          if (prev.some((q) => attacks(q, cell))) {
            setMisplacements((m) => m + 1)
          }
          next = [...prev, cell]
        }
        if (isSolved(next, n)) {
          queueMicrotask(() => win(next, hints, misplacements))
        }
        return next
      })
    },
    [result, timedOut, fixedSet, n, hints, misplacements, win]
  )

  const useHint = useCallback(() => {
    if (result || timedOut) return
    if (hints >= maxHints) return // respect the per-level hint cap
    // Solve from the current fixed queens; place one queen that's part of a
    // valid arrangement but isn't on the board yet.
    const solution = findSolution(n, fixedQueens)
    if (!solution) return
    const present = new Set(queens.map(key))
    const missing = solution.find((q) => !present.has(key(q)))
    if (!missing) return
    const nextHints = hints + 1
    setHints(nextHints)
    setQueens((prev) => {
      // Remove any current queen sharing the target square's column to avoid
      // an instant conflict, but keep fixed queens.
      const cleaned = prev.filter(
        (q) => fixedSet.has(key(q)) || q.c !== missing.c
      )
      const next = [...cleaned, missing]
      if (isSolved(next, n)) queueMicrotask(() => win(next, nextHints, misplacements))
      return next
    })
  }, [result, timedOut, maxHints, n, fixedQueens, queens, hints, misplacements, fixedSet, win])

  const reset = useCallback(() => {
    setQueens(fixedQueens)
    setHints(0)
    setMisplacements(0)
    setResult(null)
    setReward(null)
    setAlreadyMastered(false)
    setTimeLeft(timeLimit)
    setTimedOut(false)
    setRunTime(null)
    setLevelRank(null)
  }, [fixedQueens, timeLimit])

  const placed = queens.length
  const hasConflict = conflictSet.size > 0
  const lowTime = timeLeft <= 10 && !result

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          className="game-text inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
        >
          <ArrowLeft size={16} /> Levels
        </button>
        <div className="min-w-0 text-right">
          <div className="game-text text-xs uppercase tracking-wide text-text-secondary">
            Level {level.id} · {level.difficulty} · {n}×{n}
          </div>
          <div className="game-text truncate text-lg font-extrabold" style={{ color: TINT }}>
            {level.name}
          </div>
        </div>
      </div>

      <Card hover={false}>
        {/* Prominent countdown timer — Ember theme; ≤10s turns error + pulses. */}
        <div className="mb-4 flex justify-center">
          <div
            role="timer"
            aria-label="Time remaining"
            className={`game-text inline-flex items-center gap-2 rounded-2xl border px-5 py-2 ${
              lowTime
                ? 'border-error/60 bg-error/15 text-error motion-safe:animate-pulse'
                : 'border-turmeric/50 bg-surface/60 text-turmeric'
            }`}
          >
            <Timer size={20} className={lowTime ? 'text-error' : 'text-turmeric'} />
            <span className="text-2xl font-extrabold tabular-nums tracking-wide">
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-center gap-2.5">
          <StatChip icon={Crown} value={`${placed}/${n}`} label="queens" highlight={placed === n && !hasConflict} />
          <StatChip icon={Lightbulb} value={hints} label="hints" />
          <StatChip icon={AlertTriangle} value={misplacements} label="clashes" danger={misplacements > 0} />
        </div>

        <NQueensBoard
          n={n}
          queens={queens}
          fixedSet={fixedSet}
          conflictSet={conflictSet}
          attackedSet={attackedSet}
          onToggle={toggle}
          tint={TINT}
        />

        <AnimatePresence>
          {hasConflict && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="game-text mx-auto mt-4 flex max-w-md items-start gap-2 rounded-xl border border-error/50 bg-error/15 px-3 py-2.5 text-sm text-error"
            >
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              Two queens are attacking each other (red crowns). Move one to a safe square.
            </motion.p>
          )}
        </AnimatePresence>

        <p className="game-text mt-3 text-center text-xs text-text-secondary">
          Tap a square to place or remove a queen. Red dots show squares under attack.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {maxHints > 0 && (
            <Button
              variant="secondary"
              onClick={useHint}
              disabled={hints >= maxHints}
              className="inline-flex items-center gap-1.5"
            >
              <Lightbulb size={16} /> Hint ({Math.max(0, maxHints - hints)} left)
            </Button>
          )}
          <Button variant="secondary" onClick={reset} className="inline-flex items-center gap-1.5">
            <RotateCcw size={16} /> Reset
          </Button>
          <Button variant="ghost" onClick={onHelp} className="inline-flex items-center gap-1.5">
            <HelpCircle size={16} /> How to Play
          </Button>
        </div>
        {maxHints === 0 && (
          <p className="game-text mt-3 text-center text-xs text-text-secondary">
            Final challenge — no hints, you've got this!
          </p>
        )}
      </Card>

      <AnimatePresence>
        {result && (
          <LevelWinOverlay
            confettiKey={`nqueens-${level.id}`}
            stars={result.stars}
            message={
              result.stars === 3
                ? 'Brilliant! Every queen is safe — no clashes, no hints.'
                : result.stars === 2
                  ? 'Solved! All queens are safe from each other.'
                  : 'You did it! Try again for a tidier, hint-free win.'
            }
            reward={reward}
            alreadyMastered={alreadyMastered}
            awarding={awarding}
            stats={[
              { icon: Crown, value: `${n}/${n}`, label: 'placed' },
              { icon: Lightbulb, value: hints, label: 'hints' },
              { icon: Timer, value: formatTime(result.timeLeft ?? 0), label: 'time left' },
            ]}
            runTime={runTime}
            levelRank={levelRank}
            gameKey={gameKey}
            levelId={level.id}
            hasNext={hasNext}
            onNext={onNext}
            onReplay={reset}
            onLevels={onExit}
          />
        )}
      </AnimatePresence>

      {/* Timeout — friendly fail overlay, no reward, replay resets the level. */}
      <AnimatePresence>
        {timedOut && !result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          >
            <motion.div
              role="dialog"
              aria-label="Time's up"
              initial={{ scale: 0.7, y: 32, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-error/60 bg-card p-7 text-center shadow-golden-glow-lg scrollbar-thin"
            >
              <div className="mb-3 flex justify-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-error/50 bg-error/15">
                  <Timer size={32} className="text-error" />
                </span>
              </div>
              <h2 className="game-text text-2xl font-extrabold text-error">Time&apos;s up!</h2>
              <p className="game-text mx-auto mt-2 max-w-[20rem] text-sm text-text-secondary">
                Give it another go.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                <Button onClick={reset} className="inline-flex items-center gap-1.5">
                  <RotateCcw size={16} /> Replay
                </Button>
                <Button variant="ghost" onClick={onExit} className="inline-flex items-center gap-1.5">
                  <LayoutGrid size={16} /> Levels
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatChip({ icon: Icon, value, label, danger, highlight }) {
  const border = danger ? 'border-error/50' : highlight ? 'border-success/60' : 'border-k-border'
  const valColor = danger ? 'text-error' : highlight ? 'text-success' : 'text-text-primary'
  const iconColor = danger ? 'text-error' : highlight ? 'text-success' : 'text-turmeric'
  return (
    <div className={`game-text inline-flex items-center gap-2 rounded-full border bg-surface/60 px-3.5 py-1.5 ${border}`}>
      <Icon size={15} className={iconColor} />
      <span className={`text-sm font-bold tabular-nums ${valColor}`}>{value}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  )
}
