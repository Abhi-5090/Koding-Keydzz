import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, RotateCcw, Undo2, Lightbulb, HelpCircle, Waypoints, AlertTriangle, Timer } from 'lucide-react'
import {
  key,
  numberAt,
  numberCount,
  cellCount,
  validatePath,
  nextHintCell,
  matchedPrefixLength,
} from '../../../games/zip/engine'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import LevelWinOverlay from '../../../components/games/LevelWinOverlay'
import useLevelTimer from '../../../games/shared/useLevelTimer'
import ZipBoard from './ZipBoard'

const TINT = '#2DD4BF'

/**
 * Stars: 3 = solved clean (0 hints AND 0 invalid attempts); 2 = ≤1 hint or a
 * few (≤3) invalid attempts; else 1.
 */
function starsFor(hints, invalids) {
  if (hints === 0 && invalids === 0) return 3
  if (hints <= 1 || invalids <= 3) return 2
  return 1
}

/**
 * ZipPlayScreen — play one Zip level: draw a single path that fills every cell,
 * passing the numbers in order without crossing walls. Undo / Reset / Hint,
 * live progress, invalid-move feedback, and the shared win overlay.
 *
 * Props: level, onExit, onNext, hasNext, completeLevel, onHelp
 */
export default function ZipPlayScreen({ level, onExit, onNext, hasNext, completeLevel, onHelp, gameKey }) {
  const maxHints = Math.min(2, Math.max(0, level.maxHints ?? 2))
  const total = cellCount(level)
  const totalNumbers = numberCount(level)
  const timer = useLevelTimer()

  const [path, setPath] = useState([])
  const [hints, setHints] = useState(0)
  const [invalids, setInvalids] = useState(0)
  const [shakeKey, setShakeKey] = useState(0)
  const [rejectMsg, setRejectMsg] = useState(null)
  const [result, setResult] = useState(null)
  const [reward, setReward] = useState(null)
  const [alreadyMastered, setAlreadyMastered] = useState(false)
  const [awarding, setAwarding] = useState(false)
  const [runTime, setRunTime] = useState(null)
  const [levelRank, setLevelRank] = useState(null)
  const cancelled = useRef(false)
  const rejectTimer = useRef(null)

  useEffect(() => {
    cancelled.current = false
    setPath([])
    setHints(0)
    setInvalids(0)
    setRejectMsg(null)
    setResult(null)
    setReward(null)
    setAlreadyMastered(false)
    setAwarding(false)
    setRunTime(null)
    setLevelRank(null)
    timer.reset({ start: true })
    return () => {
      cancelled.current = true
      if (rejectTimer.current) clearTimeout(rejectTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // How many checkpoints the current path has hit (in order) -> next number.
  const numbersHit = useMemo(() => {
    let n = 0
    for (const c of path) if (numberAt(level, c.x, c.y) != null) n += 1
    return n
  }, [path, level])
  const nextNumber = numbersHit >= totalNumbers ? null : numbersHit + 1

  const flashReject = useCallback((reason) => {
    setInvalids((n) => n + 1)
    setShakeKey((k) => k + 1)
    setRejectMsg(reason)
    if (rejectTimer.current) clearTimeout(rejectTimer.current)
    rejectTimer.current = setTimeout(() => setRejectMsg(null), 1400)
  }, [])

  const win = useCallback(
    async (hintsUsed, invalidsUsed) => {
      const timeMs = timer.stop()
      setRunTime(timeMs)
      const stars = starsFor(hintsUsed, invalidsUsed)
      setResult({ stars })
      setReward(null)
      setAlreadyMastered(false)
      setLevelRank(null)
      setAwarding(true)
      const res = await completeLevel(level, stars, {
        moves: total,
        timeMs,
        // Reported so the SERVER can grade the stars from the same rule the
        // player was shown; its verdict is what the account records.
        // A Zip "mistake" is an illegal square the player tried to draw into.
        performance: { hintsUsed, mistakes: invalidsUsed },
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
    [completeLevel, level, total, timer]
  )

  // Attempt to append a cell to the path (validated, with reject feedback).
  const extend = useCallback(
    (cell) => {
      if (result) return
      setPath((prev) => {
        // First cell must be the start checkpoint (number 1).
        if (prev.length === 0) {
          if (numberAt(level, cell.x, cell.y) !== 1) {
            flashReject('start on number 1')
            return prev
          }
          return [cell]
        }
        const next = [...prev, cell]
        const v = validatePath(level, next)
        if (!v.ok) {
          flashReject(v.reason)
          return prev
        }
        if (v.complete) {
          queueMicrotask(() => win(hints, invalids))
        }
        return next
      })
    },
    [result, level, flashReject, win, hints, invalids]
  )

  const backtrack = useCallback(() => {
    if (result) return
    setPath((prev) => (prev.length ? prev.slice(0, -1) : prev))
  }, [result])

  const reset = useCallback(() => {
    setPath([])
    setResult(null)
    setReward(null)
    setAlreadyMastered(false)
    setRejectMsg(null)
    setRunTime(null)
    setLevelRank(null)
    timer.reset({ start: true })
  }, [timer])

  const useHint = useCallback(() => {
    if (result) return
    if (hints >= maxHints) return
    setPath((prev) => {
      const cell = nextHintCell(level, prev)
      if (!cell) return prev
      const matched = matchedPrefixLength(level, prev)
      const next = level.solution.slice(0, matched + 1)
      const nextHints = hints + 1
      setHints(nextHints)
      if (validatePath(level, next).complete) {
        queueMicrotask(() => win(nextHints, invalids))
      }
      return next
    })
  }, [result, hints, maxHints, level, win, invalids])

  // Keyboard: Backspace/Delete undoes the last cell.
  useEffect(() => {
    const onKey = (e) => {
      if (result) return
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        backtrack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [result, backtrack])

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
            Level {level.id} · {level.difficulty} · {level.cols}×{level.rows}
          </div>
          <div className="game-text truncate text-lg font-extrabold" style={{ color: TINT }}>
            {level.name}
          </div>
        </div>
      </div>

      <Card hover={false}>
        {/* Stat bar */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2.5">
          <StatChip icon={Waypoints} value={`${path.length}/${total}`} label="filled" />
          <StatChip icon={Timer} value={timer.formatted} label="time" />
          <StatChip
            icon={Lightbulb}
            value={
              nextNumber != null
                ? `${nextNumber}`
                : path.length === total
                  ? 'done'
                  : `${totalNumbers}`
            }
            label={nextNumber != null ? 'next number' : 'numbers done'}
          />
          {invalids > 0 && (
            <StatChip icon={AlertTriangle} value={invalids} label="slips" danger />
          )}
        </div>

        <ZipBoard
          level={level}
          path={path}
          onExtend={extend}
          onBacktrack={backtrack}
          tint={TINT}
          shakeKey={shakeKey}
        />

        {/* Reject reason — spoiler-free, transient. */}
        <div className="mt-3 h-5 text-center">
          <AnimatePresence>
            {rejectMsg && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="game-text text-sm font-semibold text-error"
              >
                Can’t go there — {rejectMsg}.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {path.length === 0 && (
          <>
            <p className="game-text mt-1 text-center text-xs text-text-secondary">
              Start on <span className="font-bold text-success">1</span>, then drag to fill every square in order.
            </p>
            {/* Named on screen, because a keyboard route nobody knows about is
                the same as not having one. */}
            <p className="game-text mt-1 text-center text-[0.68rem] text-text-secondary/70">
              No mouse? Use the arrow keys to move, Enter to draw, Backspace to undo.
            </p>
          </>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button
            variant="secondary"
            onClick={backtrack}
            disabled={path.length === 0}
            className="inline-flex items-center gap-1.5"
          >
            <Undo2 size={16} /> Undo
          </Button>
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
          <Button
            variant="secondary"
            onClick={reset}
            disabled={path.length === 0}
            className="inline-flex items-center gap-1.5"
          >
            <RotateCcw size={16} /> Reset
          </Button>
          <Button variant="ghost" onClick={onHelp} className="inline-flex items-center gap-1.5">
            <HelpCircle size={16} /> How to Play
          </Button>
        </div>
        {maxHints === 0 && (
          <p className="game-text mt-3 text-center text-xs text-text-secondary">
            Final challenge — no hints, you’ve got this!
          </p>
        )}
      </Card>

      <AnimatePresence>
        {result && (
          <LevelWinOverlay
            confettiKey={`zip-${level.id}`}
            stars={result.stars}
            message={
              result.stars === 3
                ? 'Flawless! One clean line, no hints — perfect planning.'
                : result.stars === 2
                  ? 'Solved! A couple of detours, but you filled the grid.'
                  : 'Path complete! Try again for a cleaner run.'
            }
            reward={reward}
            alreadyMastered={alreadyMastered}
            awarding={awarding}
            stats={[
              { icon: Lightbulb, value: hints, label: 'hints' },
              { icon: AlertTriangle, value: invalids, label: 'slips' },
            ]}
            runTime={runTime}
            runMoves={total}
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
    </div>
  )
}

function StatChip({ icon: Icon, value, label, danger }) {
  return (
    <div
      className={`game-text inline-flex items-center gap-2 rounded-full border bg-surface/60 px-3.5 py-1.5 ${
        danger ? 'border-error/50' : 'border-k-border'
      }`}
    >
      <Icon size={15} className={danger ? 'text-error' : 'text-turmeric'} />
      <span
        className={`text-sm font-bold tabular-nums ${danger ? 'text-error' : 'text-text-primary'}`}
      >
        {value}
      </span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  )
}
