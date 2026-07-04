import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, AlertTriangle, Code2 } from 'lucide-react'

const DIR_ICON = { up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight }

/**
 * CompiledSequence — shows the live-compiled move sequence as arrow chips.
 *
 * When `error` is set, shows the friendly line + message instead. During a run,
 * `activeIndex` highlights the arrow for the step the robot is taking so the kid
 * sees code -> sequence -> movement.
 *
 * Props:
 *   dirs        ['up','right',...]  (the flattened compiled program)
 *   error       { line, message } | null
 *   blockCount  number  (program blocks, loops count as 1 + body)
 *   activeIndex number  (-1 when idle)
 */
export default function CompiledSequence({ dirs, error, blockCount, activeIndex = -1 }) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="game-text inline-flex items-center gap-1.5 text-sm text-text-secondary">
          <Code2 size={15} className="text-turmeric" /> Your Program
        </span>
        {!error && (
          <span className="game-text flex items-center gap-2">
            <Chip>{blockCount} {blockCount === 1 ? 'block' : 'blocks'}</Chip>
            <Chip>{dirs.length} {dirs.length === 1 ? 'step' : 'steps'}</Chip>
          </span>
        )}
      </div>

      <div className="min-h-[64px] rounded-xl border border-dashed border-k-border bg-malt/60 p-2.5">
        {error ? (
          <p
            role="alert"
            className="game-text flex items-start gap-2 rounded-lg border border-error/50 bg-error/15 px-3 py-2 text-sm text-error"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong className="font-bold">Line {error.line}:</strong> {error.message}
            </span>
          </p>
        ) : dirs.length === 0 ? (
          <p className="game-text px-1 py-3 text-center text-sm text-text-secondary">
            Write some commands — your moves will show up here as you type.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <AnimatePresence initial={false}>
              {dirs.map((dir, i) => {
                const Icon = DIR_ICON[dir]
                const active = i === activeIndex
                return (
                  <motion.span
                    key={`${i}-${dir}`}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: active ? 1.18 : 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 480, damping: 26 }}
                    aria-label={dir}
                    className={[
                      'inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-semibold transition-colors',
                      active
                        ? 'bg-turmeric text-malt shadow-golden-glow'
                        : 'bg-turmeric/15 text-turmeric',
                    ].join(' ')}
                  >
                    <Icon size={16} strokeWidth={2.6} />
                  </motion.span>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ children }) {
  return (
    <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold text-turmeric">
      {children}
    </span>
  )
}
