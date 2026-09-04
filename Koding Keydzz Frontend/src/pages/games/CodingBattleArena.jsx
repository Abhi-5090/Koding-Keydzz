import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy,
  Handshake,
  Flame,
  Bot,
  Cat,
  Timer,
  Satellite,
  X,
  TriangleAlert,
  ArrowLeft,
  Medal,
  Circle,
  Swords,
  CheckCircle2,
  XCircle,
  Hourglass,
  Send,
} from 'lucide-react'
import { getGame } from '../../data/games'
import { connectSocket, getSocket } from '../../app/socket'
import { useAuth } from '../../hooks/useAuth'
import GameShell from '../../components/games/GameShell'
import useGameWin from '../../hooks/useGameWin'
import AnimatedIcon from '../../components/ui/AnimatedIcon'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LeveledGamePage from '../../components/games/LeveledGamePage'
import QuestionLevelGame from '../../components/games/QuestionLevelGame'
import campaignLevels from '../../data/battleLevels'

const game = getGame('battle-arena')

/* ------------------------------------------------------------------ *
 *  Campaign mode — ~18 timed question levels with an arena countdown   *
 *  (per-question timer ramps: easy 15s, medium 12s, hard 9s).          *
 *  Reuses the shared LeveledGamePage + QuestionLevelGame scaffold and  *
 *  persists each level via completeLevel (gameKey 'battle-arena').     *
 * ------------------------------------------------------------------ */

const TIME_BY_DIFFICULTY = { easy: 15, medium: 12, hard: 9 }

function CampaignBattle({ onExit }) {
  return (
    <LeveledGamePage
      gameKey="battle-arena"
      game={game}
      levels={campaignLevels}
      backSlot={
        <button
          type="button"
          onClick={onExit}
          className="game-text inline-flex items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
        >
          <ArrowLeft size={16} /> Arena Lobby
        </button>
      }
      renderPlay={({ level, onExit: onLevelExit, onNext, hasNext, completeLevel }) => (
        <QuestionLevelGame
          game={game}
          level={level}
          onExit={onLevelExit}
          onNext={onNext}
          hasNext={hasNext}
          timePerQuestion={TIME_BY_DIFFICULTY[level.difficulty] || 12}
          onComplete={(stars, performance) => completeLevel(level, stars, { performance })}
        />
      )}
    />
  )
}

/* ------------------------------------------------------------------ *
 *  Practice mode — rapid MCQ rounds vs a simulated rival (offline OK)  *
 * ------------------------------------------------------------------ */

const QUESTIONS = [
  { q: 'What is 2 ** 3 in Python?', options: ['6', '8', '9', '5'], answer: 1 },
  { q: 'Which is a Boolean value?', options: ['"yes"', 'True', '42', 'loop'], answer: 1 },
  { q: 'len("code") returns…', options: ['3', '4', '5', 'error'], answer: 1 },
  { q: 'Which keyword defines a function?', options: ['func', 'def', 'fun', 'lambda'], answer: 1 },
  { q: '10 % 3 equals…', options: ['1', '3', '0', '7'], answer: 0 },
]

const ROUND_TIME = 8 // seconds per practice question

function PracticeBattle({ onExit }) {
  const [phase, setPhase] = useState('battle') // battle | result
  const [index, setIndex] = useState(0)
  const [time, setTime] = useState(ROUND_TIME)
  const [myScore, setMyScore] = useState(0)
  const [oppScore, setOppScore] = useState(0)
  const [picked, setPicked] = useState(null)
  const [won, setWon] = useState(false)
  const { reward, alreadyMastered, claim } = useGameWin('battle-arena')
  const timerRef = useRef(null)

  const q = QUESTIONS[index]

  const advance = useCallback(
    (iAnsweredRight) => {
      // Simulated opponent answers with ~60% accuracy.
      if (Math.random() < 0.6) setOppScore((s) => s + 1)
      if (index + 1 >= QUESTIONS.length) {
        const finalMine = myScore + (iAnsweredRight ? 1 : 0)
        const didWin = finalMine >= oppScore
        setPhase('result')
        setWon(didWin)
        // Persist the win to the account (backend is the source of truth).
        if (didWin) claim({ difficulty: 'hard', stars: 3 })
      } else {
        setIndex((x) => x + 1)
        setPicked(null)
      }
    },
    [index, myScore, oppScore, claim],
  )

  useEffect(() => {
    if (phase !== 'battle') return
    setTime(ROUND_TIME)
    timerRef.current = setInterval(() => {
      setTime((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          advance(false)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index])

  const pick = (i) => {
    if (picked != null) return
    setPicked(i)
    clearInterval(timerRef.current)
    const right = i === q.answer
    if (right) setMyScore((s) => s + 1)
    setTimeout(() => advance(right), 650)
  }

  if (phase === 'result') {
    const draw = myScore === oppScore
    return (
      <GameShell
        game={game}
        won={won}
        xp={reward.xp}
        coins={reward.coins}
        alreadyMastered={alreadyMastered}
        winMessage="You out-coded the bot! Try a live duel next."
        onPlayAgain={onExit}
      >
        <Card hover={false} className="text-center">
          <h2 className="game-text flex items-center justify-center gap-2 text-2xl font-bold text-turmeric">
            {won ? (
              <>
                <AnimatedIcon icon={Trophy} size={26} animation="pop" className="text-turmeric" glow />
                You Win!
              </>
            ) : draw ? (
              <>
                <Handshake size={24} /> Draw!
              </>
            ) : (
              <>
                <Flame size={24} /> Good Fight!
              </>
            )}
          </h2>
          <div className="mt-6 flex items-center justify-center gap-8">
            <div className="flex flex-col items-center">
              <Cat size={40} className="text-success" />
              <div className="game-text text-3xl font-bold text-success">{myScore}</div>
              <div className="text-xs text-text-secondary">You</div>
            </div>
            <span className="game-text text-2xl text-text-secondary">vs</span>
            <div className="flex flex-col items-center">
              <Bot size={40} className="text-error" />
              <div className="game-text text-3xl font-bold text-error">{oppScore}</div>
              <div className="text-xs text-text-secondary">Bot</div>
            </div>
          </div>
          <Button className="mt-6" onClick={onExit}>
            <span className="inline-flex items-center gap-1.5">
              <ArrowLeft size={15} /> Back to Lobby
            </span>
          </Button>
        </Card>
      </GameShell>
    )
  }

  return (
    <GameShell game={game}>
      <Card hover={false}>
        <div className="mb-4 flex items-center justify-between">
          <span className="game-text flex items-center gap-1.5 rounded-lg bg-success/15 px-3 py-1 text-sm text-success">
            <Cat size={15} /> You {myScore}
          </span>
          <motion.div
            key={time}
            initial={{ scale: 1.4 }}
            animate={{ scale: 1 }}
            className={`game-text flex items-center gap-1.5 text-2xl font-bold ${time <= 3 ? 'text-error' : 'text-turmeric'}`}
          >
            <Timer size={22} /> {time}s
          </motion.div>
          <span className="game-text flex items-center gap-1.5 rounded-lg bg-error/15 px-3 py-1 text-sm text-error">
            <Bot size={15} /> Bot {oppScore}
          </span>
        </div>

        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-surface">
          <motion.div
            key={index}
            className="h-full bg-gradient-to-r from-turmeric to-accent"
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: ROUND_TIME, ease: 'linear' }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="game-text text-sm text-text-secondary">
              Round {index + 1} of {QUESTIONS.length}
            </span>
            <h2 className="game-text mb-5 mt-1 text-xl font-bold">{q.q}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {q.options.map((opt, i) => {
                let style = 'border-k-border bg-surface/50 can-hover:hover:border-turmeric'
                if (picked != null && i === q.answer)
                  style = 'border-success bg-success/15 text-success'
                else if (picked === i && i !== q.answer)
                  style = 'border-error bg-error/15 text-error'
                return (
                  <motion.button
                    key={i}
                    whileHover={picked == null ? { scale: 1.03 } : {}}
                    whileTap={picked == null ? { scale: 0.97 } : undefined}
                    onClick={() => pick(i)}
                    disabled={picked != null}
                    className={`game-text rounded-xl border-2 px-4 py-3 transition-[background-color,border-color,color,box-shadow] duration-200 ${style}`}
                  >
                    {opt}
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </Card>
    </GameShell>
  )
}

/* ------------------------------------------------------------------ *
 *  Live mode — real-time duel over Socket.IO against another player   *
 *  Backend contract (src/sockets/battle.js):                          *
 *   emit  join_queue | leave_queue | submit_answer {output, roomId}   *
 *   recv  queued{position} battle_start{roomId,question{prompt}}      *
 *         answer_result{correct,score} battle_end{winnerUserId,...}   *
 *         battle_error{message}                                       *
 * ------------------------------------------------------------------ */

const DUEL_TIME = 30 // seconds to answer the live prompt

function LiveBattle({ onExit }) {
  const { user, token } = useAuth()
  const myId = user?.id || user?._id

  const [status, setStatus] = useState('connecting') // connecting | searching | dueling | answered | result | error
  const [position, setPosition] = useState(null)
  const [question, setQuestion] = useState(null)
  const [answer, setAnswer] = useState('')
  const [time, setTime] = useState(DUEL_TIME)
  const [result, setResult] = useState(null) // { won, reason, rewards, draw }
  const [feedback, setFeedback] = useState(null) // { correct }
  const [errorMsg, setErrorMsg] = useState('')
  const submittedRef = useRef(false)
  const timerRef = useRef(null)
  const roomRef = useRef(null)

  // Set up the socket + listeners once.
  useEffect(() => {
    const socket = connectSocket(token)

    const onConnect = () => {
      setStatus('searching')
      socket.emit('join_queue')
    }
    const onQueued = (p) => {
      setStatus('searching')
      setPosition(p?.position ?? null)
    }
    const onStart = (payload) => {
      roomRef.current = payload?.roomId || null
      setQuestion(payload?.question || null)
      submittedRef.current = false
      setAnswer('')
      setFeedback(null)
      setTime(DUEL_TIME)
      setStatus('dueling')
    }
    const onAnswerResult = (r) => setFeedback({ correct: !!r?.correct })
    const onEnd = (payload) => {
      const winnerId = payload?.winnerUserId
      const draw = !winnerId
      setResult({
        won: !!winnerId && String(winnerId) === String(myId),
        draw,
        reason: payload?.reason,
        rewards: payload?.rewards || null,
      })
      setStatus('result')
    }
    const onError = (e) => {
      setErrorMsg(e?.message || 'Battle error')
      setStatus('error')
    }

    socket.on('connect', onConnect)
    socket.on('queued', onQueued)
    socket.on('battle_start', onStart)
    socket.on('answer_result', onAnswerResult)
    socket.on('battle_end', onEnd)
    socket.on('battle_error', onError)

    // Already connected? Join immediately.
    if (socket.connected) onConnect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('queued', onQueued)
      socket.off('battle_start', onStart)
      socket.off('answer_result', onAnswerResult)
      socket.off('battle_end', onEnd)
      socket.off('battle_error', onError)
      // Leave matchmaking if we bail before/after a duel. The shared socket
      // stays connected so notifications keep working.
      socket.emit('leave_queue')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = useCallback(
    (value) => {
      if (submittedRef.current) return
      submittedRef.current = true
      clearInterval(timerRef.current)
      const socket = getSocket()
      socket.emit('submit_answer', { output: value ?? answer, roomId: roomRef.current })
      setStatus('answered')
    },
    [answer],
  )

  // Live countdown during a duel; auto-submit whatever's typed on timeout.
  useEffect(() => {
    if (status !== 'dueling') return
    timerRef.current = setInterval(() => {
      setTime((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          submit(answer)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  if (status === 'connecting' || status === 'searching') {
    return (
      <GameShell game={game}>
        <Card hover={false} className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="mx-auto mb-4 w-fit text-turmeric"
            style={{ filter: 'drop-shadow(0 0 10px rgba(255,96,47,0.6))' }}
          >
            <Satellite size={60} />
          </motion.div>
          <h2 className="game-text text-2xl font-bold text-turmeric">
            {status === 'connecting' ? 'Connecting…' : 'Finding a rival…'}
          </h2>
          <p className="mt-2 text-text-secondary">
            {position ? `You're #${position} in the queue.` : 'Matching you with another coder.'}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-3 w-3 rounded-full bg-turmeric"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
          <Button variant="ghost" className="mt-6" onClick={onExit}>
            <span className="inline-flex items-center gap-1.5">
              <X size={15} /> Cancel
            </span>
          </Button>
        </Card>
      </GameShell>
    )
  }

  if (status === 'error') {
    return (
      <GameShell game={game}>
        <Card hover={false} className="text-center">
          <div className="mb-3 flex justify-center text-error">
            <TriangleAlert size={48} />
          </div>
          <h2 className="game-text text-xl font-bold text-error">Couldn’t start the duel</h2>
          <p className="mx-auto mt-2 max-w-sm text-text-secondary">{errorMsg}</p>
          <Button className="mt-6" onClick={onExit}>
            <span className="inline-flex items-center gap-1.5">
              <ArrowLeft size={15} /> Back to Lobby
            </span>
          </Button>
        </Card>
      </GameShell>
    )
  }

  if (status === 'result') {
    const { won, draw, rewards } = result || {}
    return (
      <GameShell
        game={game}
        won={won}
        xp={rewards?.xp ?? 100}
        coins={rewards?.coins ?? 25}
        winMessage="You won a live duel! Champion of the arena!"
        onPlayAgain={onExit}
      >
        <Card hover={false} className="text-center">
          <div className="mb-2 flex justify-center">
            {won ? (
              <AnimatedIcon icon={Trophy} size={48} animation="pop" className="text-turmeric" glow />
            ) : draw ? (
              <Handshake size={48} className="text-text-secondary" />
            ) : (
              <Medal size={48} className="text-text-secondary" />
            )}
          </div>
          <h2 className="game-text text-2xl font-bold text-turmeric">
            {won ? 'Victory!' : draw ? 'Draw!' : 'Defeated'}
          </h2>
          <p className="mt-2 text-text-secondary">
            {won
              ? `You answered first/best and earned ${rewards?.xp ?? 100} XP + ${rewards?.coins ?? 25} coins.`
              : draw
                ? 'Evenly matched — nobody took the crown this time.'
                : 'Your rival was faster. Rematch and reclaim the arena!'}
          </p>
          <Button className="mt-6" onClick={onExit}>
            <span className="inline-flex items-center gap-1.5">
              <ArrowLeft size={15} /> Back to Lobby
            </span>
          </Button>
        </Card>
      </GameShell>
    )
  }

  // dueling | answered
  return (
    <GameShell game={game}>
      <Card hover={false}>
        <div className="mb-4 flex items-center justify-between">
          <span className="game-text flex items-center gap-1.5 rounded-lg bg-success/15 px-3 py-1 text-sm text-success">
            <Circle size={10} className="fill-current" /> Live duel
          </span>
          <motion.div
            key={time}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className={`game-text flex items-center gap-1.5 text-2xl font-bold ${time <= 5 ? 'text-error' : 'text-turmeric'}`}
          >
            <Timer size={22} /> {time}s
          </motion.div>
          <span className="game-text flex items-center gap-1.5 rounded-lg bg-error/15 px-3 py-1 text-sm text-error">
            <Swords size={15} /> vs Rival
          </span>
        </div>

        <div className="rounded-xl border-2 border-k-border bg-surface/40 p-4">
          <span className="game-text text-xs uppercase tracking-wide text-text-secondary">
            Your challenge
          </span>
          <h2 className="game-text mt-1 text-xl font-bold text-text-primary">
            {question?.prompt || 'Solve the challenge!'}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Type the exact output your program would print, then send it. First correct answer wins!
          </p>
        </div>

        <input
          autoFocus
          value={answer}
          disabled={status === 'answered'}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && answer.trim() && submit(answer)}
          placeholder="e.g. 5"
          className="game-text mt-4 w-full rounded-xl border-2 border-k-border bg-malt px-4 py-3 text-lg text-text-primary outline-none focus:border-turmeric"
        />

        {feedback && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-3 game-text flex items-center gap-1.5 text-sm ${feedback.correct ? 'text-success' : 'text-text-secondary'}`}
          >
            {feedback.correct ? (
              <>
                <CheckCircle2 size={15} className="text-success" /> Correct! Waiting for the final
                result…
              </>
            ) : (
              <>
                <XCircle size={15} /> Not quite — waiting to see if your rival nails it…
              </>
            )}
          </motion.p>
        )}

        <div className="mt-5 flex gap-3">
          <Button
            className="flex-1"
            disabled={status === 'answered' || !answer.trim()}
            onClick={() => submit(answer)}
          >
            <span className="inline-flex items-center gap-1.5">
              {status === 'answered' ? (
                <>
                  <Hourglass size={15} /> Submitted
                </>
              ) : (
                <>
                  <Send size={15} /> Send Answer
                </>
              )}
            </span>
          </Button>
          <Button variant="ghost" onClick={onExit}>
            Forfeit
          </Button>
        </div>
      </Card>
    </GameShell>
  )
}

/* ------------------------------------------------------------------ *
 *  Lobby — choose Live duel or Practice                               *
 * ------------------------------------------------------------------ */

export default function CodingBattleArena() {
  const { isAuthenticated } = useAuth()
  const [mode, setMode] = useState('menu') // menu | campaign | live | practice

  if (mode === 'campaign') return <CampaignBattle onExit={() => setMode('menu')} />
  if (mode === 'live') return <LiveBattle onExit={() => setMode('menu')} />
  if (mode === 'practice') return <PracticeBattle onExit={() => setMode('menu')} />

  return (
    <GameShell game={game}>
      <Card hover={false} className="text-center">
        <motion.div
          animate={{ rotate: [0, -10, 10, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="mb-3 w-fit mx-auto text-turmeric"
          style={{ filter: 'drop-shadow(0 0 12px rgba(255,96,47,0.7))' }}
        >
          <Swords size={60} />
        </motion.div>
        <h2 className="game-text text-2xl font-bold text-turmeric">Coding Battle Arena</h2>
        <p className="mx-auto mt-2 max-w-md text-text-secondary">
          Race the clock through the campaign, out-code a rival in a real-time duel, or sharpen
          your skills against a practice bot.
        </p>

        {/* Campaign — the new, leveled, primary mode. */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setMode('campaign')}
          className="mt-6 flex w-full items-center gap-4 rounded-xl border-2 border-turmeric bg-turmeric/10 p-5 text-left shadow-[0_0_24px_rgba(255,96,47,0.45)] transition-[background-color,box-shadow] duration-200 can-hover:hover:bg-turmeric/20"
        >
          <Trophy size={32} className="shrink-0 text-turmeric" />
          <div className="flex-1">
            <div className="game-text flex items-center gap-2 text-lg font-bold text-text-primary">
              Campaign
              <span className="game-text rounded-full bg-turmeric/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-turmeric">
                New
              </span>
            </div>
            <p className="mt-0.5 text-xs text-text-secondary">
              {campaignLevels.length} timed levels — beat the per-question clock and earn stars,
              XP & coins.
            </p>
          </div>
          <Timer size={22} className="shrink-0 text-turmeric" />
        </motion.button>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <motion.button
            whileHover={{ scale: isAuthenticated ? 1.03 : 1 }}
            whileTap={isAuthenticated ? { scale: 0.98 } : undefined}
            disabled={!isAuthenticated}
            onClick={() => setMode('live')}
            className={`rounded-xl border-2 p-5 text-left transition-[background-color,border-color,color,box-shadow] duration-200 ${
              isAuthenticated
                ? 'border-k-border bg-surface/40 can-hover:hover:border-success'
                : 'cursor-not-allowed border-k-border bg-surface/40 opacity-60'
            }`}
          >
            <Circle size={28} className="fill-success text-success" />
            <div className="game-text mt-1 text-lg font-bold text-text-primary">Live Duel</div>
            <p className="mt-1 text-xs text-text-secondary">
              {isAuthenticated
                ? 'Match against a real player. Winner takes XP + coins.'
                : 'Log in to battle real players live.'}
            </p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setMode('practice')}
            className="rounded-xl border-2 border-k-border bg-surface/40 p-5 text-left transition-[background-color,border-color,color,box-shadow] duration-200 can-hover:hover:border-accent"
          >
            <Bot size={28} className="text-accent" />
            <div className="game-text mt-1 text-lg font-bold text-text-primary">Practice</div>
            <p className="mt-1 text-xs text-text-secondary">
              Rapid-fire rounds vs a bot. Works offline — great for warming up.
            </p>
          </motion.button>
        </div>
      </Card>
    </GameShell>
  )
}
