import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, RotateCcw, Lightbulb, HelpCircle, XCircle, Sparkles, Timer } from 'lucide-react'
import { conflicts as findConflicts, isComplete, cloneGrid } from '../../../games/sudoku/engine'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import LevelWinOverlay from '../../../components/games/LevelWinOverlay'
import useLevelTimer from '../../../games/shared/useLevelTimer'
import SudokuBoard from './SudokuBoard'
import SudokuNumberPad from './SudokuNumberPad'

const TINT = '#2DD4BF'

/** Stars: 3 = no mistakes & no hints; 2 = ≤3 mistakes or ≤1 hint; else 1. */
function starsFor(mistakes, hints) {
  if (mistakes === 0 && hints === 0) return 3
  if (mistakes <= 3 || hints <= 1) return 2
  return 1
}

/**
 * SudokuPlayScreen — play one Sudoku level: fill cells via tap + number pad,
 * live conflict highlighting, mistakes counter, hint, reset, and win overlay.
 *
 * Props: level, onExit, onNext, hasNext, completeLevel, onHelp
 */
export default function SudokuPlayScreen({ level, onExit, onNext, hasNext, completeLevel, onHelp, gameKey }) {
  const { size, givens, solution } = level
  // Hints ramp down by level; never allow more than 2.
  const maxHints = Math.min(2, Math.max(0, level.maxHints ?? 2))
  const timer = useLevelTimer()

  const [grid, setGrid] = useState(() => cloneGrid(givens))
  const [selected, setSelected] = useState(null)
  const [mistakes, setMistakes] = useState(0)
  const [hints, setHints] = useState(0)
  const [shakeKey, setShakeKey] = useState(0)
  const [result, setResult] = useState(null)
  const [reward, setReward] = useState(null)
  const [alreadyMastered, setAlreadyMastered] = useState(false)
  const [awarding, setAwarding] = useState(false)
  const [runTime, setRunTime] = useState(null)
  const [levelRank, setLevelRank] = useState(null)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    setGrid(cloneGrid(givens))
    setSelected(null)
    setMistakes(0)
    setHints(0)
    setResult(null)
    setReward(null)
    setAlreadyMastered(false)
    setAwarding(false)
    setRunTime(null)
    setLevelRank(null)
    timer.reset({ start: true })
    return () => {
      cancelled.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, givens])

  const conflicts = useMemo(() => findConflicts(grid, size), [grid, size])

  // Count of each number still to place (givens + filled vs target `size`).
  const remaining = useMemo(() => {
    const counts = {}
    for (let v = 1; v <= size; v++) counts[v] = size
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const v = grid[r][c]
        if (v) counts[v] -= 1
      }
    }
    return counts
  }, [grid, size])

  const filled = useMemo(
    () => grid.reduce((n, row) => n + row.filter((v) => v !== 0).length, 0),
    [grid]
  )
  const totalCells = size * size

  const win = useCallback(
    async (finalGrid, hintsUsed) => {
      const timeMs = timer.stop()
      setRunTime(timeMs)
      const stars = starsFor(mistakes, hintsUsed)
      setResult({ stars })
      setReward(null)
      setAlreadyMastered(false)
      setLevelRank(null)
      setAwarding(true)
      const res = await completeLevel(level, stars, { moves: size * size, timeMs })
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
    [completeLevel, level, mistakes, size, timer]
  )

  const place = useCallback(
    (r, c, val) => {
      if (result) return
      if (givens[r][c] !== 0) return // locked
      setGrid((prev) => {
        if (prev[r][c] === val) return prev
        const next = cloneGrid(prev)
        next[r][c] = val
        // A non-zero value that doesn't match the solution is a mistake.
        if (val !== 0 && val !== solution[r][c]) {
          setMistakes((m) => m + 1)
          setShakeKey((k) => k + 1)
        }
        if (isComplete(next)) {
          // Defer the async win until after state settles.
          queueMicrotask(() => win(next, hints))
        }
        return next
      })
    },
    [givens, solution, result, hints, win]
  )

  const onSelect = useCallback(
    (r, c) => {
      if (result) return
      if (givens[r][c] !== 0) {
        setSelected({ r, c }) // selecting a given still highlights peers
        return
      }
      setSelected((prev) => (prev && prev.r === r && prev.c === c ? null : { r, c }))
    },
    [givens, result]
  )

  const pickNumber = useCallback(
    (val) => {
      if (!selected) return
      place(selected.r, selected.c, val)
    },
    [selected, place]
  )

  const eraseSelected = useCallback(() => {
    if (!selected) return
    place(selected.r, selected.c, 0)
  }, [selected, place])

  const useHint = useCallback(() => {
    if (result) return
    if (hints >= maxHints) return // respect the per-level hint cap
    // Find an empty (or wrong) cell and reveal its correct value.
    const candidates = []
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (givens[r][c] !== 0) continue
        if (grid[r][c] !== solution[r][c]) candidates.push({ r, c })
      }
    }
    if (candidates.length === 0) return
    const { r, c } = candidates[Math.floor(Math.random() * candidates.length)]
    const nextHints = hints + 1
    setHints(nextHints)
    setSelected({ r, c })
    setGrid((prev) => {
      const next = cloneGrid(prev)
      next[r][c] = solution[r][c]
      if (isComplete(next)) queueMicrotask(() => win(next, nextHints))
      return next
    })
  }, [result, size, givens, grid, solution, hints, maxHints, win])

  const reset = useCallback(() => {
    setGrid(cloneGrid(givens))
    setSelected(null)
    setMistakes(0)
    setHints(0)
    setResult(null)
    setReward(null)
    setAlreadyMastered(false)
    setRunTime(null)
    setLevelRank(null)
    timer.reset({ start: true })
  }, [givens, timer])

  // Keyboard entry: digits fill the selected cell, Backspace/0 erases.
  useEffect(() => {
    const onKey = (e) => {
      if (result || !selected) return
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault()
        eraseSelected()
        return
      }
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= size) {
        e.preventDefault()
        place(selected.r, selected.c, n)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [result, selected, size, place, eraseSelected])

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
            Level {level.id} · {level.difficulty} · {size}×{size}
          </div>
          <div className="game-text truncate text-lg font-extrabold" style={{ color: TINT }}>
            {level.name}
          </div>
        </div>
      </div>

      <Card hover={false}>
        {/* Stat bar */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2.5">
          <StatChip
            icon={XCircle}
            value={mistakes}
            label="mistakes"
            danger={mistakes > 0}
          />
          <StatChip icon={Lightbulb} value={hints} label="hints" />
          <StatChip icon={Timer} value={timer.formatted} label="time" />
          <StatChip icon={Sparkles} value={`${filled}/${totalCells}`} label="filled" />
        </div>

        <motion.div
          key={shakeKey}
          animate={shakeKey ? { x: [0, -8, 8, -5, 5, 0] } : {}}
          transition={{ duration: 0.32 }}
        >
          <SudokuBoard
            grid={grid}
            size={size}
            givens={givens}
            selected={selected}
            conflicts={conflicts}
            onSelect={onSelect}
            tint={TINT}
          />
        </motion.div>

        <div className="mt-5">
          <SudokuNumberPad
            size={size}
            onPick={pickNumber}
            onErase={eraseSelected}
            remaining={remaining}
            disabled={!selected || (selected && givens[selected.r][selected.c] !== 0)}
            tint={TINT}
          />
          {!selected && (
            <p className="game-text mt-3 text-center text-xs text-text-secondary">
              Tap an empty cell, then tap a number to place it.
            </p>
          )}
        </div>

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
          <Button
            variant="secondary"
            onClick={reset}
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
            Final challenge — no hints, you've got this!
          </p>
        )}
      </Card>

      <AnimatePresence>
        {result && (
          <LevelWinOverlay
            confettiKey={`sudoku-${level.id}`}
            stars={result.stars}
            message={
              result.stars === 3
                ? 'Flawless! No mistakes, no hints — pure logic.'
                : result.stars === 2
                  ? 'Solved! A few slips, but you cracked the grid.'
                  : 'Puzzle solved! Try again for a cleaner run.'
            }
            reward={reward}
            alreadyMastered={alreadyMastered}
            awarding={awarding}
            stats={[
              { icon: XCircle, value: mistakes, label: 'mistakes' },
              { icon: Lightbulb, value: hints, label: 'hints' },
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
