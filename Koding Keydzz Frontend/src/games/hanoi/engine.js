/**
 * Towers of Hanoi engine — pure, framework-free logic shared by the UI and
 * tests.
 *
 * State is a 3-tuple of pegs: `[[...], [...], [...]]`. Each peg is an array of
 * disk SIZES ordered bottom → top; a larger number is a bigger disk. A peg is
 * legal only when it is strictly decreasing bottom → top (a bigger disk never
 * sits on a smaller one). Peg indices are 0, 1, 2.
 */

/** All disk sizes `disks..1` stacked (bottom → top) on peg `from`. */
export function initState(disks, from = 0) {
  const stack = []
  for (let s = disks; s >= 1; s--) stack.push(s) // [disks, ..., 2, 1]
  const state = [[], [], []]
  state[from] = stack
  return state
}

/** The top (smallest) disk on `peg`, or null if the peg is empty. */
export function topDisk(state, peg) {
  const stack = state[peg]
  if (!stack || stack.length === 0) return null
  return stack[stack.length - 1]
}

/**
 * canMove(state, from, to) -> boolean
 * A move is legal when `from` has a disk AND `to` is empty or its top disk is
 * bigger than the one being moved. (from === to is rejected naturally.)
 */
export function canMove(state, from, to) {
  const moving = topDisk(state, from)
  if (moving == null) return false
  const onto = topDisk(state, to)
  if (onto == null) return from !== to
  return onto > moving
}

/**
 * move(state, from, to) -> { state, valid }
 * Immutable: returns a new state with the top disk of `from` moved onto `to`
 * when legal (`valid:true`); otherwise the original state and `valid:false`.
 */
export function move(state, from, to) {
  if (!canMove(state, from, to)) return { state, valid: false }
  const next = state.map((peg) => peg.slice())
  const disk = next[from].pop()
  next[to].push(disk)
  return { state: next, valid: true }
}

/**
 * isWon(state, disks, to) -> boolean
 * True when peg `to` holds all `disks` disks correctly stacked
 * ([disks, ..., 2, 1] bottom → top).
 */
export function isWon(state, disks, to) {
  const stack = state[to]
  if (!stack || stack.length !== disks) return false
  for (let i = 0; i < disks; i++) {
    if (stack[i] !== disks - i) return false
  }
  return true
}

/** minMoves(disks) -> the optimal move count 2**disks - 1. */
export function minMoves(disks) {
  return 2 ** disks - 1
}

/** Which peg currently holds disk `size`, or -1 if none. */
function pegOf(state, size) {
  for (let p = 0; p < 3; p++) {
    if (state[p].includes(size)) return p
  }
  return -1
}

/**
 * solveHint(state, disks, from, to) -> { from, to } | null
 * The NEXT optimal move toward moving every disk onto peg `to`, computed from
 * the CURRENT state (works from any legal position, not just the start). Powers
 * the Hint button; never shown automatically. Returns null when already solved.
 *
 * `from` is accepted for API symmetry; the target `to` fully determines the
 * optimal completion. Standard recursive Hanoi: to place disks 1..n on the
 * target, first park the largest misplaced disk's smaller disks on the spare
 * peg, then move the big disk, then bring the smaller disks over.
 */
export function solveHint(state, disks, from, to) {
  const nextMove = (target, n) => {
    if (n <= 0) return null
    const cur = pegOf(state, n)
    if (cur === target) {
      // Disk n is home; place the smaller disks on top of it.
      return nextMove(target, n - 1)
    }
    // Disk n must move cur -> target; first the smaller disks go to `other`.
    const other = 3 - cur - target
    const sub = nextMove(other, n - 1)
    if (sub) return sub
    // All smaller disks are parked on `other` — safe to move disk n now.
    return { from: cur, to: target }
  }
  return nextMove(to, disks)
}
