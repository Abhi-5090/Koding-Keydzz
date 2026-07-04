import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  RotateCcw,
  Lightbulb,
  HelpCircle,
  MousePointerClick,
  Zap,
  Frown,
  Timer,
} from 'lucide-react'
import { parseLevel, step, optimalClicks } from '../../../games/robot/engine'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import LevelWinOverlay from '../../../components/games/LevelWinOverlay'
import HowToPlayModal from '../../../components/games/HowToPlayModal'
import useLevelTimer from '../../../games/shared/useLevelTimer'
import RobotBoard from './RobotBoard'

const HELP_SEEN_KEY = 'kk_robot_help_seen'
const ARROW_KEY = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }

const startState = (parsed) => ({ x: parsed.start.x, y: parsed.start.y, dir: 'up', power: 1 })

/**
 * RobotPlayScreen — play one Robot Navigation level in real time.
 *
 * The player taps a D-pad (or arrow keys); each tap immediately jumps the robot
 * `power` cells. ×2 / ÷2 tiles change jump power on landing. ÷2 at power 1 ends
 * the run (fall-out overlay). Reaching the goal wins and persists the result.
 *
 * Props:
 *   level, onExit, onNext, hasNext,
 *   completeLevel(level, stars) -> Promise<awardResult>   (from useGameLevels)
 */
export default function RobotPlayScreen({ level, onExit, onNext, hasNext, completeLevel, gameKey }) {
  const reduce = useReducedMotion()
  const parsed = useMemo(() => parseLevel(level), [level])
  const optimal = useMemo(() => optimalClicks(level), [level])
  const timer = useLevelTimer()

  const [robot, setRobot] = useState(() => startState(parsed))
  const [trail, setTrail] = useState(() => new Set([`${parsed.start.x},${parsed.start.y}`]))
  const [taps, setTaps] = useState(0)
  const [blocked, setBlocked] = useState(false)
  const [failed, setFailed] = useState(false)

  const [result, setResult] = useState(null)
  const [reward, setReward] = useState(null)
  const [alreadyMastered, setAlreadyMastered] = useState(false)
  const [awarding, setAwarding] = useState(false)
  const [runTime, setRunTime] = useState(null)
  const [levelRank, setLevelRank] = useState(null)

  const [showHelp, setShowHelp] = useState(false)
  const cancelled = useRef(false)

  const reset = useCallback(() => {
    setRobot(startState(parsed))
    setTrail(new Set([`${parsed.start.x},${parsed.start.y}`]))
    setTaps(0)
    setBlocked(false)
    setFailed(false)
    setRunTime(null)
    setLevelRank(null)
    timer.reset({ start: true })
  }, [parsed, timer])

  // Reset everything when the level changes.
  useEffect(() => {
    cancelled.current = false
    reset()
    setResult(null)
    setReward(null)
    setAlreadyMastered(false)
    setAwarding(false)
    return () => {
      cancelled.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, reset])

  // Auto-show How-to-Play the first time only.
  useEffect(() => {
    try {
      if (!localStorage.getItem(HELP_SEEN_KEY)) setShowHelp(true)
    } catch {
      /* storage unavailable — skip the auto prompt */
    }
  }, [])

  const closeHelp = useCallback(() => {
    setShowHelp(false)
    try {
      localStorage.setItem(HELP_SEEN_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [])

  const finishWin = useCallback(
    async (tapsUsed) => {
      // Stars: 3 = optimal, 2 = within optimal+2, 1 = completed.
      const stars = tapsUsed <= optimal ? 3 : tapsUsed <= optimal + 2 ? 2 : 1
      const message =
        stars === 3
          ? 'Perfect route! You docked in the fewest jumps possible.'
          : stars === 2
          ? 'Nice jumping! A tighter route could save a tap or two.'
          : 'Docked! Plan your power-ups to reach the goal in fewer jumps.'

      const timeMs = timer.stop()
      setRunTime(timeMs)
      setResult({ stars, message, taps: tapsUsed })
      setReward(null)
      setAlreadyMastered(false)
      setLevelRank(null)
      setAwarding(true)
      const res = await completeLevel(level, stars, { moves: tapsUsed, timeMs })
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
    [optimal, level, completeLevel, timer]
  )

  const move = useCallback(
    (dir) => {
      if (result || failed) return
      setRobot((cur) => {
        const r = step(level, cur, dir)
        if (r.blocked) {
          setBlocked(true)
          // dir still updates so the robot faces the attempted way
          return { ...cur, dir }
        }
        const nextTaps = taps + 1
        setTaps(nextTaps)
        setTrail((t) => new Set(t).add(`${r.state.x},${r.state.y}`))

        if (r.failed) {
          setFailed(true)
          return { x: r.state.x, y: r.state.y, dir, power: r.state.power }
        }
        if (r.won) {
          finishWin(nextTaps)
        }
        return { x: r.state.x, y: r.state.y, dir, power: r.state.power }
      })
    },
    [level, taps, result, failed, finishWin]
  )

  // Clear the blocked-bump flag shortly after it fires.
  useEffect(() => {
    if (!blocked) return
    const t = setTimeout(() => setBlocked(false), reduce ? 0 : 380)
    return () => clearTimeout(t)
  }, [blocked, robot, reduce])

  // Keyboard arrows drive the robot when no overlay/help is open.
  useEffect(() => {
    const onKey = (e) => {
      if (result || failed || showHelp) return
      const dir = ARROW_KEY[e.key]
      if (!dir) return
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      e.preventDefault()
      move(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [move, result, failed, showHelp])

  const powered = robot.power === 2

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          className="game-text inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
        >
          <ArrowLeft size={16} /> Levels
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="game-text inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
          >
            <HelpCircle size={16} /> Help
          </button>
          <div className="min-w-0 text-right">
            <div className="game-text text-xs uppercase tracking-wide text-text-secondary">
              Level {level.id} · {level.difficulty}
            </div>
            <div className="game-text truncate text-lg font-extrabold text-turmeric">{level.name}</div>
          </div>
        </div>
      </div>

      <div className="grid items-stretch gap-5 md:grid-cols-2">
        <Card hover={false} className="flex min-w-0 flex-col">
          <div className="flex flex-1 items-center justify-center">
            <RobotBoard level={level} robot={robot} trail={trail} blocked={blocked} />
          </div>

          {level.hint && (
            <p className="game-text mt-4 flex items-start gap-2 rounded-xl border border-k-border bg-surface/40 px-3 py-2 text-sm text-text-secondary">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-turmeric" />
              {level.hint}
            </p>
          )}
        </Card>

        <Card hover={false} className="flex min-w-0 flex-col">
          {/* Jump power indicator */}
          <div className="flex items-center justify-between gap-3">
            <div className="game-text text-xs font-bold uppercase tracking-wide text-text-secondary">
              Jump Power
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={robot.power}
                initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { scale: 1.4, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                className={[
                  'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-lg font-extrabold',
                  powered
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-turmeric/60 bg-turmeric/10 text-turmeric',
                ].join(' ')}
              >
                <Zap size={18} fill="currentColor" />
                Jump ×{robot.power || 1}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* D-pad */}
          <div className="mx-auto mt-6 grid w-full max-w-[240px] grid-cols-3 grid-rows-3 gap-2">
            <div />
            <DpadButton dir="up" icon={ArrowUp} onPress={move} disabled={!!result || failed} label="Move up" />
            <div />
            <DpadButton dir="left" icon={ArrowLeft} onPress={move} disabled={!!result || failed} label="Move left" />
            <div className="flex items-center justify-center text-text-secondary">
              <MousePointerClick size={20} />
            </div>
            <DpadButton dir="right" icon={ArrowRight} onPress={move} disabled={!!result || failed} label="Move right" />
            <div />
            <DpadButton dir="down" icon={ArrowDown} onPress={move} disabled={!!result || failed} label="Move down" />
            <div />
          </div>

          <p className="game-text mt-4 text-center text-xs text-text-secondary">
            Tap an arrow (or use keyboard arrows) to jump one move at a time.
          </p>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
            <div className="flex items-center gap-2">
              <div className="game-text rounded-xl border border-k-border bg-surface/60 px-4 py-2 text-sm">
                <span className="text-text-secondary">Jumps </span>
                <span className="font-bold text-text-primary tabular-nums">{taps}</span>
              </div>
              <div className="game-text inline-flex items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-4 py-2 text-sm">
                <Timer size={15} className="text-turmeric" />
                <span className="font-bold text-text-primary tabular-nums">{timer.formatted}</span>
              </div>
            </div>
            <Button variant="secondary" onClick={reset} className="inline-flex items-center gap-1.5">
              <RotateCcw size={15} /> Reset
            </Button>
          </div>
        </Card>
      </div>

      {/* FAIL overlay — fell out on a ÷2 at power 1. */}
      <AnimatePresence>
        {failed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          >
            <motion.div
              role="alertdialog"
              aria-label="Robot fell out"
              initial={{ scale: 0.8, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-error bg-card p-7 text-center scrollbar-thin"
              style={{ boxShadow: '0 0 32px rgba(255,84,112,0.45)' }}
            >
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-error/15 text-error">
                <Frown size={32} />
              </div>
              <h2 className="game-text text-2xl font-extrabold text-error">Oops!</h2>
              <p className="game-text mx-auto mt-2 max-w-[20rem] text-sm text-text-secondary">
                You hit a ÷2 with no power left and fell out — try again!
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                <Button onClick={reset} className="inline-flex items-center gap-1.5">
                  <RotateCcw size={16} /> Replay
                </Button>
                <Button variant="ghost" onClick={onExit} className="inline-flex items-center gap-1.5">
                  <ArrowLeft size={16} /> Levels
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WIN overlay */}
      <AnimatePresence>
        {result && (
          <LevelWinOverlay
            confettiKey={`robot-${level.id}`}
            stars={result.stars}
            message={result.message}
            reward={reward}
            alreadyMastered={alreadyMastered}
            awarding={awarding}
            stats={[{ icon: MousePointerClick, value: result.taps, label: 'jumps' }]}
            runTime={runTime}
            runMoves={result.taps}
            levelRank={levelRank}
            gameKey={gameKey}
            levelId={level.id}
            hasNext={hasNext}
            onNext={onNext}
            onReplay={() => {
              setResult(null)
              setReward(null)
              setAlreadyMastered(false)
              reset()
            }}
            onLevels={onExit}
          />
        )}
      </AnimatePresence>

      <HowToPlayModal open={showHelp} onClose={closeHelp} title="How to Play — Robot Navigation" tint="#2DD4BF">
        <p>
          Tap the arrow buttons (or your keyboard arrows) to move the robot
          <strong className="text-text-primary"> one jump at a time</strong>. Each tap moves
          immediately — there is no program to build and no Run button.
        </p>
        <ul className="ml-1 space-y-2">
          <li className="flex items-start gap-2">
            <Zap size={16} className="mt-0.5 shrink-0 text-turmeric" />
            You start at <strong className="text-text-primary">Jump ×1</strong> — each tap moves 1 cell.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 rounded border border-accent/60 bg-accent/15 px-1 text-[11px] font-bold text-accent">×2</span>
            Land on a <strong className="text-accent">×2</strong> tile to double your jump — now each tap leaps 2 cells (and can clear a wall!).
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 rounded border border-error/60 bg-error/15 px-1 text-[11px] font-bold text-error">÷2</span>
            A <strong className="text-error">÷2</strong> tile halves your jump back to ×1.
          </li>
          <li className="flex items-start gap-2">
            <Frown size={16} className="mt-0.5 shrink-0 text-error" />
            If you hit ÷2 while already at <strong className="text-text-primary">Jump ×1</strong>, the robot falls out and you restart.
          </li>
        </ul>
        <p>
          Plan your jumps so you land <strong className="text-text-primary">exactly on the goal</strong> — a
          ×2 jump can overshoot, so sometimes you need a ÷2 to slow down. Reach the goal in the fewest jumps for 3 stars!
        </p>
      </HowToPlayModal>
    </div>
  )
}

function DpadButton({ dir, icon: Icon, onPress, disabled, label }) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => onPress(dir)}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
      aria-label={label}
      className="flex aspect-square items-center justify-center rounded-2xl border border-k-border bg-surface/70 text-turmeric transition-colors duration-200 can-hover:hover:border-turmeric can-hover:hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon size={26} strokeWidth={2.6} />
    </motion.button>
  )
}
