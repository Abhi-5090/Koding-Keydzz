// Robot Navigation engine — pure, deterministic, DOM-free.
//
// A power-of-two navigation puzzle. The robot has a JUMP POWER (1 or 2). Each
// tap moves the robot exactly `power` cells in a direction — it LEAPS over the
// intermediate cell and lands `power` cells away. Power tiles change the power:
//   M (×2): landing here sets power to 2 (capped at 2).
//   D (÷2): landing here halves power. From 2 -> 1. From 1 -> the robot loses
//           all power and FALLS OUT (the level fails and must be replayed).
//
// Grid chars:
//   S = start, G = goal, # = wall, . = open, M = ×2 tile, D = ÷2 tile.
//   M and D are walkable; their effect triggers only when the robot LANDS on them.
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

const key = (x, y) => `${x},${y}`

/**
 * parseLevel(level) ->
 *   { cols, rows, walls:Set<'x,y'>, powerUp:Set<'x,y'>, powerDown:Set<'x,y'>,
 *     start:{x,y}, goal:{x,y} }
 * Throws if there is no S or no G (or more than one of either), a ragged grid,
 * or an invalid character.
 */
export function parseLevel(level) {
  if (!level || !Array.isArray(level.grid) || level.grid.length === 0) {
    throw new Error('Invalid level: grid missing')
  }
  const grid = level.grid
  const rows = grid.length
  const cols = grid[0].length
  const walls = new Set()
  const powerUp = new Set()
  const powerDown = new Set()
  let start = null
  let goal = null
  const label = level.name ?? level.id

  for (let y = 0; y < rows; y++) {
    const row = grid[y]
    if (row.length !== cols) {
      throw new Error(`Invalid level "${label}": ragged grid at row ${y}`)
    }
    for (let x = 0; x < cols; x++) {
      const ch = row[x]
      if (ch === '#') walls.add(key(x, y))
      else if (ch === 'M') powerUp.add(key(x, y))
      else if (ch === 'D') powerDown.add(key(x, y))
      else if (ch === 'S') {
        if (start) throw new Error(`Level "${label}" has more than one S`)
        start = { x, y }
      } else if (ch === 'G') {
        if (goal) throw new Error(`Level "${label}" has more than one G`)
        goal = { x, y }
      } else if (ch !== '.') {
        throw new Error(`Level "${label}" has invalid char "${ch}"`)
      }
    }
  }

  if (!start) throw new Error(`Level "${label}" has no start (S)`)
  if (!goal) throw new Error(`Level "${label}" has no goal (G)`)

  return { cols, rows, walls, powerUp, powerDown, start, goal }
}

/**
 * step(level, state, dir) -> result
 *
 * state = { x, y, power }   (power is 1 or 2)
 * Moves the robot `power` cells in `dir`, landing `power` cells away (leaping
 * over the intermediate cell). Returns:
 *   {
 *     state,          // resulting { x, y, power } (unchanged if blocked)
 *     blocked,        // true if landing off-grid or a wall — robot did not move
 *     failed,         // true if landed on ÷2 while at power 1 — fell out
 *     won,            // true if landed on the goal
 *     hitPowerUp,     // true if landed on a ×2 tile
 *     hitPowerDown,   // true if landed on a ÷2 tile
 *   }
 *
 * Rules:
 *  - landing = (x,y) + power * delta(dir).
 *  - off-grid or wall landing -> blocked, state unchanged.
 *  - landing on M -> power becomes 2 (capped).
 *  - landing on D with power 2 -> power becomes 1.
 *  - landing on D with power 1 -> failed (robot at the landing cell, level lost).
 *  - landing on goal -> won.
 */
export function step(level, state, dir) {
  const { cols, rows, walls, powerUp, powerDown, goal } = parseLevel(level)
  const d = DELTA[dir]
  const power = state.power

  const idle = {
    state: { x: state.x, y: state.y, power },
    blocked: false,
    failed: false,
    won: false,
    hitPowerUp: false,
    hitPowerDown: false,
  }

  if (!d || (power !== 1 && power !== 2)) {
    return { ...idle, blocked: true }
  }

  const nx = state.x + power * d.dx
  const ny = state.y + power * d.dy

  // Blocked: landing off-grid or onto a wall. Robot stays put.
  if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || walls.has(key(nx, ny))) {
    return { ...idle, blocked: true }
  }

  const k = key(nx, ny)
  const hitPowerUp = powerUp.has(k)
  const hitPowerDown = powerDown.has(k)

  // ÷2 tile while at power 1 -> fall out and fail.
  if (hitPowerDown && power === 1) {
    return {
      state: { x: nx, y: ny, power: 0 },
      blocked: false,
      failed: true,
      won: false,
      hitPowerUp: false,
      hitPowerDown: true,
    }
  }

  let nextPower = power
  if (hitPowerUp) nextPower = 2
  else if (hitPowerDown) nextPower = 1 // from 2 (the power-1 case handled above)

  const won = nx === goal.x && ny === goal.y

  return {
    state: { x: nx, y: ny, power: nextPower },
    blocked: false,
    failed: false,
    won,
    hitPowerUp,
    hitPowerDown,
  }
}

/**
 * optimalClicks(level) -> minimum number of taps to reach the goal.
 *
 * BFS over states (x, y, power) starting at the start cell with power 1. Edges
 * are valid, non-failing, non-blocked moves. Returns the fewest taps to land on
 * the goal cell (in any power), or Infinity if unreachable. Deterministic.
 */
export function optimalClicks(level) {
  const parsed = parseLevel(level)
  const { start, goal } = parsed

  // If start already is the goal (degenerate), zero taps.
  if (start.x === goal.x && start.y === goal.y) return 0

  const startKey = `${start.x},${start.y},1`
  const visited = new Set([startKey])
  let frontier = [{ x: start.x, y: start.y, power: 1 }]
  let taps = 0

  while (frontier.length > 0) {
    taps += 1
    const next = []
    for (const s of frontier) {
      for (const dir of DIRS) {
        const r = step(level, s, dir)
        if (r.blocked || r.failed) continue
        if (r.won) return taps
        const ns = r.state
        const nk = `${ns.x},${ns.y},${ns.power}`
        if (visited.has(nk)) continue
        visited.add(nk)
        next.push(ns)
      }
    }
    frontier = next
  }

  return Infinity
}

/**
 * isSolvable(level) -> boolean. True when optimalClicks is finite.
 */
export function isSolvable(level) {
  return Number.isFinite(optimalClicks(level))
}
