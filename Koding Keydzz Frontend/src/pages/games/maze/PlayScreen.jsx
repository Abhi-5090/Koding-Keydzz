import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  Play,
  RotateCcw,
  Loader2,
  Lightbulb,
  HelpCircle,
  ChevronDown,
  BookOpen,
  Repeat,
  Timer,
} from 'lucide-react'
import { parseLevel, simulate, evaluate, countBlocks } from '../../../games/maze/engine'
import { parseProgram, flattenToDirs } from '../../../games/maze/pythonParser'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import LevelWinOverlay from '../../../components/games/LevelWinOverlay'
import HowToPlayModal from '../../../components/games/HowToPlayModal'
import useLevelReward from '../../../hooks/useLevelReward'
import useLevelTimer from '../../../games/shared/useLevelTimer'
import MazeBoard from './MazeBoard'
import CodeEditor from './CodeEditor'
import CompiledSequence from './CompiledSequence'

const STEP_MS = 220
const HELP_SEEN_KEY = 'kk_maze_help_seen'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const STARTER_CODE = `# Move the robot to the goal!
# Commands: up()  down()  left()  right()
# Loop: for i in range(3):
#           up()
`

// Cheat-sheet snippet templates. The emphasis is on TYPING — these are a tiny
// shortcut that appends a template the kid can edit.
const SNIPPETS = [
  { label: 'up()', insert: 'up()\n' },
  { label: 'down()', insert: 'down()\n' },
  { label: 'left()', insert: 'left()\n' },
  { label: 'right()', insert: 'right()\n' },
  { label: 'for loop', insert: 'for i in range(3):\n    up()\n', icon: Repeat },
]

/**
 * PlayScreen — write Python, compile it to moves, run, and judge one level.
 *
 * The student types a tiny Python subset (up()/down()/left()/right() and
 * `for i in range(n):` loops). It is parsed LIVE into the engine program model,
 * shown as an arrow sequence, then animated on Run and scored by evaluate().
 *
 * Shared by both code-writing games (Maze Coding + Robot Navigation). The two
 * games differ only in their level data and a little copy: `title` names the game
 * in the How-to-Play modal and `helpSeenKey` lets each game track its own
 * first-time help prompt. The engine + parser + board are grid-agnostic.
 *
 * Props: level, onBack, onNext, hasNext, recordStars, gameKey, title, helpSeenKey
 */
export default function PlayScreen({
  level,
  onBack,
  onNext,
  hasNext,
  recordStars,
  gameKey = 'maze-coding',
  title = 'Maze Coding',
  helpSeenKey = HELP_SEEN_KEY,
}) {
  const reduce = useReducedMotion()
  const parsed = useMemo(() => parseLevel(level), [level])
  const timer = useLevelTimer()

  const [code, setCode] = useState(STARTER_CODE)
  const [robot, setRobot] = useState({ x: parsed.start.x, y: parsed.start.y, dir: 'up' })
  const [trail, setTrail] = useState(new Set())
  const [running, setRunning] = useState(false)
  const [crashing, setCrashing] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
  const [banner, setBanner] = useState(null) // crash / didn't reach goal feedback

  // Live-compiled view of whatever is in the editor (debounced).
  const [compiled, setCompiled] = useState({ program: [], dirs: [], error: null, blocks: 0 })
  const [cheatOpen, setCheatOpen] = useState(false)

  const [result, setResult] = useState(null)
  const [reward, setReward] = useState(null)
  const [alreadyMastered, setAlreadyMastered] = useState(false)
  const [awarding, setAwarding] = useState(false)
  const [runTime, setRunTime] = useState(null)
  const [levelRank, setLevelRank] = useState(null)
  const [showHelp, setShowHelp] = useState(false)

  const cancelled = useRef(false)
  const editorRef = useRef(null)
  const { award } = useLevelReward()

  // Reset everything whenever the level changes.
  useEffect(() => {
    cancelled.current = false
    setCode(STARTER_CODE)
    setRobot({ x: parsed.start.x, y: parsed.start.y, dir: 'up' })
    setTrail(new Set())
    setRunning(false)
    setCrashing(false)
    setActiveStep(-1)
    setBanner(null)
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
  }, [level, parsed.start.x, parsed.start.y])

  // Auto-show How-to-Play the first time only.
  useEffect(() => {
    try {
      if (!localStorage.getItem(helpSeenKey)) setShowHelp(true)
    } catch {
      /* storage unavailable — skip the auto prompt */
    }
  }, [helpSeenKey])

  const closeHelp = useCallback(() => {
    setShowHelp(false)
    try {
      localStorage.setItem(helpSeenKey, '1')
    } catch {
      /* ignore */
    }
  }, [helpSeenKey])

  // Live compile (debounced) — parse the code into a program + arrow sequence.
  useEffect(() => {
    const id = setTimeout(() => {
      const { program, error } = parseProgram(code)
      if (error) {
        setCompiled({ program: null, dirs: [], error, blocks: 0 })
      } else {
        setCompiled({
          program,
          dirs: flattenToDirs(program),
          error: null,
          blocks: countBlocks(program),
        })
      }
    }, 250)
    return () => clearTimeout(id)
  }, [code])

  const resetRobot = useCallback(() => {
    cancelled.current = true
    setRobot({ x: parsed.start.x, y: parsed.start.y, dir: 'up' })
    setTrail(new Set())
    setRunning(false)
    setCrashing(false)
    setActiveStep(-1)
    setBanner(null)
  }, [parsed.start.x, parsed.start.y])

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor
  }, [])

  // Append a snippet template to the end of the code (focus stays on writing).
  const insertSnippet = useCallback(
    (text) => {
      if (running) return
      setCode((prev) => {
        const needsNl = prev.length > 0 && !prev.endsWith('\n')
        return prev + (needsNl ? '\n' : '') + text
      })
      setBanner(null)
    },
    [running]
  )

  const run = useCallback(async () => {
    if (running) return
    // Parse fresh from the latest code so Run is never stale vs. the debounce.
    const { program, error } = parseProgram(code)
    if (error) {
      setBanner({ message: `Line ${error.line}: ${error.message}` })
      return
    }
    if (!program || program.length === 0) {
      setBanner({ message: 'Write some commands first, then press Run.' })
      return
    }

    const sim = simulate(level, program)

    cancelled.current = false
    setRunning(true)
    setBanner(null)
    setResult(null)
    setCrashing(false)
    setTrail(new Set())
    setActiveStep(-1)
    setRobot({ x: parsed.start.x, y: parsed.start.y, dir: 'up' })

    const visited = new Set([`${parsed.start.x},${parsed.start.y}`])
    let prev = sim.path[0]
    for (let i = 1; i < sim.path.length; i++) {
      if (cancelled.current) return
      await wait(reduce ? 0 : STEP_MS)
      if (cancelled.current) return
      const cell = sim.path[i]
      const dir =
        cell.x > prev.x ? 'right' : cell.x < prev.x ? 'left' : cell.y > prev.y ? 'down' : 'up'
      visited.add(`${cell.x},${cell.y}`)
      setTrail(new Set(visited))
      setRobot({ x: cell.x, y: cell.y, dir })
      setActiveStep(i - 1) // highlight the arrow chip for this move
      prev = cell
    }

    if (cancelled.current) return

    if (sim.crashed) {
      setActiveStep(sim.crashIndex)
      setCrashing(true)
      await wait(reduce ? 0 : 450)
      if (cancelled.current) return
      setCrashing(false)
    }

    const evald = evaluate(level, program)
    setRunning(false)
    setActiveStep(-1)

    if (evald.completed) {
      const timeMs = timer.stop()
      setRunTime(timeMs)
      recordStars(level.id, evald.stars)
      setReward(null)
      setAlreadyMastered(false)
      setLevelRank(null)
      setAwarding(true)
      setResult(evald)

      const res = await award({
        gameKey,
        levelId: level.id,
        difficulty: level.difficulty,
        stars: evald.stars,
        moves: evald.userSteps,
        timeMs,
        // The two quality bits the star rule is built from. Deciding these
        // needs the pupil's PROGRAM run against the maze, so unlike the other
        // games the server cannot re-derive them — it bounds them to one star
        // each on top of the star for finishing. See backend
        // src/config/starPolicy.js ('program' model).
        performance: {
          hintsUsed: 0,
          mistakes: 0,
          optimalPath: evald.optimalPath === true,
          cleanCode: evald.cleanCode === true,
        },
      })
      if (cancelled.current) return
      // The server grades the run; its count is the one that counts.
      if (!res?.error && Number.isFinite(res?.bestStars)) {
        recordStars(level.id, res.bestStars, { authoritative: true })
      }
      setLevelRank(Number.isFinite(res?.levelRank) ? res.levelRank : null)
      const awarded = res?.awarded || { xp: 0, coins: 0 }
      if (res?.alreadyCompleted || (!awarded.xp && !awarded.coins)) {
        setAlreadyMastered(!!res?.alreadyCompleted)
        setReward(null)
      } else {
        setReward({ xp: awarded.xp || 0, coins: awarded.coins || 0 })
      }
      setAwarding(false)
    } else {
      setBanner({ message: evald.message })
    }
  }, [running, code, level, parsed.start.x, parsed.start.y, reduce, recordStars, award, gameKey, timer])

  // Win message nudges toward loops when the path was optimal but code wasn't clean.
  const winMessage = useMemo(() => {
    if (!result) return ''
    if (result.stars === 3) return result.message
    if (result.optimalPath && !result.cleanCode) {
      return 'Shortest path! Now make it cleaner — wrap repeated moves in a for loop to earn the 3rd star.'
    }
    return result.message
  }, [result])

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="game-text inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
        >
          <ArrowLeft size={16} /> Levels
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <div className="game-text inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm">
            <Timer size={15} className="text-turmeric" />
            <span className="font-bold text-text-primary tabular-nums">{timer.formatted}</span>
          </div>
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
        {/* LEFT: the maze + hint */}
        <Card hover={false} className="flex min-w-0 flex-col">
          <div className="flex flex-1 items-center justify-center">
            <MazeBoard level={level} robot={robot} trail={trail} crashing={crashing} />
          </div>

          {level.hint && (
            <p className="game-text mt-4 flex items-start gap-2 rounded-xl border border-k-border bg-surface/40 px-3 py-2 text-sm text-text-secondary">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-turmeric" />
              {level.hint}
            </p>
          )}

          <AnimatePresence>
            {banner && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="alert"
                className="game-text mt-3 flex items-start gap-2 rounded-xl border border-error/50 bg-error/15 px-3 py-2.5 text-sm text-error"
              >
                <Lightbulb size={17} className="mt-0.5 shrink-0" />
                {banner.message}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* RIGHT: write code -> compiled sequence */}
        <Card hover={false} className="flex min-w-0 flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="game-text inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary">
              <BookOpen size={16} className="text-turmeric" /> Your Code
            </span>
            <span className="game-text rounded-md bg-surface px-2 py-0.5 text-[11px] text-text-secondary">
              main.py
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-k-border">
            <CodeEditor
              value={code}
              onChange={setCode}
              onMount={handleEditorMount}
              readOnly={running}
              height="300px"
            />
          </div>

          {/* Collapsible Commands cheat-sheet (reference + insert snippet) */}
          <div className="mt-3 rounded-xl border border-k-border bg-surface/40">
            <button
              type="button"
              onClick={() => setCheatOpen((o) => !o)}
              aria-expanded={cheatOpen}
              className="game-text flex w-full items-center justify-between px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
            >
              <span className="inline-flex items-center gap-1.5">
                <BookOpen size={15} /> Commands
              </span>
              <ChevronDown
                size={16}
                className={`transition-transform duration-200 ${cheatOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <AnimatePresence initial={false}>
              {cheatOpen && (
                <motion.div
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 px-3 pb-3 pt-1">
                    <p className="game-text text-xs text-text-secondary">
                      Type these into the editor.{' '}
                      <code className="rounded bg-malt px-1 text-turmeric">up()</code>{' '}
                      <code className="rounded bg-malt px-1 text-turmeric">down()</code>{' '}
                      <code className="rounded bg-malt px-1 text-turmeric">left()</code>{' '}
                      <code className="rounded bg-malt px-1 text-turmeric">right()</code> move one step.
                    </p>
                    <pre className="game-text overflow-x-auto rounded-lg bg-malt px-3 py-2 text-xs text-text-primary">
{`for i in range(3):
    up()`}
                    </pre>
                    <div className="flex flex-wrap gap-1.5">
                      {SNIPPETS.map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          disabled={running}
                          onClick={() => insertSnippet(s.insert)}
                          className="game-text inline-flex items-center gap-1 rounded-md border border-k-border bg-surface px-2 py-1 text-xs font-semibold text-text-secondary transition-colors can-hover:hover:border-turmeric can-hover:hover:text-turmeric disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {s.icon && <s.icon size={12} />}+ {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Compiled move sequence (live) */}
          <CompiledSequence
            dirs={compiled.dirs}
            error={compiled.error}
            blockCount={compiled.blocks}
            activeIndex={activeStep}
          />

          {/* Controls */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={run}
              disabled={running}
              className="inline-flex flex-1 basis-full items-center justify-center gap-2 sm:basis-auto"
            >
              {running ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Running…
                </>
              ) : (
                <>
                  <Play size={17} /> Run
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={resetRobot}
              disabled={running}
              className="inline-flex items-center gap-1.5"
            >
              <RotateCcw size={15} /> Reset
            </Button>
          </div>
        </Card>
      </div>

      <AnimatePresence>
        {result && (
          <LevelWinOverlay
            confettiKey={`${gameKey}-${level.id}`}
            stars={result.stars}
            message={winMessage}
            reward={reward}
            alreadyMastered={alreadyMastered}
            awarding={awarding}
            stats={[
              { icon: Play, value: result.userSteps, label: 'steps' },
              { icon: BookOpen, value: result.userBlocks, label: 'lines' },
            ]}
            runTime={runTime}
            runMoves={result.userSteps}
            levelRank={levelRank}
            gameKey={gameKey}
            levelId={level.id}
            hasNext={hasNext}
            onNext={onNext}
            onReplay={() => {
              setResult(null)
              setReward(null)
              setAlreadyMastered(false)
              setRunTime(null)
              setLevelRank(null)
              timer.reset({ start: true })
              resetRobot()
            }}
            onLevels={onBack}
          />
        )}
      </AnimatePresence>

      <HowToPlayModal open={showHelp} onClose={closeHelp} title={`How to Play — ${title}`} tint="#FF602F">
        <p>
          Write <strong className="text-text-primary">Python code</strong> to drive the robot to the
          flag. Each command moves it <strong className="text-text-primary">one step</strong>:
        </p>
        <ul className="ml-1 space-y-1.5">
          <li className="flex items-center gap-2">
            <code className="rounded bg-malt px-1.5 py-0.5 text-turmeric">up()</code>
            <code className="rounded bg-malt px-1.5 py-0.5 text-turmeric">down()</code>
            <code className="rounded bg-malt px-1.5 py-0.5 text-turmeric">left()</code>
            <code className="rounded bg-malt px-1.5 py-0.5 text-turmeric">right()</code>
          </li>
        </ul>
        <p>
          To repeat moves, use a <strong className="text-text-primary">for loop</strong> — write the
          header, then <strong className="text-text-primary">indent</strong> the commands inside it:
        </p>
        <pre className="game-text overflow-x-auto rounded-lg border border-k-border bg-malt px-3 py-2 text-xs text-text-primary">
{`for i in range(3):
    up()`}
        </pre>
        <p>
          Press <strong className="text-turmeric">Run</strong> to watch your code turn into moves.
          Fewer, smarter lines win:{' '}
          <strong className="text-text-primary">use loops</strong> instead of repeating yourself to
          earn all <strong className="text-turmeric">3 stars</strong>.
        </p>
      </HowToPlayModal>
    </div>
  )
}
