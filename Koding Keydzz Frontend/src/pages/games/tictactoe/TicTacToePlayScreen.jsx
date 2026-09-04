import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, RotateCcw, HelpCircle, Timer, Move, Bot, User } from 'lucide-react'
import { emptyBoard, applyMove, winner, winningLine, aiMoveBySkill } from '../../../games/tictactoe/engine'
import useLevelTimer from '../../../games/shared/useLevelTimer'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import LevelWinOverlay from '../../../components/games/LevelWinOverlay'
import TicTacToeBoard from './TicTacToeBoard'

const TINT = '#9E86F5'

/** A level whose bot plays perfectly (skill 1.0) — winning is impossible. */
function isPerfect(level) {
  return (Number(level?.skill) || 0) >= 1
}

/**
 * Stars by outcome — you must WIN or DRAW to PASS (a LOSS earns nothing and
 * does not unlock the next level).
 *   winnable levels (skill < 1) : WIN = 3, DRAW = 2
 *   perfect levels  (skill = 1) : DRAW = 3 (a win is impossible, so a draw is
 *                                 the best possible result)
 *   LOSS on any level           : 0 (no pass, no reward — replay to try again)
 * `outcome` is the engine winner: 'X' = human win, 'O' = bot win, 'draw'.
 */
function starsFor(outcome, level) {
  if (outcome === 'X') return 3 // human win
  if (outcome === 'draw') return isPerfect(level) ? 3 : 2
  return 0 // loss — does not pass
}

/**
 * A small "bot skill" indicator — five pips that fill as the level's skill
 * rises, so the climb is legible WITHOUT exposing the raw number. At least one
 * pip always shows; skill 1.0 fills all five (a perfect, unbeatable bot).
 */
function skillPips(skill) {
  const s = Math.max(0, Math.min(1, Number(skill) || 0))
  return Math.max(1, Math.round(s * 5))
}

/** A short, natural "thinking" pause before the bot moves. */
function thinkDelay() {
  return 350 + Math.floor(Math.random() * 150) // 350–500ms
}

/**
 * TicTacToePlayScreen — play one Tic-Tac-Toe opponent. You are X and move
 * first; the bot (O) replies after a brief "thinking" pause. On game end the
 * winning line glows and a result overlay awards stars via completeLevel.
 *
 * Props: level, onExit, onNext, hasNext, completeLevel, onHelp, helpOpen, gameKey
 */
export default function TicTacToePlayScreen({
  level,
  onExit,
  onNext,
  hasNext,
  completeLevel,
  onHelp,
  helpOpen = false,
  gameKey,
}) {
  const reduce = useReducedMotion()
  const timer = useLevelTimer({ autoStart: true })

  const [board, setBoard] = useState(emptyBoard())
  const [moves, setMoves] = useState(0) // human placements
  const [thinking, setThinking] = useState(false)
  const [result, setResult] = useState(null) // { outcome, stars }
  const [reward, setReward] = useState(null)
  const [alreadyMastered, setAlreadyMastered] = useState(false)
  const [awarding, setAwarding] = useState(false)
  const [runTime, setRunTime] = useState(null)
  const [levelRank, setLevelRank] = useState(null)

  const aiTimerRef = useRef(null)
  const cancelled = useRef(false)

  const line = winningLine(board)
  const outcome = winner(board)
  const disabled = thinking || outcome != null

  const clearAiTimer = () => {
    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current)
      aiTimerRef.current = null
    }
  }

  // Reset the whole match when the chosen level changes.
  useEffect(() => {
    cancelled.current = false
    clearAiTimer()
    setBoard(emptyBoard())
    setMoves(0)
    setThinking(false)
    setResult(null)
    setReward(null)
    setAlreadyMastered(false)
    setAwarding(false)
    setRunTime(null)
    setLevelRank(null)
    timer.reset({ start: true })
    return () => {
      cancelled.current = true
      clearAiTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // Pause the stopwatch while the How-to-Play modal is open so it doesn't
  // inflate the recorded time (the modal auto-shows the first time).
  useEffect(() => {
    if (outcome) return
    if (helpOpen) timer.stop()
    else timer.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helpOpen, outcome])

  const finish = useCallback(
    async (finalOutcome, humanMoves) => {
      if (cancelled.current) return
      const timeMs = timer.stop()
      setRunTime(timeMs)
      const passed = finalOutcome !== 'O' // WIN or DRAW passes; a LOSS does not.
      const stars = starsFor(finalOutcome, level)
      setResult({ outcome: finalOutcome, stars, passed })
      setReward(null)
      setAlreadyMastered(false)
      setLevelRank(null)

      // A LOSS earns nothing and does not unlock the next level — no backend
      // call. The player replays the SAME level to try again.
      if (!passed) return

      setAwarding(true)
      const res = await completeLevel(level, stars, {
        moves: humanMoves,
        timeMs,
        // The server decides whether a draw is perfect play, from the bot
        // skill in its own catalogue — 'X' is the player.
        performance: {
          outcome: finalOutcome === 'X' ? 'win' : finalOutcome === 'draw' ? 'draw' : 'loss',
        },
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

  const handleCell = useCallback(
    (i) => {
      if (disabled || board[i]) return
      const afterHuman = applyMove(board, i, 'X')
      const humanMoves = moves + 1
      setMoves(humanMoves)
      setBoard(afterHuman)

      const w1 = winner(afterHuman)
      if (w1) {
        finish(w1, humanMoves)
        return
      }

      // Bot's turn — brief think, then reply.
      setThinking(true)
      clearAiTimer()
      aiTimerRef.current = setTimeout(() => {
        aiTimerRef.current = null
        if (cancelled.current) return
        setThinking(false)
        const aiIdx = aiMoveBySkill(afterHuman, 'O', level.skill)
        if (aiIdx < 0) return
        const afterBot = applyMove(afterHuman, aiIdx, 'O')
        setBoard(afterBot)
        const w2 = winner(afterBot)
        if (w2) finish(w2, humanMoves)
      }, thinkDelay())
    },
    [board, disabled, moves, level, finish]
  )

  const reset = useCallback(() => {
    clearAiTimer()
    setBoard(emptyBoard())
    setMoves(0)
    setThinking(false)
    setResult(null)
    setReward(null)
    setAlreadyMastered(false)
    setAwarding(false)
    setRunTime(null)
    setLevelRank(null)
    timer.reset({ start: true })
  }, [timer])

  // ── Result presentation ────────────────────────────────────────────────
  const isWin = result?.outcome === 'X'
  const isDraw = result?.outcome === 'draw'
  const isLoss = result?.outcome === 'O'
  const perfect = isPerfect(level)
  const passed = result?.passed
  const celebrate = isWin || (perfect && isDraw)

  const resultTitle = isWin
    ? 'You Win!'
    : perfect && isDraw
      ? 'Perfect Draw!'
      : isDraw
        ? "It's a Draw!"
        : 'Try Again!'

  const resultMessage = isWin
    ? 'You win! Three in a row — nice moves! 🎉'
    : perfect && isDraw
      ? 'Draw! Nobody can beat this bot — a draw is a perfect result 🏆'
      : isDraw
        ? "It's a draw — that's enough to pass! Go for the win next time."
        : 'The bot got you — try again to pass this level!'

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
            Level {level.id} · {level.difficulty}
          </div>
          <div className="game-text truncate text-lg font-extrabold" style={{ color: TINT }}>
            {level.name}
          </div>
          <div className="mt-1 flex items-center justify-end gap-1.5">
            <span className="game-text text-[10px] uppercase tracking-wide text-text-secondary">Bot skill</span>
            <SkillPips skill={level.skill} />
          </div>
        </div>
      </div>

      <Card hover={false}>
        {/* Turn / thinking indicator */}
        <div className="mb-4 flex justify-center">
          <TurnIndicator thinking={thinking} outcome={outcome} reduce={reduce} />
        </div>

        {/* HUD: timer + move count */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2.5">
          <StatChip icon={Timer} value={timer.formatted} label="time" mono />
          <StatChip icon={Move} value={moves} label="moves" />
        </div>

        <TicTacToeBoard
          board={board}
          winLine={line}
          winMark={outcome}
          disabled={disabled}
          tint={TINT}
          onCell={handleCell}
        />

        <p className="game-text mt-4 text-center text-xs text-text-secondary">
          You&apos;re <span className="font-bold" style={{ color: '#FF602F' }}>X</span> and go first.
          Get three in a row to win!
        </p>
        <p className="game-text mt-1 text-center text-[11px] text-text-secondary/80">
          {perfect ? (
            <>This bot plays <span className="font-bold text-text-secondary">perfectly</span> — a <span className="font-bold text-text-secondary">DRAW</span> is a perfect result.</>
          ) : (
            <>The bot gets <span className="font-bold text-text-secondary">sharper each level</span> — win or draw to advance.</>
          )}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" onClick={reset} className="inline-flex items-center gap-1.5">
            <RotateCcw size={16} /> New Game
          </Button>
          <Button variant="ghost" onClick={onHelp} className="inline-flex items-center gap-1.5">
            <HelpCircle size={16} /> How to Play
          </Button>
        </div>
      </Card>

      <AnimatePresence>
        {result && (
          <LevelWinOverlay
            confettiKey={`ttt-${level.id}-${result.outcome}`}
            confetti={celebrate}
            title={resultTitle}
            tone={celebrate ? 'good' : 'neutral'}
            stars={result.stars}
            message={resultMessage}
            reward={reward}
            alreadyMastered={alreadyMastered}
            awarding={awarding}
            stats={[
              { icon: isWin ? User : Bot, value: isWin ? 'You' : isDraw ? 'Draw' : 'Bot', label: 'result' },
              { icon: Move, value: moves, label: 'your moves' },
            ]}
            runTime={runTime}
            runMoves={moves}
            levelRank={passed ? levelRank : null}
            gameKey={passed ? gameKey : undefined}
            levelId={passed ? level.id : undefined}
            hasNext={passed && hasNext}
            onNext={onNext}
            onReplay={reset}
            onLevels={onExit}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/** Whose-turn banner. During the bot's think it shows an animated ellipsis. */
function TurnIndicator({ thinking, outcome, reduce }) {
  if (outcome) {
    return (
      <div className="game-text inline-flex items-center gap-2 rounded-2xl border border-k-border bg-surface/60 px-5 py-2 text-text-secondary">
        Game over
      </div>
    )
  }
  if (thinking) {
    return (
      <div
        className="game-text inline-flex items-center gap-2 rounded-2xl border px-5 py-2 font-bold"
        style={{ borderColor: '#9E86F566', background: '#9E86F51f', color: '#9E86F5' }}
        role="status"
        aria-live="polite"
      >
        <Bot size={18} />
        <span>
          Bot is thinking
          {reduce ? '…' : <ThinkingDots />}
        </span>
      </div>
    )
  }
  return (
    <div
      className="game-text inline-flex items-center gap-2 rounded-2xl border px-5 py-2 font-bold"
      style={{ borderColor: '#FF602F66', background: '#FF602F1f', color: '#FF602F' }}
      role="status"
      aria-live="polite"
    >
      <User size={18} /> Your turn
    </div>
  )
}

/** Three dots that fade in sequence — motion only (reduced-motion shows "…"). */
function ThinkingDots() {
  return (
    <span aria-hidden="true" className="inline-flex">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
        >
          .
        </motion.span>
      ))}
    </span>
  )
}

/**
 * SkillPips — five pips conveying the bot's rising skill WITHOUT the raw number.
 * A full row (five lit pips) marks a perfect, unbeatable bot.
 */
function SkillPips({ skill }) {
  const lit = skillPips(skill)
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Bot skill ${lit} of 5`} title="The bot gets sharper each level">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: i < lit ? TINT : `${TINT}33` }}
        />
      ))}
    </span>
  )
}

function StatChip({ icon: Icon, value, label, mono }) {
  return (
    <div className="game-text inline-flex items-center gap-2 rounded-full border border-k-border bg-surface/60 px-3.5 py-1.5">
      <Icon size={15} className="text-turmeric" />
      <span className={`text-sm font-bold text-text-primary ${mono ? 'tabular-nums' : ''}`}>{value}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  )
}
