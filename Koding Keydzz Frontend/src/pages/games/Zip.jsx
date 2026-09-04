import { useEffect, useState } from 'react'
import { getGame } from '../../data/games'
import levels from '../../data/zipLevels'
import LeveledGamePage from '../../components/games/LeveledGamePage'
import HowToPlayModal from '../../components/games/HowToPlayModal'
import ZipPlayScreen from './zip/ZipPlayScreen'
import { BOARD_BG } from '../../theme/tokens'

const GAME_KEY = 'zip'
const TINT = '#2DD4BF'
const SEEN_KEY = 'kk_zip_help_seen'
const game = getGame(GAME_KEY)

/**
 * Zip — leveled path-logic puzzle (draw one line that fills every square while
 * passing the numbers in order, never crossing a wall). Built on the shared
 * LeveledGamePage + useGameLevels scaffold so progress and rewards persist via
 * POST /games/complete. Includes a kid-friendly "How to Play" modal that
 * auto-shows the first time and is reachable from a Help button.
 */
export default function Zip() {
  const [help, setHelp] = useState(false)

  // Auto-show the instructions once, ever (per browser).
  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        setHelp(true)
        localStorage.setItem(SEEN_KEY, '1')
      }
    } catch {
      /* storage unavailable — just skip the auto-popup */
    }
  }, [])

  return (
    <>
      <LeveledGamePage
        gameKey={GAME_KEY}
        game={game}
        levels={levels}
        renderPlay={({ level, onExit, onNext, hasNext, completeLevel }) => (
          <ZipPlayScreen
            level={level}
            onExit={onExit}
            onNext={onNext}
            hasNext={hasNext}
            completeLevel={completeLevel}
            onHelp={() => setHelp(true)}
          />
        )}
      />

      <HowToPlayModal open={help} onClose={() => setHelp(false)} title="How to Play Zip" tint={TINT}>
        <p>
          <span className="font-bold text-text-primary">The one rule:</span> draw{' '}
          <span className="font-bold" style={{ color: TINT }}>one line</span> that fills{' '}
          <span className="font-bold" style={{ color: TINT }}>every square</span> — going through the
          numbers in order (<span className="font-bold text-success">1</span> → 2 → 3 → …).
        </p>

        <ExampleMini tint={TINT} />

        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Start on <span className="font-bold text-success">1</span>, then drag across squares to
            draw your line (or tap them one by one).
          </li>
          <li>Move back onto the square you just came from to erase that step.</li>
          <li>
            You can’t cross the <span className="font-bold text-error">thick red walls</span>, and you
            can’t use a square twice.
          </li>
          <li>Win when your line fills every square and has visited all the numbers in order.</li>
        </ul>

        <p className="rounded-xl border border-k-border bg-surface/50 px-3 py-2">
          <span className="font-bold text-turmeric">Star tip:</span> finish with{' '}
          <span className="font-bold">no hints and no wrong moves</span> to earn all 3 stars!
        </p>
      </HowToPlayModal>
    </>
  )
}

/**
 * A tiny 3x3 example: numbers 1 (top-left), 2 (top-right), 3 (bottom-right)
 * with a drawn line snaking through every square in order.
 */
function ExampleMini({ tint }) {
  // path cells (x,y) in order through the 3x3 grid
  const path = [
    [0, 0], [0, 1], [0, 2], [1, 2], [1, 1],
    [1, 0], [2, 0], [2, 1], [2, 2],
  ]
  const numbers = { '0,0': 1, '2,0': 2, '2,2': 3 }
  const points = path.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(' ')

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative overflow-hidden rounded-lg border-2"
        style={{ width: 96, height: 96, borderColor: `${tint}88`, background: BOARD_BG }}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 3 3" preserveAspectRatio="none">
          <polyline
            points={points}
            fill="none"
            stroke={tint}
            strokeWidth={0.32}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="absolute inset-0 grid grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => {
            const x = i % 3
            const y = Math.floor(i / 3)
            const n = numbers[`${x},${y}`]
            return (
              <div key={i} className="relative flex items-center justify-center border border-white/5">
                {n != null && (
                  <span
                    className="z-10 flex h-4 w-4 items-center justify-center rounded-full font-game text-[10px] font-extrabold"
                    style={{ background: n === 1 ? '#34D399' : tint, color: '#001621' }}
                  >
                    {n}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-xs">
        One line fills all 9 squares and touches{' '}
        <span className="font-bold text-success">1</span> →{' '}
        <span className="font-bold" style={{ color: tint }}>2</span> →{' '}
        <span className="font-bold" style={{ color: tint }}>3</span> in order.
      </p>
    </div>
  )
}
