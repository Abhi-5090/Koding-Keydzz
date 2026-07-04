import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Loader2, RotateCcw, Lightbulb, Target, Terminal, CheckCircle2 } from 'lucide-react'
import { runCode, isPythonReady } from '../../features/playground/runners'

/**
 * TryItEditor — a lightweight embedded code sandbox for a lesson. A styled
 * monospace <textarea> (deliberately NOT Monaco to keep the modal light),
 * prefilled with the lesson's starter code, plus a Run button that executes via
 * the shared client-side runners (Python → Pyodide, JS → Worker). Output is
 * shown in a terminal-style panel: stdout in success green, stderr in error
 * red. Includes Reset, the challenge prompt, and a reveal-able hint. When the
 * starter uses input(), a small "Program input" box lets the student feed
 * answers (one per line) to the program.
 *
 * Props:
 *   starter:    string   initial code
 *   language?:  'python' | 'javascript'  (default python)
 *   challenge?: string   the task shown above the editor
 *   hint?:      string   revealed on demand
 *   tint?:      string   world accent for headings/buttons
 */
export default function TryItEditor({
  starter = '',
  language = 'python',
  challenge,
  hint,
  tint = '#FF602F',
}) {
  const [code, setCode] = useState(starter)
  const [stdin, setStdin] = useState('')
  const [stdout, setStdout] = useState('')
  const [stderr, setStderr] = useState('')
  const [ran, setRan] = useState(false)
  const [running, setRunning] = useState(false)
  const [loadingPython, setLoadingPython] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const textareaRef = useRef(null)

  const needsStdin = language === 'python' && /input\s*\(/.test(code)

  const handleRun = async () => {
    setRunning(true)
    setRan(false)
    setStdout('')
    setStderr('')
    const needsPythonLoad = language === 'python' && !isPythonReady()
    if (needsPythonLoad) setLoadingPython(true)
    try {
      const result = await runCode({ language, code, stdin })
      setStdout((result.stdout ?? '').toString())
      setStderr((result.stderr ?? '').toString())
      setRan(true)
    } catch (err) {
      setRan(true)
      setStderr(
        err?.name === 'PyodideLoadError'
          ? "Couldn't load the Python engine — check your connection and try again."
          : err?.message || 'Could not run your code. Please try again.'
      )
    } finally {
      setRunning(false)
      setLoadingPython(false)
    }
  }

  const handleReset = () => {
    setCode(starter)
    setStdin('')
    setStdout('')
    setStderr('')
    setRan(false)
  }

  // Insert spaces on Tab so kids don't lose focus while indenting.
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = textareaRef.current
      const start = el.selectionStart
      const end = el.selectionEnd
      const next = code.slice(0, start) + '    ' + code.slice(end)
      setCode(next)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 4
      })
    }
  }

  const cleanOutput = ran && !stderr && stdout.trim() === ''
  const success = ran && !stderr && stdout.trim().length > 0

  return (
    <div className="tint-scope rounded-2xl border border-k-border bg-surface/40 p-4 sm:p-5" style={{ '--tint': tint, borderColor: `${tint}40` }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${tint}22`, color: tint }}>
          <Target size={16} />
        </span>
        <div>
          <h4 className="game-text text-sm font-bold" style={{ color: tint }}>
            Try it yourself
          </h4>
          {challenge && <p className="text-xs text-text-secondary">{challenge}</p>}
        </div>
      </div>

      {/* Editor */}
      <div className="overflow-hidden rounded-xl border border-k-border bg-malt/80">
        <div className="flex items-center justify-between border-b border-k-border px-3 py-1.5">
          <span className="game-text text-xs text-text-secondary">
            main.{language === 'python' ? 'py' : 'js'}
          </span>
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-error/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={code}
          spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={Math.min(Math.max(code.split('\n').length, 4), 16)}
          className="scrollbar-thin block w-full resize-y bg-transparent p-3 font-mono text-[13px] leading-relaxed text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
          aria-label="Code editor"
        />
      </div>

      {/* Optional program input for input()-driven code */}
      {needsStdin && (
        <div className="mt-3">
          <label className="game-text mb-1 block text-xs text-text-secondary">
            Program input (one answer per line)
          </label>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={2}
            placeholder="Type what the player would answer here…"
            className="scrollbar-thin block w-full resize-y rounded-lg border border-k-border bg-malt/60 p-2 font-mono text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
          />
        </div>
      )}

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="game-text inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-malt transition-[opacity,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: tint, boxShadow: `0 0 24px ${tint}80` }}
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {loadingPython ? 'Loading Python…' : running ? 'Running…' : 'Run'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="game-text inline-flex items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors duration-200 can-hover:hover:[color:var(--tint)]"
        >
          <RotateCcw size={15} />
          Reset
        </button>
        {hint && (
          <button
            type="button"
            onClick={() => setShowHint((s) => !s)}
            className="game-text ml-auto inline-flex items-center gap-1.5 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors duration-200 can-hover:hover:text-accent"
          >
            <Lightbulb size={15} />
            {showHint ? 'Hide hint' : 'Hint'}
          </button>
        )}
      </div>

      {/* Hint */}
      <AnimatePresence initial={false}>
        {showHint && hint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm text-text-primary/90">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" />
              <span>{hint}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Output */}
      <div className="mt-3 overflow-hidden rounded-xl border border-k-border bg-malt/80">
        <div className="flex items-center justify-between border-b border-k-border px-3 py-1.5">
          <span className="game-text flex items-center gap-1.5 text-xs text-text-secondary">
            <Terminal size={14} />
            Output
          </span>
          {success && (
            <span className="game-text inline-flex items-center gap-1 text-xs text-success">
              <CheckCircle2 size={13} />
              Ran cleanly
            </span>
          )}
        </div>
        <div className="scrollbar-thin max-h-40 min-h-[3rem] overflow-auto p-3 font-mono text-[13px]">
          {!ran && !running && (
            <p className="text-text-secondary/60">Press Run to see your output here.</p>
          )}
          {loadingPython && (
            <p className="flex items-center gap-1.5" style={{ color: tint }}>
              <Loader2 size={13} className="animate-spin" />
              Loading Python… (first run downloads the engine)
            </p>
          )}
          {running && !loadingPython && <p style={{ color: tint }}>Running in the browser…</p>}
          {!running && stdout && (
            <pre className="whitespace-pre-wrap text-success">{stdout}</pre>
          )}
          {!running && cleanOutput && (
            <p className="text-text-secondary">Program ran successfully (no output).</p>
          )}
          {!running && stderr && (
            <pre className="mt-1 whitespace-pre-wrap text-error">{stderr}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
