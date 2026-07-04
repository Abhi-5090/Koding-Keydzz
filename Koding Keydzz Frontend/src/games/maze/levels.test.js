import { describe, it, expect } from 'vitest'
import { parseLevel, bfsOptimalSteps, optimalBlocks } from './engine'
import levels from '../../data/mazeLevels'

describe('maze levels — catalog integrity', () => {
  it('has exactly 50 levels', () => {
    expect(levels).toHaveLength(50)
  })

  it('has ids 1..50, unique and in order', () => {
    const ids = levels.map((l) => l.id)
    expect(ids).toEqual(Array.from({ length: 50 }, (_, i) => i + 1))
    expect(new Set(ids).size).toBe(50)
  })

  it('has exactly 25 easy / 15 medium / 10 hard', () => {
    const counts = levels.reduce((acc, l) => {
      acc[l.difficulty] = (acc[l.difficulty] || 0) + 1
      return acc
    }, {})
    expect(counts).toEqual({ easy: 25, medium: 15, hard: 10 })
  })

  it('orders difficulty easy(1-25) -> medium(26-40) -> hard(41-50)', () => {
    levels.slice(0, 25).forEach((l) => expect(l.difficulty).toBe('easy'))
    levels.slice(25, 40).forEach((l) => expect(l.difficulty).toBe('medium'))
    levels.slice(40, 50).forEach((l) => expect(l.difficulty).toBe('hard'))
  })
})

describe.each(levels.map((l) => [l.id, l.name, l]))(
  'level %i — %s',
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
