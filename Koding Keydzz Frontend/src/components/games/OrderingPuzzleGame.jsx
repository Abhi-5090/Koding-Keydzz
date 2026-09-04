import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Reorder, motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  GripVertical,
  Check,
  Shuffle,
  AlertTriangle,
  ListChecks,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LevelWinOverlay from './LevelWinOverlay'

/**
 * OrderingPuzzleGame — reusable "arrange the steps in the correct order" engine.
 *
 * Props:
 *   game      { title, icon?, tint? }
 *   level     { id, name, difficulty, intro, steps:[strings in CORRECT order], theme? }
 *   onExit()                      back to level select
 *   onComplete(stars) -> Promise<awardResult|undefined>   persist + return award
 *   hasNext   boolean
 *   onNext()  advance to the next level
 *
 * Steps render SHUFFLED; the player reorders them, then Checks. On a wrong
 * submit, out-of-place rows flash error styling.
 * Stars: 3 = correct on the first submit, 2 = correct within 3 submits,
 *        1 = eventually correct.
 *
 * THREE WAYS TO REORDER — this used to be drag-only, which made every level
 * unplayable for a pupil without a mouse (and awkward on a tablet):
 *   1. drag the row (framer-motion Reorder);
 *   2. the explicit up/down buttons on each row — also the easiest target on
 *      a touchscreen, and self-explanatory in a way a drag handle is not;
 *   3. the keyboard: Tab to a row, then ArrowUp/ArrowDown to move it,
 *      Home/End to send it to the top/bottom.
 *
 * A roving tabindex keeps the whole list to ONE tab stop, and an aria-live
 * region announces each move so a screen-reader user can follow what changed.
 */
export default function OrderingPuzzleGame({ game, level, onExit, onComplete, hasNext, onNext }) {
  const tint = game.tint || '#FF602F'
  const correct = level.steps || []

  // Internal items carry a stable id (= correct index) for keys + checking.
  const buildItems = useCallback(
    () => shuffle(correct.map((text, i) => ({ id: i, text }))),
    [correct]
  )

  const [items, setItems] = useState(buildItems)
  const [attempts, setAttempts] = useState(0)
  const [checked, setChecked] = useState(false) // showing error highlights

  // Keyboard/button reordering state: which row is active, and the last move
  // announced to assistive technology.
  const [activeIndex, setActiveIndex] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const rowRefs = useRef(new Map())

  const [finished, setFinished] = useState(false)
  const [stars, setStars] = useState(0)
  const [reward, setReward] = useState(null)
  const [alreadyMastered, setAlreadyMastered] = useState(false)
  const [awarding, setAwarding] = useState(false)

  // Reset when the level changes.
  useEffect(() => {
    setItems(buildItems())
    setAttempts(0)
    setChecked(false)
    setFinished(false)
    setStars(0)
    setReward(null)
    setAlreadyMastered(false)
    setAwarding(false)
    setActiveIndex(0)
    setAnnouncement('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id])

  const isOrdered = useMemo(() => items.every((it, i) => it.id === i), [items])

  /**
   * Move the row at `from` to `to`, keeping focus on the row that moved so a
   * keyboard user can press ArrowDown repeatedly without re-finding it.
   */
  const moveItem = useCallback(
    (from, to) => {
      if (finished) return
      if (to < 0 || to >= items.length || from === to) return

      setItems((prev) => {
        const next = [...prev]
        const [row] = next.splice(from, 1)
        next.splice(to, 0, row)
        setAnnouncement(`${row.text}, moved to position ${to + 1} of ${next.length}`)
        return next
      })
      setChecked(false)
      setActiveIndex(to)

      // Follow the row with focus after React commits the new order.
      requestAnimationFrame(() => {
        rowRefs.current.get(to)?.focus?.()
      })
    },
    [finished, items.length]
  )

  const onRowKeyDown = useCallback(
    (e, index) => {
      let handled = true
      switch (e.key) {
        case 'ArrowUp':
          moveItem(index, index - 1)
          break
        case 'ArrowDown':
          moveItem(index, index + 1)
          break
        case 'Home':
          moveItem(index, 0)
          break
        case 'End':
          moveItem(index, items.length - 1)
          break
        default:
          handled = false
      }
      if (handled) {
        // Stop the page scrolling under the list on every arrow press.
        e.preventDefault()
        e.stopPropagation()
      }
    },
    [moveItem, items.length]
  )

  const reset = useCallback(() => {
    setItems(buildItems())
    setAttempts(0)
    setChecked(false)
    setFinished(false)
    setStars(0)
    setReward(null)
    setAlreadyMastered(false)
    setAwarding(false)
  }, [buildItems])

  const finish = useCallback(
    async (submitCount) => {
      // Shown at once; the server regrades from `mistakes` and wins.
      const earned = submitCount === 1 ? 3 : submitCount <= 3 ? 2 : 1
      setStars(earned)
      setFinished(true)
      setAwarding(true)
      // A "mistake" here is a rejected submission — the first Check is free.
      const res = await onComplete?.(earned, {
        hintsUsed: 0,
        mistakes: Math.max(0, submitCount - 1),
      })
      const awarded = res?.awarded || { xp: 0, coins: 0 }
      if (res?.alreadyCompleted || (!awarded.xp && !awarded.coins)) {
        setAlreadyMastered(!!res?.alreadyCompleted)
        setReward(null)
      } else {
        setReward({ xp: awarded.xp || 0, coins: awarded.coins || 0 })
      }
      setAwarding(false)
    },
    [onComplete]
  )

  const check = () => {
    if (finished) return
    const next = attempts + 1
    setAttempts(next)
    if (isOrdered) {
      setChecked(false)
      finish(next)
    } else {
      setChecked(true)
    }
  }

  const Icon = game.icon

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
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
          <div className="game-text truncate text-lg font-extrabold text-turmeric">{level.name}</div>
        </div>
      </div>

      <Card hover={false}>
        <h3 className="game-text mb-1 flex items-center gap-2 font-bold" style={{ color: tint }}>
          {Icon ? <Icon size={18} /> : <ListChecks size={18} />} {level.theme || 'Arrange the steps'}
        </h3>
        {level.intro && (
          <p className="game-text mb-4 text-sm text-text-secondary">{level.intro}</p>
        )}

        {/* How to reorder — stated plainly, because a bare drag handle tells a
            child nothing about the keyboard or button options. */}
        <p className="game-text mb-2 text-xs text-text-secondary/70">
          Drag a step, use the ▲ ▼ buttons, or focus a step and press the arrow keys.
        </p>

        <Reorder.Group
          axis="y"
          values={items}
          onReorder={(next) => {
            setItems(next)
            setChecked(false)
          }}
          className="space-y-2.5"
          role="list"
          aria-label="Mission steps — reorder them"
        >
          {items.map((step, i) => {
            const outOfPlace = checked && step.id !== i
            const isActive = i === activeIndex
            return (
              <Reorder.Item
                key={step.id}
                value={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileDrag={{ scale: 1.02, boxShadow: '0 0 20px rgba(255,96,47,0.4)' }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                /* Roving tabindex: the list is ONE tab stop, then arrow keys
                   move the focused step. Tabbing through every row would be
                   unusable on a long list. */
                ref={(el) => {
                  if (el) rowRefs.current.set(i, el)
                  else rowRefs.current.delete(i)
                }}
                tabIndex={isActive ? 0 : -1}
                onFocus={() => setActiveIndex(i)}
                onKeyDown={(e) => onRowKeyDown(e, i)}
                aria-label={`Step ${i + 1} of ${items.length}: ${step.text}. Use the arrow keys to move it.`}
                className={`game-text flex cursor-grab select-none items-center gap-3 rounded-xl border-2 px-4 py-3 outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-turmeric ${
                  outOfPlace
                    ? 'border-error bg-error/10 text-error'
                    : 'border-k-border bg-surface/50 text-text-primary can-hover:hover:border-turmeric'
                }`}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-malt text-sm font-bold tabular-nums"
                  style={{ color: tint }}
                >
                  {i + 1}
                </span>
                <span className="flex-1">{step.text}</span>

                {/* Explicit controls. These are the easiest target on a
                    touchscreen and the only obvious affordance for a pupil who
                    does not think to try dragging. */}
                <span className="flex shrink-0 flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveItem(i, i - 1)}
                    disabled={i === 0 || finished}
                    aria-label={`Move "${step.text}" up`}
                    className="rounded-md border border-k-border bg-malt/60 px-1 py-0.5 text-text-secondary transition-colors disabled:opacity-30 can-hover:hover:text-turmeric focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
                  >
                    <ChevronUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(i, i + 1)}
                    disabled={i === items.length - 1 || finished}
                    aria-label={`Move "${step.text}" down`}
                    className="rounded-md border border-k-border bg-malt/60 px-1 py-0.5 text-text-secondary transition-colors disabled:opacity-30 can-hover:hover:text-turmeric focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
                  >
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                </span>

                <GripVertical size={18} className="shrink-0 text-text-secondary/70" aria-hidden="true" />
              </Reorder.Item>
            )
          })}
        </Reorder.Group>

        {/* Announces each move so a screen-reader user can follow the reorder. */}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        <div className="mt-4 flex gap-2">
          <Button onClick={check} disabled={finished} className="flex-1 inline-flex items-center justify-center gap-1.5">
            <Check size={17} /> Check Order
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setItems(buildItems())
              setChecked(false)
            }}
            disabled={finished}
            className="inline-flex items-center gap-1.5"
          >
            <Shuffle size={15} /> Shuffle
          </Button>
        </div>

        <AnimatePresence>
          {checked && !isOrdered && !finished && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="game-text mt-3 flex items-start gap-2 rounded-xl border border-error/50 bg-error/15 px-3 py-2.5 text-sm text-error"
            >
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              Not quite — the red steps are out of place. Reorder and check again.
            </motion.p>
          )}
        </AnimatePresence>
      </Card>

      <AnimatePresence>
        {finished && (
          <LevelWinOverlay
            confettiKey={`order-${level.id}`}
            stars={stars}
            message={messageForStars(stars)}
            reward={reward}
            alreadyMastered={alreadyMastered}
            awarding={awarding}
            hasNext={hasNext}
            onNext={onNext}
            onReplay={reset}
            onLevels={onExit}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/** Fisher–Yates; guarantees the result is not already in correct order. */
function shuffle(items) {
  if (items.length <= 1) return [...items]
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  if (a.every((it, i) => it.id === i)) return shuffle(items)
  return a
}

function messageForStars(stars) {
  if (stars === 3) return 'Perfect order on the first try — mission accomplished!'
  if (stars === 2) return 'Sequence locked in! A retry or two, but you nailed it.'
  return 'Order restored! Replay to ace it in one go.'
}
