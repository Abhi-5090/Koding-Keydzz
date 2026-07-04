import { useEffect, useState } from 'react'
import { Crown } from 'lucide-react'
import { getGame } from '../../data/games'
import levels from '../../data/nqueensLevels'
import LeveledGamePage from '../../components/games/LeveledGamePage'
import HowToPlayModal from '../../components/games/HowToPlayModal'
import NQueensPlayScreen from './nqueens/NQueensPlayScreen'

const GAME_KEY = 'n-queens'
const TINT = '#FF8A4D'
const SEEN_KEY = 'kk_nqueens_help_seen'
const game = getGame(GAME_KEY)

/**
 * N-Queens — leveled placement puzzle (N=4 → N=8). Built on the shared
 * LeveledGamePage + useGameLevels scaffold; progress and rewards persist via
 * POST /games/complete. Kid-friendly "How to Play" auto-shows once.
 */
export default function NQueens() {
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
        renderPlay={({ level, onExit, onNext, hasNext, completeLevel }) => (
          <NQueensPlayScreen
            level={level}
            onExit={onExit}
            onNext={onNext}
            hasNext={hasNext}
            completeLevel={completeLevel}
            onHelp={() => setHelp(true)}
            helpOpen={help}
          />
        )}
      />

      <HowToPlayModal open={help} onClose={() => setHelp(false)} title="How to Play N-Queens" tint={TINT}>
        <p>
          A <span className="font-bold" style={{ color: TINT }}>queen</span> is the most powerful
          chess piece. She attacks along her whole{' '}
          <span className="font-bold text-text-primary">row</span>,{' '}
          <span className="font-bold text-text-primary">column</span>, and{' '}
          <span className="font-bold text-text-primary">both diagonals</span>.
        </p>

        <AttackExample tint={TINT} />

        <p>
          <span className="font-bold text-text-primary">Goal:</span> place{' '}
          <span className="font-bold" style={{ color: TINT }}>N queens</span> on the board so that{' '}
          <span className="font-bold">no two queens attack each other</span>.
        </p>

        <ul className="list-disc space-y-1.5 pl-5">
          <li>Tap a square to place a queen; tap it again to remove her.</li>
          <li>Red dots mark squares that are under attack — keep queens off them.</li>
          <li>If two crowns turn red, they're attacking each other. Move one.</li>
          <li>Tip: work one column at a time, since each column needs exactly one queen.</li>
          <li>
            <span className="font-bold text-text-primary">Beat the clock:</span> there's a{' '}
            <span className="font-bold" style={{ color: TINT }}>countdown timer</span> — solve it
            before time runs out! It turns red in the last 10 seconds. Run out and you can replay.
          </li>
        </ul>

        <p className="rounded-xl border border-k-border bg-surface/50 px-3 py-2">
          <span className="font-bold text-turmeric">Star tip:</span> solve it with{' '}
          <span className="font-bold">no hints and almost no clashes</span> for all 3 stars!
        </p>
      </HowToPlayModal>
    </>
  )
}

/** A 4x4 example: one queen with her attack lines marked. */
function AttackExample({ tint }) {
  const queen = { r: 1, c: 1 }
  const attacks = (r, c) => {
    if (r === queen.r && c === queen.c) return false
    return r === queen.r || c === queen.c || Math.abs(r - queen.r) === Math.abs(c - queen.c)
  }
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid grid-cols-4 overflow-hidden rounded-lg border-2"
        style={{ borderColor: `${tint}88` }}
      >
        {Array.from({ length: 4 }).flatMap((_, r) =>
          Array.from({ length: 4 }).map((__, c) => {
            const isQ = r === queen.r && c === queen.c
            const hit = attacks(r, c)
            const dark = (r + c) % 2 === 1
            return (
              <div
                key={`${r}-${c}`}
                className="flex h-7 w-7 items-center justify-center"
                style={{
                  background: hit
                    ? 'rgba(255,84,112,0.22)'
                    : dark
                      ? 'rgba(10,46,60,0.9)'
                      : 'rgba(4,33,46,0.55)',
                }}
              >
                {isQ ? (
                  <Crown size={16} style={{ color: tint }} fill={`${tint}33`} />
                ) : hit ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-error/70" />
                ) : null}
              </div>
            )
          })
        )}
      </div>
      <p className="text-xs">
        The <span className="font-bold" style={{ color: tint }}>crown</span> attacks every red
        square. No other queen may stand there.
      </p>
    </div>
  )
}
