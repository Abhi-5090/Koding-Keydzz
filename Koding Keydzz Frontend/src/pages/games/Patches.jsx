import { useEffect, useState } from 'react'
import { MoveHorizontal, MoveVertical, Plus } from 'lucide-react'
import { getGame } from '../../data/games'
import levels from '../../data/patchesLevels'
import LeveledGamePage from '../../components/games/LeveledGamePage'
import HowToPlayModal from '../../components/games/HowToPlayModal'
import PatchesPlayScreen from './patches/PatchesPlayScreen'

const GAME_KEY = 'patches'
const TINT = '#8B7CF6'
const SEEN_KEY = 'kk_patches_help_seen'
const game = getGame(GAME_KEY)

/**
 * Patches — leveled spatial-logic puzzle (LinkedIn's real Patches mechanic):
 * every clue has an ORIENTATION type. Divide the grid into boxes so each box
 * holds one number equal to its area AND matches its clue's shape:
 *   ─ (h) → a single sideways row, │ (v) → a single upright column,
 *   ＋ (plus) → any rectangle. Every square must end up in exactly one box.
 *
 * Built on the shared LeveledGamePage + useGameLevels scaffold so progress and
 * rewards persist via POST /games/complete. Includes a kid-friendly "How to
 * Play" modal that auto-shows the first time and is reachable from Help.
 */
export default function Patches() {
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
          <PatchesPlayScreen
            level={level}
            onExit={onExit}
            onNext={onNext}
            hasNext={hasNext}
            completeLevel={completeLevel}
            onHelp={() => setHelp(true)}
            gameKey={GAME_KEY}
          />
        )}
      />

      <HowToPlayModal
        open={help}
        onClose={() => setHelp(false)}
        title="How to Play Patches"
        tint={TINT}
      >
        <p>
          <span className="font-bold text-text-primary">The idea:</span> split the whole grid into{' '}
          <span className="font-bold" style={{ color: TINT }}>boxes</span> so every box holds{' '}
          <span className="font-bold" style={{ color: TINT }}>exactly one number</span>. Each number
          also has a little <span className="font-bold text-text-primary">shape icon</span> that tells
          you how its box must look — <span className="font-bold text-text-primary">press the number
          and drag</span> to draw it (mouse or finger).
        </p>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <TypeCard
            icon={MoveHorizontal}
            glyph="─"
            n={3}
            color="#2DD4BF"
            title="Row"
            desc="Drag left/right to make a sideways row of that many cells."
            box={{ w: 3, h: 1, clueX: 1, clueY: 0 }}
            grid={{ cols: 3, rows: 1 }}
          />
          <TypeCard
            icon={MoveVertical}
            glyph="│"
            n={3}
            color="#F59E0B"
            title="Column"
            desc="Drag up/down to make an upright column of that many cells."
            box={{ w: 1, h: 3, clueX: 0, clueY: 1 }}
            grid={{ cols: 1, rows: 3 }}
          />
          <TypeCard
            icon={Plus}
            glyph="＋"
            n={4}
            color={TINT}
            title="Any shape"
            desc="Drag any direction to make any rectangle of that many cells."
            box={{ w: 2, h: 2, clueX: 0, clueY: 0 }}
            grid={{ cols: 2, rows: 2 }}
          />
        </div>

        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            A <span className="font-bold text-success">4</span> needs a box of 4 squares — its icon
            says whether that must be a row, a column, or any 2×2 / 1×4 shape.
          </li>
          <li>Boxes can’t overlap, and every square must end up inside a box.</li>
          <li>Tap a box you already drew to remove it and try again.</li>
        </ul>

        <p className="rounded-xl border border-k-border bg-surface/50 px-3 py-2">
          <span className="font-bold text-turmeric">Star tip:</span> tile the whole grid with{' '}
          <span className="font-bold">no hints and no wrong boxes</span> to earn all 3 stars!
        </p>
      </HowToPlayModal>
    </>
  )
}

/**
 * TypeCard — one clue type explained: a tiny board showing the clue chip (its
 * number + orientation icon) inside a box of the right shape, plus a caption.
 */
function TypeCard({ icon: Icon, glyph, n, color, title, desc, box, grid }) {
  const cell = 26
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-k-border bg-surface/40 p-3 text-center">
      <div className="flex items-center gap-1.5 text-sm font-bold text-text-primary">
        <Icon size={16} style={{ color }} className="shrink-0" />
        <span>{title}</span>
        <span className="text-text-secondary" aria-hidden="true">{glyph}</span>
      </div>
      <div
        className="relative shrink-0 overflow-hidden rounded-lg border-2"
        style={{
          width: grid.cols * cell,
          height: grid.rows * cell,
          borderColor: `${color}88`,
          background: '#001621',
        }}
      >
        <div
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
            gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
          }}
        >
          {Array.from({ length: grid.cols * grid.rows }).map((_, i) => (
            <div key={i} className="border border-white/5" />
          ))}
        </div>
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: 0,
            top: 0,
            width: box.w * cell,
            height: box.h * cell,
            background: `${color}26`,
            border: `2px solid ${color}`,
            borderRadius: 6,
          }}
        >
          <span
            className="absolute flex items-center justify-center rounded font-game text-[11px] font-extrabold"
            style={{
              left: box.clueX * cell + 3,
              top: box.clueY * cell + 3,
              width: cell - 6,
              height: cell - 6,
              background: color,
              color: '#001621',
            }}
          >
            <Icon
              className="absolute"
              style={{ width: '60%', height: '60%', opacity: 0.28, color: '#001621' }}
              strokeWidth={3}
              aria-hidden="true"
            />
            <span className="relative">{n}</span>
          </span>
        </div>
      </div>
      <p className="text-xs leading-snug">{desc}</p>
    </div>
  )
}
