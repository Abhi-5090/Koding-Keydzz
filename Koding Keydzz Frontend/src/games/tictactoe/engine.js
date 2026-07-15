/**
 * Tic-Tac-Toe engine — pure, framework-free logic shared by the UI and tests.
 *
 * Board model: a flat array of 9 cells, each 'X' | 'O' | null. Indices map to
 * the 3x3 grid left-to-right, top-to-bottom:
 *
 *     0 | 1 | 2
 *     ---------
 *     3 | 4 | 5
 *     ---------
 *     6 | 7 | 8
 *
 * The human is always 'X' and moves first; the AI is always 'O'.
 */

/** The 8 winning lines (3 rows, 3 columns, 2 diagonals). */
export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // columns
  [0, 4, 8],
  [2, 4, 6], // diagonals
]

/** A fresh empty board. */
export function emptyBoard() {
  return Array(9).fill(null)
}

/** The opposing mark. */
export function otherMark(mark) {
  return mark === 'X' ? 'O' : 'X'
}

/** Count how many cells hold `mark`. */
function count(board, mark) {
  let n = 0
  for (const c of board) if (c === mark) n++
  return n
}

/**
 * winningLine(board) -> [a, b, c] | null
 * The three indices of the completed line, if any (used to highlight the win).
 * Returns the first completed line found, or null when nobody has three yet.
 */
export function winningLine(board) {
  for (const line of LINES) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line
  }
  return null
}

/**
 * winner(board) -> 'X' | 'O' | 'draw' | null
 *   'X' / 'O' — that mark has three in a row.
 *   'draw'    — board is full with no line.
 *   null      — the game is still in progress.
 */
export function winner(board) {
  const line = winningLine(board)
  if (line) return board[line[0]]
  if (board.every((cell) => cell !== null)) return 'draw'
  return null
}

/** emptyCells(board) -> number[]  the indices of every open cell. */
export function emptyCells(board) {
  const out = []
  for (let i = 0; i < 9; i++) if (!board[i]) out.push(i)
  return out
}

/**
 * applyMove(board, i, mark) -> Board  (immutable)
 * Returns a NEW board with `mark` placed at index `i`; the input is untouched.
 */
export function applyMove(board, i, mark) {
  const next = board.slice()
  next[i] = mark
  return next
}

/**
 * currentPlayer(board) -> 'X' | 'O'
 * Whose turn it is, derived from the counts (X always moves first). Equal
 * counts -> X to move; one more X than O -> O to move.
 */
export function currentPlayer(board) {
  return count(board, 'X') <= count(board, 'O') ? 'X' : 'O'
}

/**
 * immediateMove(board, mark) -> index | -1
 * An open cell where playing `mark` wins on this very move, else -1. Handy for
 * the weaker bots (grab a win / block the opponent's win) and quick tests.
 */
export function immediateMove(board, mark) {
  for (const i of emptyCells(board)) {
    if (winner(applyMove(board, i, mark)) === mark) return i
  }
  return -1
}

/**
 * minimax(board, aiMark, humanMark, depth?, alpha?, beta?) -> { score, move }
 *
 * The PERFECT player. Full game-tree search with alpha-beta pruning and depth
 * weighting so it prefers the FASTEST win and the SLOWEST loss:
 *   aiMark line    -> +10 - depth   (win sooner = better)
 *   humanMark line -> depth - 10    (lose later = less bad)
 *   draw           ->  0
 *
 * Scores are always relative to `aiMark`. The search maximizes on aiMark's turn
 * and minimizes on the human's turn, reading whose turn it is from the board.
 *
 * Deterministic: cells are tried in ascending index order and ties keep the
 * first (lowest-index) best move, so the optimal move is stable for tests.
 * Tic-tac-toe's tree is tiny (well under ~5k visited states thanks to pruning),
 * so this is instant.
 */
export function minimax(
  board,
  aiMark,
  humanMark = otherMark(aiMark),
  depth = 0,
  alpha = -Infinity,
  beta = Infinity
) {
  const w = winner(board)
  if (w === aiMark) return { score: 10 - depth, move: -1 }
  if (w === humanMark) return { score: depth - 10, move: -1 }
  if (w === 'draw') return { score: 0, move: -1 }

  const player = currentPlayer(board)
  const maximizing = player === aiMark
  const cells = emptyCells(board)

  let bestScore = maximizing ? -Infinity : Infinity
  let bestMove = cells[0]

  for (const i of cells) {
    const next = applyMove(board, i, player)
    const { score } = minimax(next, aiMark, humanMark, depth + 1, alpha, beta)
    if (maximizing) {
      if (score > bestScore) {
        bestScore = score
        bestMove = i
      }
      alpha = Math.max(alpha, bestScore)
    } else {
      if (score < bestScore) {
        bestScore = score
        bestMove = i
      }
      beta = Math.min(beta, bestScore)
    }
    if (beta <= alpha) break // prune — this branch can't change the result
  }

  return { score: bestScore, move: bestMove }
}

/**
 * bestMove(board, aiMark) -> index
 * The single optimal move for `aiMark` on the given board (unbeatable). Returns
 * -1 only if the board is already finished / full.
 */
export function bestMove(board, aiMark) {
  if (winner(board) || emptyCells(board).length === 0) return -1
  return minimax(board, aiMark, otherMark(aiMark)).move
}

/** Pick a uniformly-random open cell (or -1 if the board is full). */
function randomCell(board, rng = Math.random) {
  const cells = emptyCells(board)
  if (cells.length === 0) return -1
  return cells[Math.floor(rng() * cells.length)]
}

/**
 * aiMoveBySkill(board, aiMark, skill, rng?) -> index
 *
 * The SKILL dial — one continuous knob that powers the 20-level climb.
 *   `skill` ∈ [0, 1] is the probability the AI plays the PERFECT move
 *   (`bestMove`). Otherwise it plays a uniformly-random legal move (a blunder).
 *
 *     skill 0    ≈ fully random — blunders constantly, easy for a kid to beat.
 *     skill 0.5  ≈ plays best half the time — a real, winnable contest.
 *     skill 1    = perfect play — literally unbeatable; the best a human can
 *                  force is a DRAW.
 *
 * Making `skill` rise smoothly across the levels makes the bot feel like it
 * gets a little smarter each rung, so the player feels themselves improving.
 *
 * `rng` (default Math.random) is injectable for deterministic tests. `skill`
 * is clamped to [0, 1] for safety. Returns -1 only on a finished/full board.
 */
export function aiMoveBySkill(board, aiMark, skill, rng = Math.random) {
  if (winner(board) || emptyCells(board).length === 0) return -1
  const p = Math.max(0, Math.min(1, Number(skill) || 0))
  // rng() < p -> play perfectly; otherwise blunder with a random legal move.
  if (rng() < p) return bestMove(board, aiMark)
  return randomCell(board, rng)
}

/**
 * aiMove(board, aiMark, level, rng?) -> index
 * Legacy named-tier opponent (kept for back-compat with older callers/tests).
 * The play screen now drives difficulty through `aiMoveBySkill` instead.
 *   'rookie'      (easy)   — mostly random; only occasionally grabs an obvious
 *                            win or block, so the player can absolutely win.
 *   'sharp'       (medium) — plays the optimal move ~75% of the time and a
 *                            random legal move otherwise (makes real mistakes).
 *   'grandmaster' (hard)   — ALWAYS the optimal move. Cannot lose: the best a
 *                            human can ever manage is a draw.
 *
 * `rng` (default Math.random) is injectable for deterministic tests.
 */
export function aiMove(board, aiMark, level, rng = Math.random) {
  if (winner(board) || emptyCells(board).length === 0) return -1
  const humanMark = otherMark(aiMark)

  if (level === 'grandmaster') {
    return bestMove(board, aiMark)
  }

  if (level === 'sharp') {
    if (rng() < 0.75) return bestMove(board, aiMark)
    return randomCell(board, rng)
  }

  // 'rookie' (and any unknown level) — beatable on purpose.
  if (rng() < 0.25) {
    const win = immediateMove(board, aiMark)
    if (win >= 0) return win
    const block = immediateMove(board, humanMark)
    if (block >= 0) return block
  }
  return randomCell(board, rng)
}
