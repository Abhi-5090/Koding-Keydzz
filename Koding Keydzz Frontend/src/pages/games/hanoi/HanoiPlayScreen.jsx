import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  RotateCcw,
  Lightbulb,
  HelpCircle,
  Layers,
  AlertTriangle,
  Move,
  Target,
  Timer,
} from 'lucide-react'
import { initState, move as applyMove, isWon, minMoves, solveHint } from '../../../games/hanoi/engine'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import LevelWinOverlay from '../../../components/games/LevelWinOverlay'
import useLevelTimer from '../../../games/shared/useLevelTimer'
import HanoiBoard from './HanoiBoard'

const TINT = '#FF8A4D'

/**
 * Stars (the exact minimum is never shown — only the star result + a nudge):
 *   3 = solved in exactly minMoves(N) moves AND 0 hints ("Optimal!").
 *   2 = solved within a small move slack OR with at most 1 hint.
 *   1 = solved otherwise.
 */
function starsFor(moves, hints, disks) {
  const min = minMoves(disks)
  const slack = disks // small, gently scaling tolerance
  if (moves === min && hints === 0) return 3
  if (moves <= min + slack || hints <= 1) return 2
  return 1
}

/**
 * HanoiPlayScreen — play one Towers of Hanoi level. Tap a peg to pick up its
 * top disk, tap another to drop it. Reset, Hint (optimal next move, capped per
 * level), and a win overlay with backend XP/coins.
 *
 * Props: level, onExit, onNext, hasNext, completeLevel, onHelp
 */
export default function HanoiPlayScreen({ level, onExit, onNext, hasNext, completeLevel, onHelp, gameKey }) {
  const { disks, from, to } = level
  const maxHints = Math.min(2, Math.max(0, level.maxHints ?? 2))

  const start = useMemo(() => initState(disks, from), [disks, from])
  const timer = useLevelTimer()

  const [state, setState] = useState(start)
  const [selected, setSelected] = useState(null)
  const [moves, setMoves] = useState(0)
  const [hints, setHints] = useState(0)
  const [shakeNonce, setShakeNonce] = useState(0)
  const [invalid, setInvalid] = useState(false)
  const [result, setResult] = useState(null)
  const [reward, setReward] = useState(null)
  const [alreadyMastered, setAlreadyMastered] = useState(false)
  const [awarding, setAwarding] = useState(false)
  const [runTime, setRunTime] = useState(null)
  const [levelRank, setLevelRank] = useState(null)
  const cancelled = useRef(false)
  const invalidTimer = useRef(null)

  useEffect(() => {
    cancelled.current = false
    setState(start)
    setSelected(null)
    setMoves(0)
    setHints(0)
    setShakeNonce(0)
    setInvalid(false)
    setResult(null)
    setReward(null)
    setAlreadyMastered(false)
    setAwarding(false)
    setRunTime(null)
    setLevelRank(null)
    timer.reset({ start: true })
    return () => {
      cancelled.current = true
      if (invalidTimer.current) clearTimeout(invalidTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, start])

  const win = useCallback(
    async (movesUsed, hintsUsed) => {
      if (cancelled.current) return
      const timeMs = timer.stop()
      setRunTime(timeMs)
      const stars = starsFor(movesUsed, hintsUsed, disks)
      setResult({ stars })
      setReward(null)
      setAlreadyMastered(false)
      setLevelRank(null)
      setAwarding(true)
      const res = await completeLevel(level, stars, { moves: movesUsed, timeMs })
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
    [completeLevel, disks, level, timer]
  )

  const flashInvalid = useCallback(() => {
    setInvalid(true)
    setShakeNonce((n) => n + 1)
    if (invalidTimer.current) clearTimeout(invalidTimer.current)
    invalidTimer.current = setTimeout(() => setInvalid(false), 2200)
  }, [])

  const commitMove = useCallback(
    (fromPeg, toPeg, hintCount) => {
      setState((prev) => {
        const res = applyMove(prev, fromPeg, toPeg)
        if (!res.valid) return prev
        const nextMoves = moves + 1
        setMoves(nextMoves)
        if (isWon(res.state, disks, to)) {
          queueMicrotask(() => win(nextMoves, hintCount))
        }
        return res.state
      })
    },
    [moves, disks, to, win]
  )

  const onPegTap = useCallback(
    (peg) => {
      if (result) return
      setInvalid(false)
      if (selected == null) {
        // Pick up the top disk of a non-empty peg.
        if (state[peg].length === 0) return
        setSelected(peg)
        return
      }
      if (selected === peg) {
        // Tap the same peg again to put the disk back down.
        setSelected(null)
        return
      }
      // Attempt to drop the in-hand disk onto `peg`.
      const res = applyMove(state, selected, peg)
      if (!res.valid) {
        flashInvalid() // keep the disk in hand so the kid can retry
        return
      }
      commitMove(selected, peg, hints)
      setSelected(null)
    },
    [result, selected, state, hints, flashInvalid, commitMove]
  )

  const useHint = useCallback(() => {
    if (result) return
    if (hints >= maxHints) return
    const next = solveHint(state, disks, from, to)
    if (!next) return
    const nextHints = hints + 1
    setHints(nextHints)
    setSelected(null)
    commitMove(next.from, next.to, nextHints)
  }, [result, hints, maxHints, state, disks, from, to, commitMove])

  const reset = useCallback(() => {
    setState(start)
    setSelected(null)
    setMoves(0)
    setHints(0)
    setInvalid(false)
    setResult(null)
    setReward(null)
    setAlreadyMastered(false)
    setRunTime(null)
    setLevelRank(null)
    timer.reset({ start: true })
  }, [start, timer])

  return (
    <div className="mx-auto w-full max-w-3xl">
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
            Level {level.id} · {level.difficulty} · {disks} disks
          </div>
          <div className="game-text truncate text-lg font-extrabold" style={{ color: TINT }}>
            {level.name}
          </div>
        </div>
      </div>

      <Card hover={false}>
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2.5">
          <StatChip icon={Move} value={moves} label="moves" />
          <StatChip icon={Timer} value={timer.formatted} label="time" />
          <StatChip icon={Layers} value={disks} label="disks" />
          {maxHints > 0 && <StatChip icon={Lightbulb} value={hints} label="hints" />}
          <StatChip icon={Target} value={['Left', 'Middle', 'Right'][to]} label="goal" />
        </div>

        <HanoiBoard
          state={state}
          disks={disks}
          selectedPeg={selected}
          goalPeg={to}
          shakeNonce={shakeNonce}
          onPegTap={onPegTap}
          tint={TINT}
        />

        <AnimatePresence>
          {invalid && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="game-text mx-auto mt-4 flex max-w-md items-start gap-2 rounded-xl border border-error/50 bg-error/15 px-3 py-2.5 text-sm text-error"
            >
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              You can&apos;t put a bigger disk on a smaller one. Try another peg.
            </motion.p>
          )}
        </AnimatePresence>

        <p className="game-text mt-3 text-center text-xs text-text-secondary">
          Tap a peg to pick up its top disk, then tap another peg to drop it.
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
            Final challenge — no hints. Plan the whole stack recursively!
          </p>
        )}
      </Card>

      <AnimatePresence>
        {result && (
          <LevelWinOverlay
            confettiKey={`hanoi-${level.id}`}
            stars={result.stars}
            message={
              result.stars === 3
                ? 'Optimal! Fewest moves possible — perfectly recursive.'
                : "Solved! There's a shorter, minimal solution — plan recursively (move the top N-1 aside, then the biggest, then bring them back)."
            }
            reward={reward}
            alreadyMastered={alreadyMastered}
            awarding={awarding}
            stats={[
              { icon: Lightbulb, value: hints, label: 'hints' },
              { icon: Layers, value: disks, label: 'disks' },
            ]}
            runTime={runTime}
            runMoves={moves}
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

function StatChip({ icon: Icon, value, label }) {
  return (
    <div className="game-text inline-flex items-center gap-2 rounded-full border border-k-border bg-surface/60 px-3.5 py-1.5">
      <Icon size={15} className="text-turmeric" />
      <span className="text-sm font-bold tabular-nums text-text-primary">{value}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  )
}
