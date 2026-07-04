import { useEffect, useState } from 'react'
import { getGame } from '../../data/games'
import levels from '../../data/hanoiLevels'
import LeveledGamePage from '../../components/games/LeveledGamePage'
import HowToPlayModal from '../../components/games/HowToPlayModal'
import HanoiPlayScreen from './hanoi/HanoiPlayScreen'

const GAME_KEY = 'towers-of-hanoi'
const TINT = '#FF8A4D'
const SEEN_KEY = 'kk_hanoi_help_seen'
const game = getGame(GAME_KEY)

/**
 * TowersOfHanoi — leveled disk-stacking puzzle (N=3 → N=7). Built on the shared
 * LeveledGamePage + useGameLevels scaffold; progress and rewards persist via
 * POST /games/complete. A kid-friendly "How to Play" auto-shows once.
 */
export default function TowersOfHanoi() {
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
          <HanoiPlayScreen
            level={level}
            onExit={onExit}
            onNext={onNext}
            hasNext={hasNext}
            completeLevel={completeLevel}
            onHelp={() => setHelp(true)}
          />
        )}
      />

      <HowToPlayModal open={help} onClose={() => setHelp(false)} title="How to Play Towers of Hanoi" tint={TINT}>
        <p>
          Move the whole stack of disks from the start peg to the{' '}
          <span className="font-bold" style={{ color: TINT }}>goal peg</span>. Easy… but there are
          three golden rules.
        </p>

        <StackExample tint={TINT} />

        <ul className="list-disc space-y-1.5 pl-5">
          <li>Move only <span className="font-bold text-text-primary">one disk at a time</span>.</li>
          <li>You can only take the <span className="font-bold text-text-primary">top</span> disk off a peg.</li>
          <li>
            <span className="font-bold text-text-primary">Never</span> place a bigger disk on top of a
            smaller one.
          </li>
          <li>Tap a peg to pick up its top disk, then tap another peg to drop it.</li>
        </ul>

        <p className="rounded-xl border border-k-border bg-surface/50 px-3 py-2">
          <span className="font-bold text-turmeric">Think recursively:</span> to move the tall stack,
          first move the top group of disks aside, then move the biggest disk to the goal, then bring
          that group back on top. Do it in the fewest moves with no hints for all 3 stars!
        </p>
      </HowToPlayModal>
    </>
  )
}

/** A tiny 3-disk illustration: bright small disk on top, dark big disk at the bottom. */
function StackExample({ tint }) {
  const rows = [3, 2, 1] // bottom -> top sizes
  const color = (size) => {
    const t = (size - 1) / 2 // 0 bright .. 1 dark
    const bright = [255, 194, 138]
    const dark = [138, 46, 20]
    const ch = (i) => Math.round(bright[i] + (dark[i] - bright[i]) * t)
    return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`
  }
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-[74px] w-24 flex-col-reverse items-center justify-start rounded-lg bg-malt px-2 pb-2 pt-1">
        <span
          aria-hidden="true"
          className="absolute bottom-2 left-1/2 h-[58px] w-1.5 -translate-x-1/2 rounded-full"
          style={{ background: `${tint}88` }}
        />
        {rows.map((size) => (
          <span
            key={size}
            className="relative z-[1] mb-[3px] flex h-4 items-center justify-center rounded-full"
            style={{ width: 28 + size * 16, background: color(size) }}
          />
        ))}
      </div>
      <p className="text-xs">
        Disks always go <span className="font-bold" style={{ color: tint }}>big on the bottom,
        small on top</span> — that order can never break.
      </p>
    </div>
  )
}
