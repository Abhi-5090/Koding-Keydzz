import { describe, it, expect } from 'vitest'
import { parseProgram, flattenToDirs } from './pythonParser'
import { evaluate } from './engine'
import levels from '../../data/mazeLevels'

describe('pythonParser — flat sequences', () => {
  it('parses up()/right() into move blocks', () => {
    const { program, error } = parseProgram('up()\nright()')
    expect(error).toBeNull()
    expect(program).toEqual([
      { type: 'move', dir: 'up' },
      { type: 'move', dir: 'right' },
    ])
  })

  it('accepts all four directions and tolerates inner spaces', () => {
    const { program, error } = parseProgram('down ( )\nleft()\nright()\nup()')
    expect(error).toBeNull()
    expect(program.map((b) => b.dir)).toEqual(['down', 'left', 'right', 'up'])
  })

  it('ignores blank lines and # comments', () => {
    const code = '# go!\n\nup()   # step up\n\n# now over\nright()\n'
    const { program, error } = parseProgram(code)
    expect(error).toBeNull()
    expect(program).toEqual([
      { type: 'move', dir: 'up' },
      { type: 'move', dir: 'right' },
    ])
  })

  it('returns an empty program for empty/comment-only code', () => {
    expect(parseProgram('').program).toEqual([])
    expect(parseProgram('# just a note\n\n').program).toEqual([])
  })
})

describe('pythonParser — for loops', () => {
  it('parses for i in range(3): into a repeat block', () => {
    const code = 'for i in range(3):\n    up()'
    const { program, error } = parseProgram(code)
    expect(error).toBeNull()
    expect(program).toEqual([
      { type: 'repeat', times: 3, body: [{ type: 'move', dir: 'up' }] },
    ])
  })

  it('parses a loop body with multiple commands', () => {
    const code = 'for step in range(2):\n    right()\n    down()'
    const { program, error } = parseProgram(code)
    expect(error).toBeNull()
    expect(program).toEqual([
      {
        type: 'repeat',
        times: 2,
        body: [
          { type: 'move', dir: 'right' },
          { type: 'move', dir: 'down' },
        ],
      },
    ])
  })

  it('parses NESTED loops (a loop inside a loop)', () => {
    const code = 'for i in range(2):\n    right()\n    for j in range(3):\n        up()'
    const { program, error } = parseProgram(code)
    expect(error).toBeNull()
    expect(program).toEqual([
      {
        type: 'repeat',
        times: 2,
        body: [
          { type: 'move', dir: 'right' },
          { type: 'repeat', times: 3, body: [{ type: 'move', dir: 'up' }] },
        ],
      },
    ])
  })

  it('parses code that dedents back out of a loop', () => {
    const code = 'for i in range(2):\n    up()\nright()'
    const { program, error } = parseProgram(code)
    expect(error).toBeNull()
    expect(program).toEqual([
      { type: 'repeat', times: 2, body: [{ type: 'move', dir: 'up' }] },
      { type: 'move', dir: 'right' },
    ])
  })

  it('accepts a single tab for indentation', () => {
    const code = 'for i in range(2):\n\tdown()'
    const { program, error } = parseProgram(code)
    expect(error).toBeNull()
    expect(program).toEqual([
      { type: 'repeat', times: 2, body: [{ type: 'move', dir: 'down' }] },
    ])
  })
})

describe('pythonParser — friendly errors', () => {
  it('errors on an unknown command with the line number', () => {
    const { program, error } = parseProgram('up()\njump()')
    expect(program).toBeNull()
    expect(error.line).toBe(2)
    expect(error.message).toMatch(/jump\(\)/)
    expect(error.message).toMatch(/up\(\), down\(\), left\(\), or right\(\)/)
  })

  it('nudges toward parentheses for a bare direction word', () => {
    const { program, error } = parseProgram('up')
    expect(program).toBeNull()
    expect(error.line).toBe(1)
    expect(error.message).toMatch(/up\(\)/)
  })

  it('errors when a for line is missing its colon', () => {
    const { program, error } = parseProgram('for i in range(3)\n    up()')
    expect(program).toBeNull()
    expect(error.line).toBe(1)
    expect(error.message).toMatch(/':'/)
  })

  it('errors when range() is not a positive whole number', () => {
    const { program, error } = parseProgram('for i in range(0):\n    up()')
    expect(program).toBeNull()
    expect(error.message).toMatch(/positive whole number/)
  })

  it('errors on an empty loop body', () => {
    const { program, error } = parseProgram('for i in range(3):\nup()')
    expect(program).toBeNull()
    expect(error.message).toMatch(/at least one command/)
  })

  it('errors on unexpected indentation', () => {
    const { program, error } = parseProgram('    up()')
    expect(program).toBeNull()
    expect(error.line).toBe(1)
    expect(error.message).toMatch(/indented/)
  })

  it('errors when a loop would expand to too many moves', () => {
    const code = 'for i in range(999):\n    for j in range(999):\n        up()'
    const { program, error } = parseProgram(code)
    expect(program).toBeNull()
    expect(error.message).toMatch(/too many moves/)
  })

  it('never leaks anything solution-shaped in messages', () => {
    const { error } = parseProgram('teleport()')
    expect(error.message).not.toMatch(/goal|solution|answer|optimal/i)
  })
})

describe('flattenToDirs', () => {
  it('expands repeats into a flat direction list', () => {
    const { program } = parseProgram('for i in range(3):\n    right()\nup()')
    expect(flattenToDirs(program)).toEqual(['right', 'right', 'right', 'up'])
  })
})

describe('integration — Python solution drives the engine (Level 10 "Long Hallway")', () => {
  // Grid: ['S....G', ...] — a straight 5-cell corridor to the right.
  const level = levels.find((l) => l.id === 10)

  it('a for-loop solution earns 3 stars (clean code)', () => {
    const code = 'for i in range(5):\n    right()'
    const { program, error } = parseProgram(code)
    expect(error).toBeNull()
    const res = evaluate(level, program)
    expect(res.completed).toBe(true)
    expect(res.stars).toBe(3)
  })

  it('an unrolled solution still solves but earns fewer stars', () => {
    const code = 'right()\nright()\nright()\nright()\nright()'
    const { program, error } = parseProgram(code)
    expect(error).toBeNull()
    const res = evaluate(level, program)
    expect(res.completed).toBe(true)
    expect(res.stars).toBe(2)
    expect(res.stars).toBeLessThan(3)
  })
})
