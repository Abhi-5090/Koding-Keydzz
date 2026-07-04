import { useEffect, useState } from 'react'
import { getGame } from '../../data/games'
import levels from '../../data/sudokuLevels'
import LeveledGamePage from '../../components/games/LeveledGamePage'
import HowToPlayModal from '../../components/games/HowToPlayModal'
import SudokuPlayScreen from './sudoku/SudokuPlayScreen'

const GAME_KEY = 'sudoku'
const TINT = '#2DD4BF'
const SEEN_KEY = 'kk_sudoku_help_seen'
const game = getGame(GAME_KEY)

/**
 * Sudoku — leveled number-logic puzzle (4x4 → 6x6 → 9x9). Built on the shared
 * LeveledGamePage + useGameLevels scaffold so progress and rewards persist via
 * POST /games/complete. Includes a kid-friendly "How to Play" modal that
 * auto-shows the first time and is reachable from a Help button.
 */
export default function Sudoku() {
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
          <SudokuPlayScreen
            level={level}
            onExit={onExit}
            onNext={onNext}
            hasNext={hasNext}
            completeLevel={completeLevel}
            onHelp={() => setHelp(true)}
          />
        )}
      />

      <HowToPlayModal open={help} onClose={() => setHelp(false)} title="How to Play Sudoku" tint={TINT}>
        <p>
          <span className="font-bold text-text-primary">The one rule:</span> fill the grid so that
          every <span className="font-bold" style={{ color: TINT }}>row</span>, every{' '}
          <span className="font-bold" style={{ color: TINT }}>column</span>, and every{' '}
          <span className="font-bold" style={{ color: TINT }}>box</span> contains each number
          exactly once.
        </p>

        <ExampleMini tint={TINT} />

        <ul className="list-disc space-y-1.5 pl-5">
          <li>Tap an empty cell, then tap a number on the pad to place it.</li>
          <li>The locked (brighter) numbers are clues — they can't be changed.</li>
          <li>If a number repeats in a row, column, or box, those cells turn red.</li>
          <li>Stuck? Use <span className="font-bold text-text-primary">Hint</span> to reveal one correct cell.</li>
        </ul>

        <p className="rounded-xl border border-k-border bg-surface/50 px-3 py-2">
          <span className="font-bold text-turmeric">Star tip:</span> finish with{' '}
          <span className="font-bold">0 mistakes and 0 hints</span> to earn all 3 stars!
        </p>
      </HowToPlayModal>
    </>
  )
}

/** A tiny 4x4 example showing one solved row/column/box. */
function ExampleMini({ tint }) {
  const demo = [
    [1, 2, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1],
  ]
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid grid-cols-4 overflow-hidden rounded-lg border-2"
        style={{ borderColor: `${tint}88` }}
      >
        {demo.flatMap((row, r) =>
          row.map((v, c) => (
            <div
              key={`${r}-${c}`}
              className="flex h-7 w-7 items-center justify-center font-game text-sm font-bold"
              style={{
                color: r === 0 ? tint : '#9DB8C4',
                background: r === 0 ? `${tint}1f` : 'transparent',
                borderRight: c === 1 ? `2px solid ${tint}88` : `1px solid ${tint}22`,
                borderBottom: r === 1 ? `2px solid ${tint}88` : `1px solid ${tint}22`,
              }}
            >
              {v}
            </div>
          ))
        )}
      </div>
      <p className="text-xs">
        See the top row: <span className="font-bold" style={{ color: tint }}>1 2 3 4</span> — each
        number once. Every row, column, and box must look like that.
      </p>
    </div>
  )
}
