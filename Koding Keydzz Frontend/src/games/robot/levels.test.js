import { describe, it, expect } from 'vitest'
import {
  parseLevel,
  bfsOptimalSteps,
  optimalBlocks,
  evaluate,
} from '../maze/engine'
import { parseProgram } from '../maze/pythonParser'
import levels from '../../data/robotLevels'

// Robot Navigation now uses the SAME plain-grid maze engine + Python parser as
// Maze Coding (the student writes code that compiles into moves). These tests
// guarantee the catalog is well-formed and every level is actually solvable.

describe('robot levels — catalog integrity', () => {
  it('has exactly 16 levels', () => {
    expect(levels).toHaveLength(16)
  })

  it('has ids 1..16, unique and in order', () => {
    const ids = levels.map((l) => l.id)
    expect(ids).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
    expect(new Set(ids).size).toBe(16)
  })

  it('has exactly 7 easy / 6 medium / 3 hard', () => {
    const counts = levels.reduce((acc, l) => {
      acc[l.difficulty] = (acc[l.difficulty] || 0) + 1
      return acc
    }, {})
    expect(counts).toEqual({ easy: 7, medium: 6, hard: 3 })
  })

  it('ramps difficulty easy(1-7) -> medium(8-13) -> hard(14-16)', () => {
    levels.slice(0, 7).forEach((l) => expect(l.difficulty).toBe('easy'))
    levels.slice(7, 13).forEach((l) => expect(l.difficulty).toBe('medium'))
    levels.slice(13, 16).forEach((l) => expect(l.difficulty).toBe('hard'))
  })

  it('teaches sequencing first (early easy levels disable loops)', () => {
    // The opening levels turn loops off so kids practise plain sequencing.
    expect(levels[0].allowLoops).toBe(false)
    const loopless = levels.filter((l) => l.allowLoops === false)
    expect(loopless.length).toBeGreaterThanOrEqual(3)
    // ...but the bulk of the catalog rewards loops.
    const loopy = levels.filter((l) => l.allowLoops === true)
    expect(loopy.length).toBeGreaterThan(loopless.length)
  })
})

describe.each(levels.map((l) => [l.id, l.name, l]))(
  'robot level %i — %s',
  (_id, _name, level) => {
    it('has a non-empty name and a boolean allowLoops', () => {
      expect(typeof level.name).toBe('string')
      expect(level.name.length).toBeGreaterThan(0)
      expect(typeof level.allowLoops).toBe('boolean')
    })

    it('parses with exactly one S and one G', () => {
      let parsed
      expect(() => {
        parsed = parseLevel(level)
      }).not.toThrow()
      const flat = level.grid.join('')
      expect((flat.match(/S/g) || []).length).toBe(1)
      expect((flat.match(/G/g) || []).length).toBe(1)
      expect(parsed.start).toBeTruthy()
      expect(parsed.goal).toBeTruthy()
    })

    it('only contains valid chars and a rectangular grid', () => {
      const w = level.grid[0].length
      level.grid.forEach((row) => {
        expect(row.length).toBe(w)
        expect(/^[SG.#]+$/.test(row)).toBe(true)
      })
    })

    it('is solvable: bfsOptimalSteps is finite', () => {
      const steps = bfsOptimalSteps(level)
      expect(Number.isFinite(steps)).toBe(true)
      expect(steps).toBeGreaterThanOrEqual(1)
    })

    it('has a finite optimalBlocks >= 1', () => {
      const blocks = optimalBlocks(level)
      expect(Number.isFinite(blocks)).toBe(true)
      expect(blocks).toBeGreaterThanOrEqual(1)
    })
  }
)

describe('robot levels — sample Python solutions earn the expected stars', () => {
  it('Level 1 (Power On): three right() commands is a clean 3-star solve', () => {
    const level = levels[0]
    expect(bfsOptimalSteps(level)).toBe(3)
    const { program, error } = parseProgram('right()\nright()\nright()\n')
    expect(error).toBeNull()
    const result = evaluate(level, program)
    expect(result.completed).toBe(true)
    expect(result.optimalPath).toBe(true)
    expect(result.stars).toBe(3)
  })

  it('Level 5 (Long Charge): a for-loop is the clean 3-star solve; unrolled moves miss the loop star', () => {
    const level = levels[4]
    expect(bfsOptimalSteps(level)).toBe(6)

    const loop = parseProgram('for i in range(6):\n    right()\n')
    expect(loop.error).toBeNull()
    const looped = evaluate(level, loop.program)
    expect(looped.completed).toBe(true)
    expect(looped.optimalPath).toBe(true)
    expect(looped.stars).toBe(3)

    // Same shortest path, but repeating yourself instead of looping is not
    // "clean" — the loops-rewarding level withholds the third star.
    const unrolled = parseProgram(
      ['right()', 'right()', 'right()', 'right()', 'right()', 'right()', ''].join('\n')
    )
    expect(unrolled.error).toBeNull()
    const flat = evaluate(level, unrolled.program)
    expect(flat.completed).toBe(true)
    expect(flat.optimalPath).toBe(true)
    expect(flat.stars).toBe(2)
  })
})
