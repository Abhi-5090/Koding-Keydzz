// Python-subset parser for Maze Coding — pure, DOM-free, unit-tested.
//
// Compiles a tiny slice of real Python into the maze engine's program model:
//   move:   { type: 'move', dir: 'up'|'down'|'left'|'right' }
//   repeat: { type: 'repeat', times: N, body: [blocks] }
//
// Supported grammar (kid-friendly subset):
//   - movement calls:  up()  down()  left()  right()
//   - for loops:       for <name> in range(<positiveInt>):  then an INDENTED body
//   - nested loops (a for inside a for body)
//   - blank lines and `# comments` are ignored
//
// Indentation is significant: a `for` header opens a block; lines indented MORE
// than the header belong to its body; dedenting closes it. We accept 4-space or
// single-tab steps but require consistency within a block.
//
// On success:  { program: [...blocks], error: null }
// On failure:  { program: null, error: { line, message } }   (line is 1-based)
//
// IMPORTANT: error messages are friendly and NEVER reveal the maze solution.

export const DIRS = ['up', 'down', 'left', 'right']

// Cap the total expanded moves so a runaway `range()` can't hang the UI.
const MAX_EXPANDED_MOVES = 500

const MOVE_RE = /^(up|down|left|right)\s*\(\s*\)$/
const BARE_MOVE_RE = /^(up|down|left|right)$/
// for <identifier> in range(<int>):
const FOR_RE = /^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+range\s*\(\s*(-?\d+)\s*\)\s*:$/

/** Count leading-whitespace columns; tab counts as one indent unit (4 cols). */
function indentOf(rawLine) {
  let cols = 0
  let hasTab = false
  let hasSpace = false
  for (const ch of rawLine) {
    if (ch === ' ') {
      cols += 1
      hasSpace = true
    } else if (ch === '\t') {
      cols += 4
      hasTab = true
    } else break
  }
  return { cols, hasTab, hasSpace }
}

/** Strip a trailing `# comment` that isn't inside our (string-free) grammar. */
function stripComment(line) {
  const i = line.indexOf('#')
  return i === -1 ? line : line.slice(0, i)
}

/**
 * parseProgram(code) -> { program, error }
 */
export function parseProgram(code) {
  const srcLines = String(code ?? '').split('\n')

  // Pre-process into meaningful lines, keeping the original 1-based line number.
  const lines = []
  for (let i = 0; i < srcLines.length; i++) {
    const raw = srcLines[i]
    const noComment = stripComment(raw)
    const text = noComment.trim()
    if (text === '') continue // blank or comment-only line
    const { cols, hasTab, hasSpace } = indentOf(noComment)
    lines.push({ n: i + 1, indent: cols, text, hasTab, hasSpace })
  }

  if (lines.length === 0) {
    return { program: [], error: null }
  }

  // The first meaningful line must not be indented.
  if (lines[0].indent !== 0) {
    return {
      program: null,
      error: {
        line: lines[0].n,
        message: "This line is indented but nothing opened a block — remove the extra spaces.",
      },
    }
  }

  let pos = 0

  // Parse a block of statements that share `baseIndent`. Returns { blocks, error }.
  function parseBlock(baseIndent) {
    const blocks = []

    while (pos < lines.length) {
      const ln = lines[pos]

      if (ln.indent < baseIndent) break // dedent: this block is done
      if (ln.indent > baseIndent) {
        return {
          blocks: null,
          error: {
            line: ln.n,
            message: "This line is indented too far — line it up with the commands around it.",
          },
        }
      }

      // Mixed tabs + spaces in one line's indent is ambiguous.
      if (ln.hasTab && ln.hasSpace) {
        return {
          blocks: null,
          error: {
            line: ln.n,
            message: "Don't mix tabs and spaces for indentation — pick one (4 spaces is easiest).",
          },
        }
      }

      const move = ln.text.match(MOVE_RE)
      if (move) {
        blocks.push({ type: 'move', dir: move[1] })
        pos += 1
        continue
      }

      const forMatch = ln.text.match(FOR_RE)
      if (forMatch) {
        const times = Number(forMatch[2])
        if (!Number.isInteger(times) || times < 1) {
          return {
            blocks: null,
            error: {
              line: ln.n,
              message: "range() needs a positive whole number, like range(3).",
            },
          }
        }
        const headerIndent = ln.indent
        pos += 1

        // The body must be indented MORE than the for header.
        if (pos >= lines.length || lines[pos].indent <= headerIndent) {
          return {
            blocks: null,
            error: {
              line: ln.n,
              message: "Your loop needs at least one command inside it — indent the next line.",
            },
          }
        }

        const bodyIndent = lines[pos].indent
        const indentStep = bodyIndent - headerIndent
        if (indentStep !== 4) {
          return {
            blocks: null,
            error: {
              line: lines[pos].n,
              message: "Indent the loop body by 4 spaces (or one tab) so Python knows it's inside the loop.",
            },
          }
        }

        const sub = parseBlock(bodyIndent)
        if (sub.error) return { blocks: null, error: sub.error }
        if (sub.blocks.length === 0) {
          return {
            blocks: null,
            error: {
              line: ln.n,
              message: "Your loop needs at least one command inside it.",
            },
          }
        }
        blocks.push({ type: 'repeat', times, body: sub.blocks })
        continue
      }

      // --- Not a move or a valid for: produce a friendly diagnostic. ---

      // A `for` that's missing its trailing colon.
      if (/^for\b/.test(ln.text) && !ln.text.endsWith(':')) {
        return {
          blocks: null,
          error: {
            line: ln.n,
            message: "Add a ':' at the end of your for line.",
          },
        }
      }
      // A `for` shaped wrong (e.g. bad range) but with a colon.
      if (/^for\b/.test(ln.text)) {
        return {
          blocks: null,
          error: {
            line: ln.n,
            message: "A loop looks like:  for i in range(3):  then indent the commands inside.",
          },
        }
      }

      // Bare direction word without parentheses — nudge toward real syntax.
      const bare = ln.text.match(BARE_MOVE_RE)
      if (bare) {
        return {
          blocks: null,
          error: {
            line: ln.n,
            message: `Add parentheses — write ${bare[1]}() instead of ${bare[1]}.`,
          },
        }
      }

      // Unknown command. Pull the called name if it looks like a call.
      const callName = ln.text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(/)
      if (callName) {
        return {
          blocks: null,
          error: {
            line: ln.n,
            message: `I don't know '${callName[1]}()' — try up(), down(), left(), or right().`,
          },
        }
      }

      return {
        blocks: null,
        error: {
          line: ln.n,
          message: "I don't understand this line — use up(), down(), left(), right(), or a for loop.",
        },
      }
    }

    return { blocks, error: null }
  }

  const top = parseBlock(0)
  if (top.error) return { program: null, error: top.error }

  // Safety: cap the total expanded move count.
  const expanded = countExpandedMoves(top.blocks)
  if (expanded > MAX_EXPANDED_MOVES) {
    return {
      program: null,
      error: {
        line: lines[0].n,
        message: 'That makes too many moves — try smaller numbers in your range().',
      },
    }
  }

  return { program: top.blocks, error: null }
}

/** Total moves after expanding all repeats (short-circuits past the cap). */
function countExpandedMoves(blocks) {
  let total = 0
  for (const b of blocks || []) {
    if (!b || typeof b !== 'object') continue
    if (b.type === 'move') total += 1
    else if (b.type === 'repeat') {
      const inner = countExpandedMoves(b.body)
      total += Math.max(0, Math.floor(b.times || 0)) * inner
    }
    if (total > MAX_EXPANDED_MOVES * 4) return total // guard against huge nests
  }
  return total
}

/**
 * flattenToDirs(program) -> ['up','right',...]
 * Expands repeats into a flat list of directions (capped for safety).
 */
export function flattenToDirs(program) {
  const dirs = []
  const walk = (blocks) => {
    for (const b of blocks || []) {
      if (!b || typeof b !== 'object') continue
      if (dirs.length > MAX_EXPANDED_MOVES) return
      if (b.type === 'move') dirs.push(b.dir)
      else if (b.type === 'repeat') {
        const times = Math.max(0, Math.floor(b.times || 0))
        for (let i = 0; i < times; i++) {
          walk(b.body)
          if (dirs.length > MAX_EXPANDED_MOVES) return
        }
      }
    }
  }
  walk(program)
  return dirs
}
