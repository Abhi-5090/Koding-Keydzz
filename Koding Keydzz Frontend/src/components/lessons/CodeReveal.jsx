import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { RotateCcw, Terminal } from 'lucide-react'

/**
 * CodeReveal — renders a code snippet with a "code generating" typewriter
 * effect: characters stream in line-by-line, a blinking cursor trailing the
 * output, syntax tinted in the Ember palette. A caption sits underneath and a
 * small Replay button re-runs the animation.
 *
 * Respects prefers-reduced-motion by showing the whole snippet instantly.
 *
 * Props:
 *   lines:    string[]  the code, one entry per line
 *   caption?: string    a short note shown under the block
 *   tint?:    string    world accent used for the header/cursor glow
 *   language?:string    label shown in the little window chrome (default python)
 */

// Ember-tinted token colours.
const C = {
  comment: '#7F9AA8',
  string: '#34D399',
  number: '#FFB37A',
  keyword: '#FF6A3D',
  builtin: '#FF602F',
  bool: '#FF8A4D',
  base: '#E8F1F4',
}

const KEYWORDS = new Set([
  'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'and', 'or',
  'not', 'import', 'from', 'as', 'with', 'break', 'continue', 'pass', 'is', 'None',
])
const BUILTINS = new Set([
  'print', 'input', 'int', 'str', 'float', 'range', 'len', 'bool', 'list', 'type',
])
const BOOLS = new Set(['True', 'False'])

// Tokenise ONE line of (possibly partial) Python into tinted spans. Robust to
// half-typed lines: an unterminated string simply tints to the end.
function highlightLine(line, keyBase) {
  const nodes = []
  let i = 0
  let n = 0
  const push = (text, color, extra) => {
    nodes.push(
      <span key={`${keyBase}-${n++}`} style={{ color, ...extra }}>
        {text}
      </span>
    )
  }

  while (i < line.length) {
    const ch = line[i]

    // Comment runs to end of line.
    if (ch === '#') {
      push(line.slice(i), C.comment, { fontStyle: 'italic' })
      break
    }

    // String literal (single or double quote); tolerate no closing quote.
    if (ch === '"' || ch === "'") {
      const quote = ch
      let j = i + 1
      while (j < line.length && line[j] !== quote) j++
      const end = j < line.length ? j + 1 : line.length
      push(line.slice(i, end), C.string)
      i = end
      continue
    }

    // Number.
    if (/[0-9]/.test(ch)) {
      let j = i + 1
      while (j < line.length && /[0-9.]/.test(line[j])) j++
      push(line.slice(i, j), C.number)
      i = j
      continue
    }

    // Word (identifier / keyword).
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1
      while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++
      const word = line.slice(i, j)
      const color = KEYWORDS.has(word)
        ? C.keyword
        : BOOLS.has(word)
        ? C.bool
        : BUILTINS.has(word)
        ? C.builtin
        : C.base
      push(word, color, KEYWORDS.has(word) ? { fontWeight: 600 } : undefined)
      i = j
      continue
    }

    // Everything else (operators, spaces, brackets).
    let j = i + 1
    while (j < line.length && !/[#"'0-9A-Za-z_]/.test(line[j])) j++
    push(line.slice(i, j), C.base)
    i = j
  }

  return nodes
}

export default function CodeReveal({ lines = [], caption, tint = '#FF602F', language = 'python' }) {
  const reduce = useReducedMotion()
  const fullText = useMemo(() => lines.join('\n'), [lines])
  const [count, setCount] = useState(reduce ? fullText.length : 0)
  const [runKey, setRunKey] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    clearInterval(timerRef.current)
    if (reduce) {
      setCount(fullText.length)
      return
    }
    setCount(0)
    // Stream ~2 characters per tick for a lively but readable generation feel.
    timerRef.current = setInterval(() => {
      setCount((c) => {
        const next = c + 2
        if (next >= fullText.length) {
          clearInterval(timerRef.current)
          return fullText.length
        }
        return next
      })
    }, 18)
    return () => clearInterval(timerRef.current)
  }, [fullText, reduce, runKey])

  const done = count >= fullText.length
  const shown = fullText.slice(0, count)
  const shownLines = shown.split('\n')

  return (
    <div style={{ '--tint': tint }}>
      <div
        className="overflow-hidden rounded-2xl border bg-malt/80"
        style={{ boxShadow: `0 0 24px ${tint}22`, borderColor: `${tint}40` }}
      >
        {/* window chrome */}
        <div className="flex items-center justify-between border-b border-k-border px-4 py-2">
          <span className="game-text flex items-center gap-1.5 text-xs text-text-secondary">
            <Terminal size={14} style={{ color: tint }} />
            example.{language === 'python' ? 'py' : 'js'}
          </span>
          <button
            type="button"
            onClick={() => setRunKey((k) => k + 1)}
            className="game-text inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-secondary transition-colors duration-200 can-hover:hover:[color:var(--tint)]"
            aria-label="Replay the code animation"
          >
            <RotateCcw size={13} />
            Replay
          </button>
        </div>

        {/* code */}
        <pre
          className="scrollbar-thin overflow-x-auto p-4 font-mono text-[13px] leading-relaxed sm:text-sm"
          style={{ minHeight: `${Math.max(lines.length, 1) * 1.6 + 1}rem` }}
        >
          <code>
            {shownLines.map((line, idx) => {
              const isLast = idx === shownLines.length - 1
              return (
                <div key={idx} className="min-h-[1.4em] whitespace-pre">
                  {highlightLine(line, `l${idx}`)}
                  {!done && isLast && (
                    <span
                      className="ml-px inline-block w-[2px] animate-pulse align-middle"
                      style={{ background: tint, height: '1.05em', boxShadow: `0 0 8px ${tint}` }}
                      aria-hidden
                    />
                  )}
                </div>
              )
            })}
          </code>
        </pre>
      </div>

      {caption && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: done ? 1 : 0.5 }}
          transition={{ duration: 0.3 }}
          className="mt-2 flex items-start gap-1.5 px-1 text-xs italic text-text-secondary"
        >
          <span className="mt-1 h-3 w-0.5 shrink-0 rounded-full" style={{ background: tint }} aria-hidden />
          {caption}
        </motion.p>
      )}
    </div>
  )
}
