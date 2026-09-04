import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  X,
  Sparkles,
  ArrowRight,
  BookOpen,
  ListChecks,
  PartyPopper,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Hourglass,
} from 'lucide-react'
import CodeReveal from './CodeReveal'
import TryItEditor from './TryItEditor'
import Confetti from '../ui/Confetti'

const EASE_OUT = [0.23, 1, 0.32, 1]

/**
 * TopicLessonModal — the flagship interactive lesson panel.
 *
 * Opening animation:
 *   • The clicked topic card and this panel share the same Framer Motion
 *     `layoutId`, so the panel visually flies out FROM the card's position and
 *     expands to a large centered sheet (shared-element transition).
 *   • An inner wrapper adds a 3D `rotateY` flip (preserve-3d / backface-hidden)
 *     so the card feels like it flips over to reveal the lesson on its "back".
 *   • Under prefers-reduced-motion both are replaced by a plain fade/scale.
 *
 * Closing (X / Esc / backdrop) reverses the layout morph back onto the card.
 *
 * Content (scrollable, max-h 90vh): hero → intro → sections → animated code
 * snippet (CodeReveal) → embedded editor (TryItEditor) → a progressively
 * revealed "Complete Learning Guide" ending in takeaways + a celebratory
 * "Got it!" close.
 *
 * Props:
 *   slug, topic       identify the lesson
 *   tint              world accent colour
 *   lesson            the DB lesson object `{ title, ...body }` (null when the
 *                     API has none for this topic → graceful empty state)
 *   loading           lessons query still in flight → show a spinner
 *   error             lessons query failed → surface a light error note
 *   alreadyComplete   was this session already done? (derived from the API)
 *   layoutId          shared-element id matching the originating card
 *   onComplete(topic) fired on "Got it!" — parent reports completion to backend
 *   onClose()         close handler (parent unmounts via AnimatePresence)
 */
export default function TopicLessonModal({
  slug,
  topic,
  tint = '#FF602F',
  lesson,
  loading = false,
  error = false,
  alreadyComplete = false,
  layoutId,
  onComplete,
  onClose,
}) {
  const reduce = useReducedMotion()
  const [guideStep, setGuideStep] = useState(1)
  const [celebrate, setCelebrate] = useState(false)

  // API-only content: no hardcoded fallback. When the lesson is missing we show
  // a graceful "being prepared" state; while loading we show a spinner.
  const data = lesson
  const hasLesson = !!data
  const title = data?.title || topic
  const guide = data?.guide || []
  const guideComplete = guideStep >= guide.length

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const handleGotIt = () => {
    // Finishing the guide via "Got it!" completes the session: notify the
    // parent (which persists + flips the card's status tag) then celebrate.
    if (onComplete) onComplete(topic)
    setCelebrate(true)
    window.setTimeout(onClose, reduce ? 0 : 1300)
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-6"
      style={{ perspective: 1400 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Lesson: ${title}`}
    >
      {/* backdrop */}
      <motion.div
        className="fixed inset-0 bg-malt/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        aria-hidden
      />

      {celebrate && <Confetti pieces={80} tint={tint} />}

      {/* Panel — shared-element morph from the originating card. */}
      <motion.div
        layoutId={layoutId}
        onClick={(e) => e.stopPropagation()}
        transition={{ duration: 0.45, ease: EASE_OUT }}
        className="relative z-10 my-auto w-full max-w-3xl"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Inner flip wrapper: rotateY reveal (calmed under reduced-motion). */}
        <motion.div
          initial={reduce ? { opacity: 0, scale: 0.96 } : { rotateY: -90, opacity: 0 }}
          animate={reduce ? { opacity: 1, scale: 1 } : { rotateY: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0, scale: 0.96 } : { rotateY: 90, opacity: 0 }}
          transition={{ duration: reduce ? 0.25 : 0.5, ease: EASE_OUT, delay: reduce ? 0 : 0.08 }}
          style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden', '--tint': tint, borderColor: `${tint}55` }}
          className="tint-scope flex max-h-[92vh] flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl"
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{ boxShadow: `inset 0 0 0 1px ${tint}55, 0 0 60px ${tint}33` }}
            aria-hidden
          />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close lesson"
            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-k-border bg-malt/70 text-text-secondary backdrop-blur transition-colors duration-200 can-hover:hover:[color:var(--tint)]"
          >
            <X size={18} />
          </button>

          {/* Scrollable content */}
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            {/* HERO */}
            <div
              className="relative overflow-hidden px-6 pb-6 pt-8 sm:px-8"
              style={{ background: `linear-gradient(160deg, ${tint}22, transparent 70%)` }}
            >
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: `${tint}22`, color: tint, border: `1.5px solid ${tint}` }}>
                <GraduationCap size={26} />
              </div>
              <h2 className="font-heading text-3xl font-extrabold sm:text-4xl capitalize" style={{ color: tint }}>
                {title}
              </h2>
              {data?.tagline && (
                <p className="game-text mt-1 text-base text-text-primary/90">{data.tagline}</p>
              )}
              {alreadyComplete && (
                <span
                  className="game-text mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold"
                  style={{ borderColor: `${tint}66`, background: `${tint}18`, color: tint }}
                >
                  <CheckCircle2 size={13} />
                  Session Completed
                </span>
              )}
              <div className="mt-4 h-1 w-24 rounded-full" style={{ background: tint }} />
            </div>

            {loading ? (
              /* LOADING — lessons query still in flight. */
              <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
                <Loader2 size={40} className="animate-spin" style={{ color: tint }} />
                <p className="game-text text-sm text-text-secondary">Opening this lesson…</p>
              </div>
            ) : !hasLesson ? (
              /* EMPTY — no authored lesson exists for this topic yet. */
              <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: `${tint}18`, color: tint, border: `1.5px solid ${tint}55` }}
                >
                  <Hourglass size={30} />
                </div>
                <h3 className="game-text text-lg font-bold text-text-primary">This lesson is being prepared</h3>
                <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
                  {error
                    ? 'We could not load this lesson right now. Please close and try again in a moment.'
                    : 'Our mentors are still crafting this session. Explore the other topics and check back soon!'}
                </p>
              </div>
            ) : (
            <div className="space-y-8 px-6 pb-8 sm:px-8">
              {/* INTRO */}
              {data.intro && (
                <p className="text-[15px] leading-relaxed text-text-primary/90">{data.intro}</p>
              )}

              {/* SECTIONS */}
              {data.sections && data.sections.length > 0 && (
                <div className="space-y-6">
                  {data.sections.map((sec, i) => (
                    <section key={i}>
                      <h3 className="game-text mb-2 flex items-center gap-2 text-lg font-bold text-text-primary">
                        <BookOpen size={17} style={{ color: tint }} />
                        {sec.heading}
                      </h3>
                      <p className="text-sm leading-relaxed text-text-secondary">{sec.body}</p>
                      {sec.bullets && sec.bullets.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {sec.bullets.map((b, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-text-primary/85">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tint }} />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ))}
                </div>
              )}

              {/* CODE SNIPPET */}
              {data.snippet && data.snippet.lines && (
                <div>
                  <h3 className="game-text mb-3 flex items-center gap-2 text-lg font-bold text-text-primary">
                    <Sparkles size={17} style={{ color: tint }} />
                    See it in code
                  </h3>
                  <CodeReveal
                    lines={data.snippet.lines}
                    caption={data.snippet.caption}
                    language={data.snippet.language || 'python'}
                    tint={tint}
                  />
                </div>
              )}

              {/* TRY IT */}
              {data.tryIt && (
                <TryItEditor
                  starter={data.tryIt.starter}
                  language={data.tryIt.language || (data.snippet && data.snippet.language) || 'python'}
                  challenge={data.tryIt.challenge}
                  hint={data.tryIt.hint}
                  tint={tint}
                />
              )}

              {/* COMPLETE LEARNING GUIDE (progressive) */}
              {guide.length > 0 && (
                <div className="rounded-2xl border border-k-border bg-surface/30 p-5" style={{ borderColor: `${tint}40` }}>
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <h3 className="game-text flex min-w-0 items-center gap-2 text-lg font-bold text-text-primary">
                      <ListChecks size={18} className="shrink-0" style={{ color: tint }} />
                      Complete Learning Guide
                    </h3>

                    {/* Glowing prompt (top-right): read the whole guide to finish
                        the session. Steady glow always; gentle pulse unless the
                        user prefers reduced motion (handled in index.css). Hidden
                        once the guide is complete — the "Got it!" button takes over. */}
                    {!guideComplete && (
                      <span
                        className={`game-text session-glow shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${reduce ? '' : 'session-glow-pulse'}`}
                        style={{ '--glow-color': `${tint}99`, borderColor: tint, color: tint, background: `${tint}14` }}
                      >
                        Read the full guide to complete this session — tap Continue
                        <ArrowRight size={12} className="shrink-0" />
                      </span>
                    )}
                  </div>

                  <ol className="space-y-3">
                    {guide.slice(0, guideStep).map((g, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: EASE_OUT }}
                        className="flex items-start gap-3"
                      >
                        <span
                          className="game-text mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                          style={{ background: tint, color: '#001621' }}
                        >
                          {i + 1}
                        </span>
                        <div>
                          <p className="game-text font-bold text-text-primary">{g.step}</p>
                          <p className="text-sm text-text-secondary">{g.body}</p>
                        </div>
                      </motion.li>
                    ))}
                  </ol>

                  {!guideComplete && (
                    <button
                      type="button"
                      onClick={() => setGuideStep((s) => Math.min(s + 1, guide.length))}
                      className="game-text mt-4 inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-bold transition-colors duration-200"
                      style={{ borderColor: tint, color: tint }}
                    >
                      Continue
                      <ArrowRight size={16} />
                    </button>
                  )}

                  {/* TAKEAWAYS + celebrate, revealed once the guide is complete */}
                  {guideComplete && data.takeaways && data.takeaways.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: EASE_OUT }}
                      className="mt-5 border-t border-k-border pt-5"
                    >
                      <h4 className="game-text mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: tint }}>
                        <CheckCircle2 size={16} />
                        Key takeaways
                      </h4>
                      <ul className="space-y-2">
                        {data.takeaways.map((t, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-text-primary/90">
                            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        onClick={handleGotIt}
                        className="game-text mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-bold text-malt transition-[box-shadow] duration-200"
                        style={{ background: tint, boxShadow: `0 0 24px ${tint}80` }}
                      >
                        <PartyPopper size={18} />
                        Got it!
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
