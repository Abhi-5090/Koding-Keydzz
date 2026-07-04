import { describe, it, expect } from 'vitest'
import { parseLevel, step, optimalClicks, isSolvable } from './engine'
import levels from '../../data/robotLevels'

// A tiny fixture with one of every tile, used by the unit tests.
//   row0: S M # D G
//   x0 start, x1 ×2, x2 wall, x3 ÷2, x4 goal
const fixture = { id: 0, name: 'fixture', difficulty: 'easy', grid: ['SM#DG'] }

describe('parseLevel', () => {
  it('classifies every tile type', () => {
    const p = parseLevel(fixture)
    expect(p.cols).toBe(5)
    expect(p.rows).toBe(1)
    expect(p.start).toEqual({ x: 0, y: 0 })
    expect(p.goal).toEqual({ x: 4, y: 0 })
    expect(p.walls.has('2,0')).toBe(true)
    expect(p.powerUp.has('1,0')).toBe(true)
    expect(p.powerDown.has('3,0')).toBe(true)
  })

  it('throws when start or goal is missing', () => {
    expect(() => parseLevel({ grid: ['..G'] })).toThrow(/start/)
    expect(() => parseLevel({ grid: ['S..'] })).toThrow(/goal/)
  })

  it('throws on a ragged grid or invalid char', () => {
    expect(() => parseLevel({ grid: ['SG', 'S'] })).toThrow(/ragged/)
    expect(() => parseLevel({ grid: ['SXG'] })).toThrow(/invalid char/)
  })
})

describe('step — basic moves', () => {
  // S . . G  (open row, power 1)
  const line = { grid: ['S..G'] }

  it('moves one cell at power 1', () => {
    const r = step(line, { x: 0, y: 0, power: 1 }, 'right')
    expect(r.state).toEqual({ x: 1, y: 0, power: 1 })
    expect(r.blocked).toBe(false)
    expect(r.won).toBe(false)
  })

  it('wins when landing on the goal', () => {
    const r = step(line, { x: 2, y: 0, power: 1 }, 'right')
    expect(r.state).toEqual({ x: 3, y: 0, power: 1 })
    expect(r.won).toBe(true)
  })

  it('blocks (no move) when the landing is off-grid', () => {
    const r = step(line, { x: 0, y: 0, power: 1 }, 'left')
    expect(r.blocked).toBe(true)
    expect(r.state).toEqual({ x: 0, y: 0, power: 1 })
  })

  it('blocks (no move) when the landing is a wall', () => {
    // S # G  — power-1 right from start lands on the wall.
    const r = step({ grid: ['S#G'] }, { x: 0, y: 0, power: 1 }, 'right')
    expect(r.blocked).toBe(true)
    expect(r.state).toEqual({ x: 0, y: 0, power: 1 })
  })
})

describe('step — power tiles', () => {
  it('×2 tile sets power to 2', () => {
    // S M . G
    const r = step({ grid: ['SM.G'] }, { x: 0, y: 0, power: 1 }, 'right')
    expect(r.hitPowerUp).toBe(true)
    expect(r.state.power).toBe(2)
  })

  it('power stays capped at 2 when re-landing on ×2', () => {
    // M . M . . : land on second M while already power 2 -> still 2.
    const lvl = { grid: ['SM.MG'] }
    let s = step(lvl, { x: 0, y: 0, power: 1 }, 'right').state // ->1,0 power2
    const r = step(lvl, s, 'right') // power-2 jump from x1 lands x3 (M)
    expect(r.hitPowerUp).toBe(true)
    expect(r.state.power).toBe(2)
  })

  it('÷2 from power 2 drops to power 1 (does not fail)', () => {
    // S M D . G : ×2 then a power-2 jump lands on D.
    const lvl = { grid: ['SMD.G'] }
    const s = step(lvl, { x: 0, y: 0, power: 1 }, 'right').state // x1 power2
    const r = step(lvl, s, 'right') // power-2 jump from x1 lands x3? no: x1+2=x3 '.'
    // Re-derive on a grid where the power-2 landing IS the D tile:
    const lvl2 = { grid: ['SM.DG'] }
    const s2 = step(lvl2, { x: 0, y: 0, power: 1 }, 'right').state // x1 power2
    const r2 = step(lvl2, s2, 'right') // x1+2 = x3 = D
    expect(r2.hitPowerDown).toBe(true)
    expect(r2.failed).toBe(false)
    expect(r2.state.power).toBe(1)
    // r is just to exercise the other grid; assert it didn't fail either.
    expect(r.failed).toBe(false)
  })

  it('÷2 from power 1 fails — the robot falls out', () => {
    // S D G : power-1 right lands on D while at power 1.
    const r = step({ grid: ['SDG'] }, { x: 0, y: 0, power: 1 }, 'right')
    expect(r.failed).toBe(true)
    expect(r.hitPowerDown).toBe(true)
    expect(r.won).toBe(false)
  })
})

describe('step — jumping leaps over walls', () => {
  it('a power-2 jump leaps over a single wall to land beyond it', () => {
    // S M # G : power up, then a power-2 jump from x1 lands x3 (goal), over wall x2.
    const lvl = { grid: ['SM#G'] }
    const s = step(lvl, { x: 0, y: 0, power: 1 }, 'right').state
    expect(s.power).toBe(2)
    const r = step(lvl, s, 'right')
    expect(r.blocked).toBe(false)
    expect(r.won).toBe(true)
    expect(r.state).toEqual({ x: 3, y: 0, power: 2 })
  })

  it('is still blocked when the LANDING cell is a wall (even if the gap is clear)', () => {
    // S M . # G : power up at x1, then a power-2 jump from x1 lands x3 — but the
    // landing cell x3 is open '.', so test the wall case from x2 instead.
    //   x: 0 S, 1 M, 2 ., 3 #, 4 G — at power 2 from x2 the landing x4 is the goal,
    //   so use a position whose power-2 landing is the wall:
    const lvl = { grid: ['SM.#G'] }
    const r = step(lvl, { x: 1, y: 0, power: 2 }, 'right') // x1 + 2 = x3 = wall
    expect(r.blocked).toBe(true)
    expect(r.state).toEqual({ x: 1, y: 0, power: 2 })
  })
})

describe('optimalClicks', () => {
  it('counts the fewest taps on a tiny open line', () => {
    // S . . G -> three power-1 taps.
    expect(optimalClicks({ grid: ['S..G'] })).toBe(3)
  })

  it('uses ×2 to leap a wall in fewer taps', () => {
    // S M # G -> right (power up), right (leap) = 2 taps.
    expect(optimalClicks({ grid: ['SM#G'] })).toBe(2)
  })

  it('returns Infinity for an unreachable goal', () => {
    // S # G with no power tile: power-1 cannot pass, no way to power up.
    expect(optimalClicks({ grid: ['S#G'] })).toBe(Infinity)
    expect(isSolvable({ grid: ['S#G'] })).toBe(false)
  })

  it('requires ÷2 to land exactly (avoid overshoot)', () => {
    // S M . D G : must ÷2 to drop to power 1 and land exactly on G.
    expect(optimalClicks({ grid: ['SM.DG'] })).toBe(3)
  })
})

describe('robot levels — catalog integrity', () => {
  it('has exactly 18 levels', () => {
    expect(levels).toHaveLength(18)
  })

  it('has ids 1..18, unique and in order', () => {
    const ids = levels.map((l) => l.id)
    expect(ids).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
    expect(new Set(ids).size).toBe(18)
  })

  it('has the intended difficulty ramp (8 easy / 6 medium / 4 hard)', () => {
    const counts = levels.reduce((acc, l) => {
      acc[l.difficulty] = (acc[l.difficulty] || 0) + 1
      return acc
    }, {})
    expect(counts).toEqual({ easy: 8, medium: 6, hard: 4 })
  })
})

describe.each(levels.map((l) => [l.id, l.name, l]))(
  'robot level %i — %s',
  (_id, _name, level) => {
    it('has a non-empty name and a valid difficulty', () => {
      expect(typeof level.name).toBe('string')
      expect(level.name.length).toBeGreaterThan(0)
      expect(['easy', 'medium', 'hard']).toContain(level.difficulty)
    })

    it('parses with exactly one S and one G and a rectangular grid', () => {
      let parsed
      expect(() => {
        parsed = parseLevel(level)
      }).not.toThrow()
      const flat = level.grid.join('')
      expect((flat.match(/S/g) || []).length).toBe(1)
      expect((flat.match(/G/g) || []).length).toBe(1)
      const w = level.grid[0].length
      level.grid.forEach((row) => {
        expect(row.length).toBe(w)
        expect(/^[SG.#MD]+$/.test(row)).toBe(true)
      })
      expect(parsed.start).toBeTruthy()
      expect(parsed.goal).toBeTruthy()
    })

    it('is solvable: optimalClicks is finite and >= 1', () => {
      const clicks = optimalClicks(level)
      expect(Number.isFinite(clicks)).toBe(true)
      expect(clicks).toBeGreaterThanOrEqual(1)
      expect(isSolvable(level)).toBe(true)
    })
  }
)
