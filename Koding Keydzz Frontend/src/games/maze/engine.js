// Maze Coding engine — pure, deterministic, DOM-free.
// Program model:
//   move:   { type: 'move', dir: 'up'|'down'|'left'|'right' }
//   repeat: { type: 'repeat', times: N, body: [blocks] }   (N in 2..9, one nesting level max)
//
// Grid coords: x = col (0..cols-1), y = row (0..rows-1).
//   up = y-1, down = y+1, left = x-1, right = x+1.

export const DIRS = ['up', 'down', 'left', 'right']

export const DELTA = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
}

const MAX_EXPANDED_STEPS = 1000

const key = (x, y) => `${x},${y}`

/**
 * parseLevel(level) -> { cols, rows, walls:Set<'x,y'>, start:{x,y}, goal:{x,y} }
 * Throws if there is no S or no G (or more than one of either).
 */
export function parseLevel(level) {
  if (!level || !Array.isArray(level.grid) || level.grid.length === 0) {
    throw new Error('Invalid level: grid missing')
  }
  const grid = level.grid
  const rows = grid.length
  const cols = grid[0].length
  const walls = new Set()
  let start = null
  let goal = null

  for (let y = 0; y < rows; y++) {
    const row = grid[y]
    if (row.length !== cols) {
      throw new Error(`Invalid level "${level.name ?? level.id}": ragged grid at row ${y}`)
    }
    for (let x = 0; x < cols; x++) {
      const ch = row[x]
      if (ch === '#') walls.add(key(x, y))
      else if (ch === 'S') {
        if (start) throw new Error(`Level "${level.name ?? level.id}" has more than one S`)
        start = { x, y }
      } else if (ch === 'G') {
        if (goal) throw new Error(`Level "${level.name ?? level.id}" has more than one G`)
        goal = { x, y }
      } else if (ch !== '.') {
        throw new Error(`Level "${level.name ?? level.id}" has invalid char "${ch}"`)
      }
    }
  }

  if (!start) throw new Error(`Level "${level.name ?? level.id}" has no start (S)`)
  if (!goal) throw new Error(`Level "${level.name ?? level.id}" has no goal (G)`)

  return { cols, rows, walls, start, goal }
}

/**
 * flatten(program) -> { moves:[dir...], invalid:boolean }
 * Expands repeats into a flat list of move directions.
 * Caps total expanded steps at MAX_EXPANDED_STEPS; if exceeded, invalid=true.
 */
export function flatten(program) {
  const moves = []
  let invalid = false

  const walk = (blocks) => {
    if (invalid) return
    for (const block of blocks) {
      if (invalid) return
      if (!block || typeof block !== 'object') continue
      if (block.type === 'move') {
        moves.push(block.dir)
        if (moves.length > MAX_EXPANDED_STEPS) {
          invalid = true
          return
        }
      } else if (block.type === 'repeat') {
        const times = Math.max(0, Math.floor(block.times || 0))
        const body = Array.isArray(block.body) ? block.body : []
        for (let i = 0; i < times; i++) {
          walk(body)
          if (invalid) return
        }
      }
    }
  }

  walk(program || [])
  if (moves.length > MAX_EXPANDED_STEPS) invalid = true
  return { moves: invalid ? [] : moves, invalid }
}

/**
 * simulate(level, program) ->
 *   { path:[{x,y}...], reachedGoal, crashed, crashIndex, steps }
 * Steps the robot move-by-move from start. A move into a wall or off-grid
 * is a crash: stop, crashed=true, crashIndex = offending move index.
 */
export function simulate(level, program) {
  const { cols, rows, walls, start, goal } = parseLevel(level)
  const { moves, invalid } = flatten(program)

  const path = [{ x: start.x, y: start.y }]

  if (invalid) {
    return { path, reachedGoal: false, crashed: true, crashIndex: 0, steps: 0 }
  }

  let pos = { x: start.x, y: start.y }
  let crashed = false
  let crashIndex = -1

  for (let i = 0; i < moves.length; i++) {
    const d = DELTA[moves[i]]
    if (!d) {
      crashed = true
      crashIndex = i
      break
    }
    const nx = pos.x + d.dx
    const ny = pos.y + d.dy
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || walls.has(key(nx, ny))) {
      crashed = true
      crashIndex = i
      break
    }
    pos = { x: nx, y: ny }
    path.push({ x: pos.x, y: pos.y })
  }

  const reachedGoal = !crashed && pos.x === goal.x && pos.y === goal.y
  return { path, reachedGoal, crashed, crashIndex, steps: path.length - 1 }
}

/**
 * bfsOptimalSteps(level) -> shortest path length in moves (4-dir BFS).
 * Returns Infinity if unreachable.
 */
export function bfsOptimalSteps(level) {
  const { cols, rows, walls, start, goal } = parseLevel(level)
  if (start.x === goal.x && start.y === goal.y) return 0

  const dist = bfsDistances(cols, rows, walls, start)
  const d = dist.get(key(goal.x, goal.y))
  return d === undefined ? Infinity : d
}

/** Internal: BFS distance map from a source cell. */
function bfsDistances(cols, rows, walls, src) {
  const dist = new Map()
  dist.set(key(src.x, src.y), 0)
  const queue = [{ x: src.x, y: src.y }]
  let head = 0
  while (head < queue.length) {
    const cur = queue[head++]
    const d = dist.get(key(cur.x, cur.y))
    for (const dir of DIRS) {
      const { dx, dy } = DELTA[dir]
      const nx = cur.x + dx
      const ny = cur.y + dy
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
      if (walls.has(key(nx, ny))) continue
      const k = key(nx, ny)
      if (dist.has(k)) continue
      dist.set(k, d + 1)
      queue.push({ x: nx, y: ny })
    }
  }
  return dist
}

/**
 * optimalBlocks(level) -> minimum program-block count to traverse a shortest path.
 *
 * Loop cost model (run-length over same-direction moves along a shortest path):
 *   - a run of k same-direction moves costs 1 block if k == 1,
 *     else 2 blocks (a Repeat wrapper + its single body move).
 *
 * We compute the true minimum over ALL shortest paths via DP over the
 * shortest-path DAG. Build dist[] from BFS; keep edges u->v with
 * dist[v] == dist[u]+1. DP state = (cell, lastDir, runBucket ∈ {1, 2}) where:
 *   - entering a NEW direction:                 +1  (move block, run -> 1)
 *   - continuing same dir from run==1:          +1  (adds Repeat wrapper, run -> 2)
 *   - continuing same dir from run>=2:          +0  (just bump loop count, run stays 2)
 *
 * If allowLoops is false, optimalBlocks = bfsOptimalSteps (each move = 1 block).
 */
export function optimalBlocks(level) {
  const { cols, rows, walls, start, goal } = parseLevel(level)
  const best = bfsOptimalSteps(level)
  if (!Number.isFinite(best)) return Infinity
  if (best === 0) return 0
  if (level.allowLoops === false) return best

  // Forward BFS distances from start (defines the DAG layering).
  const dist = bfsDistances(cols, rows, walls, start)

  // DP forward along the DAG, minimizing accumulated block cost.
  // cost.get(stateKey) = min blocks used to ARRIVE at cell having just made
  // a move in `dir`, with current run bucket `bucket` (1 or 2).
  const stateKey = (x, y, dir, bucket) => `${x},${y}|${dir}|${bucket}`
  const cost = new Map()

  // Process cells in order of increasing distance (topological order of DAG).
  const cellsByDist = []
  for (const [k, d] of dist.entries()) {
    if (!cellsByDist[d]) cellsByDist[d] = []
    const [x, y] = k.split(',').map(Number)
    cellsByDist[d].push({ x, y })
  }

  // Seed: from start (distance 0), the first move in any direction.
  // Relax edges layer by layer.
  for (let d = 0; d < cellsByDist.length; d++) {
    const cells = cellsByDist[d] || []
    for (const cell of cells) {
      const k = key(cell.x, cell.y)
      const here = dist.get(k)

      // Determine the minimal arrival cost(s) at this cell across all states.
      // For the start cell at d==0 we synthesize an entry with cost 0 (no dir yet).
      let entries
      if (d === 0) {
        entries = [{ dir: null, bucket: 0, c: 0 }]
      } else {
        entries = []
        for (const dir of DIRS) {
          for (const bucket of [1, 2]) {
            const c = cost.get(stateKey(cell.x, cell.y, dir, bucket))
            if (c !== undefined) entries.push({ dir, bucket, c })
          }
        }
      }
      if (entries.length === 0) continue

      // Try to extend toward each DAG neighbor (dist == here+1).
      for (const dir of DIRS) {
        const { dx, dy } = DELTA[dir]
        const nx = cell.x + dx
        const ny = cell.y + dy
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
        const nk = key(nx, ny)
        if (walls.has(nk)) continue
        if (dist.get(nk) !== here + 1) continue // must advance along a shortest path

        for (const e of entries) {
          let added
          let newBucket
          if (e.dir !== dir) {
            // new direction -> a fresh move block
            added = 1
            newBucket = 1
          } else if (e.bucket === 1) {
            // second move same dir -> wrap into a Repeat (+1 for the wrapper)
            added = 1
            newBucket = 2
          } else {
            // run already a loop -> just increment the counter, free
            added = 0
            newBucket = 2
          }
          const nc = e.c + added
          const sk = stateKey(nx, ny, dir, newBucket)
          if (cost.get(sk) === undefined || nc < cost.get(sk)) {
            cost.set(sk, nc)
          }
        }
      }
    }
  }

  // Answer: min cost over any state landing on goal.
  let ans = Infinity
  for (const dir of DIRS) {
    for (const bucket of [1, 2]) {
      const c = cost.get(stateKey(goal.x, goal.y, dir, bucket))
      if (c !== undefined) ans = Math.min(ans, c)
    }
  }
  return ans
}

/**
 * countBlocks(program) -> total blocks. move = 1; repeat = 1 + countBlocks(body).
 */
export function countBlocks(program) {
  let total = 0
  for (const block of program || []) {
    if (!block || typeof block !== 'object') continue
    if (block.type === 'move') total += 1
    else if (block.type === 'repeat') {
      total += 1 + countBlocks(Array.isArray(block.body) ? block.body : [])
    }
  }
  return total
}

/**
 * evaluate(level, program) -> rich result object with star rating.
 * IMPORTANT: never expose bfsOptimalSteps / optimalBlocks values in the
 * returned object's message (stars are the only optimality signal).
 */
export function evaluate(level, program) {
  const sim = simulate(level, program)
  const completed = sim.reachedGoal && !sim.crashed
  const best = bfsOptimalSteps(level)
  const optimalPath = completed && sim.steps === best
  const userBlocks = countBlocks(program)
  const cleanCode = completed && optimalPath && userBlocks <= optimalBlocks(level)

  const stars = (completed ? 1 : 0) + (optimalPath ? 1 : 0) + (cleanCode ? 1 : 0)

  let status
  let message
  if (completed) {
    status = stars === 3 ? 'win' : 'short'
    message =
      stars === 3
        ? 'Perfect! This is the best way to solve it.'
        : "You solved it! But there's still a better way — try fewer moves or cleaner code with loops. Aim for all 3 stars!"
  } else if (sim.crashed) {
    status = 'crash'
    message = 'Oops — the robot crashed into a wall. Tweak your program and try again.'
  } else {
    status = 'short'
    message = "Almost! The robot didn't reach the goal yet."
  }

  return {
    completed,
    crashed: sim.crashed,
    reachedGoal: sim.reachedGoal,
    userSteps: sim.steps,
    userBlocks,
    optimalPath,
    cleanCode,
    stars,
    status,
    message,
  }
}
