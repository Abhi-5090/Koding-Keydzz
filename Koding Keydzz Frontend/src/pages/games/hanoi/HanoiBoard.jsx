import { motion, useReducedMotion } from 'framer-motion'

/**
 * HanoiBoard — three vertical rods on a shared base. Each disk is a rounded
 * horizontal bar whose WIDTH scales with its size and whose color sits on the
 * Ember ramp (biggest = darkest, smallest = brightest). Tap a peg to pick up
 * its top disk (it lifts + glows); tap another peg to drop it.
 *
 * The board measures itself against its `.board-fit` wrapper using container-
 * query units (`cqi`), so it fills its column at any width without overflowing.
 * Disk moves animate via shared `layoutId`s (~200ms, GPU transforms).
 *
 * Props:
 *   state        [[...],[...],[...]] peg stacks, bottom -> top
 *   disks        total disk count (for width scaling)
 *   selectedPeg  peg index whose top disk is "lifted", or null
 *   goalPeg      target peg (subtle marker)
 *   shakeNonce   bumping this number replays an invalid-drop shake
 *   onPegTap(peg)
 *   tint
 */
export default function HanoiBoard({
  state,
  disks,
  selectedPeg,
  goalPeg,
  shakeNonce = 0,
  onPegTap,
  tint = '#FF8A4D',
}) {
  const reduce = useReducedMotion()

  // Rod/peg-area height grows with the disk count so a full tower always fits.
  // Everything is expressed in cqi so it scales with the board's own width.
  const diskH = 'clamp(13px, 4.2cqi, 26px)'
  const towerH = `calc(${diskH} * ${disks} + 10px)`

  return (
    <div className="board-fit mx-auto w-full">
      <motion.div
        key={shakeNonce}
        animate={
          shakeNonce > 0 && !reduce ? { x: [0, -8, 8, -6, 6, -2, 0] } : { x: 0 }
        }
        transition={{ duration: 0.36, ease: 'easeInOut' }}
        className="relative w-full rounded-2xl bg-malt px-2 pt-3"
        style={{ '--disk-h': diskH }}
      >
        <div className="flex items-end justify-between gap-1.5 sm:gap-3">
          {[0, 1, 2].map((peg) => (
            <Peg
              key={peg}
              peg={peg}
              stack={state[peg]}
              disks={disks}
              towerH={towerH}
              lifted={selectedPeg === peg}
              isGoal={goalPeg === peg}
              hasPickup={selectedPeg != null}
              reduce={reduce}
              onTap={() => onPegTap(peg)}
              tint={tint}
            />
          ))}
        </div>
        {/* Shared base beneath the three rods. */}
        <div
          className="mt-0 h-2.5 w-full rounded-b-2xl rounded-t-sm"
          style={{ background: `linear-gradient(180deg, ${tint}cc, ${tint}66)` }}
        />
      </motion.div>
    </div>
  )
}

function Peg({
  peg,
  stack,
  disks,
  towerH,
  lifted,
  isGoal,
  hasPickup,
  reduce,
  onTap,
  tint,
}) {
  const topIndex = stack.length - 1
  const label = ['left', 'middle', 'right'][peg]

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`${label} peg, ${stack.length} disk${stack.length === 1 ? '' : 's'}${
        isGoal ? ', goal peg' : ''
      }${lifted ? ', top disk picked up' : ''}`}
      className="group relative flex flex-1 flex-col items-center justify-end rounded-xl px-0.5 pb-0 pt-1 transition-colors duration-150 can-hover:hover:bg-white/5 focus-visible:z-10"
      style={{ cursor: 'pointer' }}
    >
      {/* Rod + stacked disks live in a fixed-height zone so pegs line up. */}
      <div
        className="relative flex w-full flex-col-reverse items-center justify-start"
        style={{ height: towerH }}
      >
        {/* The vertical rod behind the disks. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: 'clamp(5px, 1.4cqi, 9px)',
            height: '100%',
            background: isGoal
              ? `linear-gradient(180deg, ${tint}, ${tint}55)`
              : 'linear-gradient(180deg, #0A2E3C, #04212E)',
            boxShadow: isGoal ? `0 0 12px ${tint}66` : 'none',
          }}
        />

        {stack.map((size, i) => {
          const isTop = i === topIndex
          const isLifted = lifted && isTop
          return (
            <Disk
              key={size}
              size={size}
              disks={disks}
              isLifted={isLifted}
              reduce={reduce}
              tint={tint}
            />
          )
        })}
      </div>

      {/* Goal flag / peg letter under each rod. */}
      <span
        className={`game-text mt-1.5 mb-1 text-[11px] font-bold uppercase tracking-wide ${
          isGoal ? '' : 'text-text-secondary'
        }`}
        style={isGoal ? { color: tint } : undefined}
      >
        {isGoal ? 'Goal' : label}
      </span>

      {/* Pickup hint ring when a disk is in-hand and this peg is a valid-looking drop target visual. */}
      {hasPickup && !lifted && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 top-1 rounded-xl border border-dashed"
          style={{ height: 'var(--disk-h)', borderColor: `${tint}55` }}
        />
      )}
    </button>
  )
}

/** Ember ramp: smallest disk brightest, largest darkest. */
function diskColor(size, disks) {
  const t = disks <= 1 ? 0 : (size - 1) / (disks - 1) // 0 = small/bright, 1 = big/dark
  const bright = [255, 194, 138] // #FFC28A
  const dark = [138, 46, 20] // #8A2E14
  const ch = (i) => Math.round(bright[i] + (dark[i] - bright[i]) * t)
  const base = `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`
  const edge = `rgba(${ch(0)}, ${ch(1)}, ${ch(2)}, 0.55)`
  return { base, edge }
}

function Disk({ size, disks, isLifted, reduce, tint }) {
  const { base, edge } = diskColor(size, disks)
  // Width scales with size, resolved against the board's own width via cqi and
  // clamped so it neither vanishes on phones nor sprawls on ultrawide screens.
  const frac = (0.34 + 0.62 * (size / disks)).toFixed(3)
  const width = `clamp(26px, calc(${frac} * 30cqi), 190px)`

  return (
    <motion.div
      layoutId={`hanoi-disk-${size}`}
      layout={!reduce}
      transition={
        reduce
          ? { duration: 0 }
          : { layout: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }
      }
      animate={{
        scale: isLifted ? 1.04 : 1,
        boxShadow: isLifted
          ? `0 0 0 2px ${tint}, 0 0 16px ${tint}aa`
          : '0 1px 2px rgba(0,0,0,0.35)',
      }}
      className="relative z-[1] flex items-center justify-center rounded-full"
      style={{
        width,
        height: 'var(--disk-h)',
        marginBottom: '2px',
        background: `linear-gradient(180deg, ${base}, ${edge})`,
        border: `1px solid ${edge}`,
      }}
    >
      <span className="game-text text-[10px] font-bold leading-none text-malt/80">
        {size}
      </span>
    </motion.div>
  )
}
