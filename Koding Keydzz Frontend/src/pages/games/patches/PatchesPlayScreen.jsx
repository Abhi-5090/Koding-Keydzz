import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  RotateCcw,
  Undo2,
  Lightbulb,
  HelpCircle,
  LayoutGrid,
  AlertTriangle,
  Timer,
  Grid2x2,
} from 'lucide-react'
import {
  key,
  rectContains,
  validateRect,
  overlaps,
  isSolved,
  nextHintRect,
} from '../../../games/patches/engine'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import LevelWinOverlay from '../../../components/games/LevelWinOverlay'
import useLevelTimer from '../../../games/shared/useLevelTimer'
import PatchesBoard from './PatchesBoard'

const TINT = '#8B7CF6'

// Soft, distinct per-rectangle tints — cycled by placement order so adjacent
// boxes read apart. Kept low-saturation so the white clue chips stay legible.
const BOX_COLORS = [
  '#8B7CF6',
  '#2DD4BF',
  '#F59E0B',
  '#F472B6',
  '#38BDF8',
  '#A3E635',
  '#FB7185',
  '#C084FC',
  '#34D399',
  '#FBBF24',
  '#60A5FA',
  '#E879F9',
  '#4ADE80',
  '#FCA5A5',
]

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
 * PatchesPlayScreen — play one Patches level: drag rectangles to divide the
 * grid so every box holds one number equal to its area. Undo / Reset / Hint,
 * live cells-covered progress, invalid-move feedback, and the shared win
 * overlay.
 *
 * Props: level, onExit, onNext, hasNext, completeLevel, onHelp, gameKey
 */
export default function PatchesPlayScreen({
  level,
  onExit,
  onNext,
  hasNext,
  completeLevel,
  onHelp,
  gameKey,
}) {
  const maxHints = Math.min(2, Math.max(0, level.maxHints ?? 2))
  const totalCells = level.size * level.size

  const timer = useLevelTimer()
  const [rects, setRects] = useState([])
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
  // Stable color per rectangle keyed by its top-left "x,y" so undo/removes keep
  // colors consistent for the boxes that remain.
  const colorSeq = useRef(0)
  const colorMap = useRef(new Map())

  useEffect(() => {
    cancelled.current = false
    setRects([])
    setHints(0)
    setInvalids(0)
    setRejectMsg(null)
    setResult(null)
    setReward(null)
    setAlreadyMastered(false)
    setAwarding(false)
    setRunTime(null)
    setLevelRank(null)
    colorSeq.current = 0
    colorMap.current = new Map()
    timer.reset({ start: true })
    return () => {
      cancelled.current = true
      if (rejectTimer.current) clearTimeout(rejectTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  const colorFor = useCallback((r) => {
    const k = key(r.x, r.y)
    let c = colorMap.current.get(k)
    if (!c) {
      c = BOX_COLORS[colorSeq.current % BOX_COLORS.length]
      colorSeq.current += 1
      colorMap.current.set(k, c)
    }
    return c
  }, [])

  const coveredCount = useMemo(
    () => rects.reduce((n, r) => n + r.w * r.h, 0),
    [rects]
  )

  const flashReject = useCallback((reason) => {
    setInvalids((n) => n + 1)
    setShakeKey((k) => k + 1)
    setRejectMsg(reason)
    if (rejectTimer.current) clearTimeout(rejectTimer.current)
    rejectTimer.current = setTimeout(() => setRejectMsg(null), 1600)
  }, [])

  const win = useCallback(
    async (finalRects, hintsUsed, invalidsUsed) => {
      const timeMs = timer.stop()
      setRunTime(timeMs)
      const stars = starsFor(hintsUsed, invalidsUsed)
      setResult({ stars })
      setReward(null)
      setAlreadyMastered(false)
      setLevelRank(null)
      setAwarding(true)
      const res = await completeLevel(level, stars, {
        moves: finalRects.length,
        timeMs,
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
    [completeLevel, level, timer]
  )

  // Attempt to place a drawn rectangle (validated, with reject feedback).
  const draw = useCallback(
    (rect) => {
      if (result) return
      setRects((prev) => {
        const v = validateRect(level, rect)
        if (!v.ok) {
          flashReject(v.reason)
          return prev
        }
        if (prev.some((r) => overlaps(r, rect))) {
          flashReject('boxes can’t overlap')
          return prev
        }
        const next = [...prev, rect]
        if (isSolved(level, next)) {
          queueMicrotask(() => win(next, hints, invalids))
        }
        return next
      })
    },
    [result, level, flashReject, win, hints, invalids]
  )

  const removeAt = useCallback(
    (x, y) => {
      if (result) return
      setRects((prev) => prev.filter((r) => !rectContains(r, x, y)))
    },
    [result]
  )

  const undo = useCallback(() => {
    if (result) return
    setRects((prev) => (prev.length ? prev.slice(0, -1) : prev))
  }, [result])

  const reset = useCallback(() => {
    setRects([])
    setResult(null)
    setReward(null)
    setAlreadyMastered(false)
    setRejectMsg(null)
    setRunTime(null)
    setLevelRank(null)
    colorSeq.current = 0
    colorMap.current = new Map()
    timer.reset({ start: true })
  }, [timer])

  const useHint = useCallback(() => {
    if (result) return
    if (hints >= maxHints) return
    setRects((prev) => {
      const hintRect = nextHintRect(level, prev)
      if (!hintRect) return prev
      // Clear anything overlapping the hint box, then commit it.
      const kept = prev.filter((r) => !overlaps(r, hintRect))
      const next = [...kept, hintRect]
      const nextHints = hints + 1
      setHints(nextHints)
      if (isSolved(level, next)) {
        queueMicrotask(() => win(next, nextHints, invalids))
      }
      return next
    })
  }, [result, hints, maxHints, level, win, invalids])

  // Keyboard: Backspace/Delete undoes the last placed rectangle.
  useEffect(() => {
    const onKey = (e) => {
      if (result) return
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [result, undo])

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
            Level {level.id} · {level.difficulty} · {level.size}×{level.size}
          </div>
          <div
            className="game-text truncate text-lg font-extrabold"
            style={{ color: TINT }}
          >
            {level.name}
          </div>
        </div>
      </div>

      <Card hover={false}>
        {/* Stat bar */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2.5">
          <StatChip icon={Grid2x2} value={`${coveredCount}/${totalCells}`} label="filled" />
          <StatChip icon={LayoutGrid} value={rects.length} label="boxes" />
          <StatChip icon={Timer} value={timer.formatted} label="time" />
          {invalids > 0 && (
            <StatChip icon={AlertTriangle} value={invalids} label="slips" danger />
          )}
        </div>

        <PatchesBoard
          level={level}
          rects={rects}
          colorFor={colorFor}
          onDraw={draw}
          onRemoveAt={removeAt}
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
                Not quite — {rejectMsg}.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {rects.length === 0 && (
          <p className="game-text mt-1 text-center text-xs text-text-secondary">
            Press a number and drag to draw its box. ─ makes a sideways row, │ a
            column, ＋ any shape — each holds exactly that many squares.
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button
            variant="secondary"
            onClick={undo}
            disabled={rects.length === 0}
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
            disabled={rects.length === 0}
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
            confettiKey={`patches-${level.id}`}
            stars={result.stars}
            message={
              result.stars === 3
                ? 'Flawless! Every box perfect — no hints, no slips.'
                : result.stars === 2
                  ? 'Solved! A few tries, but the grid is fully tiled.'
                  : 'Grid divided! Try again for a cleaner run.'
            }
            reward={reward}
            alreadyMastered={alreadyMastered}
            awarding={awarding}
            stats={[
              { icon: Lightbulb, value: hints, label: 'hints' },
              { icon: AlertTriangle, value: invalids, label: 'slips' },
            ]}
            runTime={runTime}
            runMoves={rects.length}
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
        className={`text-sm font-bold tabular-nums ${
          danger ? 'text-error' : 'text-text-primary'
        }`}
      >
        {value}
      </span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  )
}
