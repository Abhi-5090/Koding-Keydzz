import { useEffect, useState } from 'react'
import { getGame } from '../../data/games'
import levels from '../../data/tictactoeLevels'
import LeveledGamePage from '../../components/games/LeveledGamePage'
import HowToPlayModal from '../../components/games/HowToPlayModal'
import TicTacToePlayScreen from './tictactoe/TicTacToePlayScreen'

const GAME_KEY = 'tic-tac-toe'
const TINT = '#9E86F5'
const SEEN_KEY = 'kk_tictactoe_help_seen'
const game = getGame(GAME_KEY)

/**
 * Tic Tac Toe — a 20-level difficulty CLIMB. The bot's skill rises smoothly
 * each level (via the engine's aiMoveBySkill dial), from a wobbly beginner to
 * an UNBEATABLE minimax Grandmaster at the summit. You must WIN or DRAW to
 * advance. Built on the shared LeveledGamePage + useGameLevels scaffold;
 * progress and rewards persist via POST /games/complete. A kid-friendly "How to
 * Play" auto-shows the first time and via the Help button.
 */
export default function TicTacToe() {
  const [help, setHelp] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        setHelp(true)
        localStorage.setItem(SEEN_KEY, '1')
      }
    } catch {
      /* storage unavailable — skip the auto-popup */
    }
  }, [])

  return (
    <>
      <LeveledGamePage
        gameKey={GAME_KEY}
        game={game}
        levels={levels}
        renderPlay={({ level, onExit, onNext, hasNext, completeLevel, gameKey }) => (
          <TicTacToePlayScreen
            level={level}
            onExit={onExit}
            onNext={onNext}
            hasNext={hasNext}
            completeLevel={completeLevel}
            gameKey={gameKey}
            onHelp={() => setHelp(true)}
            helpOpen={help}
          />
        )}
      />

      <HowToPlayModal open={help} onClose={() => setHelp(false)} title="How to Play Tic Tac Toe" tint={TINT}>
        <p>
          <span className="font-bold text-text-primary">The goal:</span> get{' '}
          <span className="font-bold" style={{ color: TINT }}>three of your marks in a row</span> —
          across, down, or diagonally.
        </p>

        <WinExample tint={TINT} />

        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            You are <span className="font-bold" style={{ color: '#FF602F' }}>X</span> and you always
            go <span className="font-bold">first</span>. The bot is{' '}
            <span className="font-bold" style={{ color: TINT }}>O</span>.
          </li>
          <li>Tap any empty square to place your X, then the bot takes its turn.</li>
          <li>The first to make three in a row wins. Fill the board with no line and it&apos;s a draw.</li>
          <li>
            There are <span className="font-bold text-text-primary">20 levels</span>. The bot starts{' '}
            <span className="font-bold">wobbly and easy</span> and gets a little{' '}
            <span className="font-bold" style={{ color: TINT }}>smarter every level</span> — a real
            difficulty climb.
          </li>
          <li>
            To move on, you must{' '}
            <span className="font-bold text-text-primary">win or draw</span>. A{' '}
            <span className="font-bold">win = 3 stars</span>, a{' '}
            <span className="font-bold">draw = 2 stars</span>. If the bot beats you, the level{' '}
            <span className="font-bold">stays locked</span> — just try again!
          </li>
          <li>
            The last levels (<span className="font-bold" style={{ color: TINT }}>Grandmaster</span> and{' '}
            <span className="font-bold" style={{ color: TINT }}>The Unbeatable</span>) play{' '}
            <span className="font-bold">perfectly</span> — they can never lose, so a{' '}
            <span className="font-bold text-text-primary">DRAW is a perfect result</span> (all 3 stars!).
          </li>
        </ul>

        <p className="rounded-xl border border-k-border bg-surface/50 px-3 py-2">
          <span className="font-bold text-turmeric">Tips:</span> take the{' '}
          <span className="font-bold">center</span> when you can, always{' '}
          <span className="font-bold">block</span> the bot when it has two in a row, and try to make{' '}
          <span className="font-bold">two threats at once</span> so it can only stop one!
        </p>
      </HowToPlayModal>
    </>
  )
}

/** A tiny board showing a winning diagonal of X's. */
function WinExample({ tint }) {
  // 0 = empty, 'X', 'O'. A diagonal X win at 0, 4, 8.
  const demo = ['X', 'O', 'O', 0, 'X', 0, 0, 0, 'X']
  const winCells = new Set([0, 4, 8])
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid grid-cols-3 gap-1 rounded-lg p-1"
        style={{ background: `${tint}26` }}
      >
        {demo.map((v, i) => (
          <div
            key={i}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-card text-sm font-extrabold"
            style={{
              color: v === 'X' ? '#FF602F' : v === 'O' ? tint : 'transparent',
              boxShadow: winCells.has(i) ? `inset 0 0 0 2px #FF602Fcc` : undefined,
            }}
          >
            {v === 0 ? '' : v}
          </div>
        ))}
      </div>
      <p className="text-xs">
        Three <span className="font-bold" style={{ color: '#FF602F' }}>X</span>&apos;s on the
        diagonal — that&apos;s a win! Rows and columns count too.
      </p>
    </div>
  )
}
