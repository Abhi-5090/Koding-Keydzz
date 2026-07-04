import { describe, it, expect } from 'vitest'
import {
  initState,
  topDisk,
  canMove,
  move,
  isWon,
  minMoves,
  solveHint,
} from './engine'
import hanoiLevels from '../../data/hanoiLevels'

describe('initState', () => {
  it('stacks all disks bottom -> top on the from peg', () => {
    expect(initState(3, 0)).toEqual([[3, 2, 1], [], []])
    expect(initState(4, 2)).toEqual([[], [], [4, 3, 2, 1]])
  })
})

describe('topDisk', () => {
  it('returns the smallest (top) disk or null', () => {
    const s = initState(3, 0)
    expect(topDisk(s, 0)).toBe(1)
    expect(topDisk(s, 1)).toBeNull()
  })
})

describe('canMove / move validity', () => {
  it('allows a legal move onto an empty peg', () => {
    const s = initState(3, 0)
    expect(canMove(s, 0, 2)).toBe(true)
    const { state, valid } = move(s, 0, 2)
    expect(valid).toBe(true)
    expect(state).toEqual([[3, 2], [], [1]])
    // original untouched (immutability)
    expect(s).toEqual([[3, 2, 1], [], []])
  })

  it('rejects placing a bigger disk on a smaller one', () => {
    const s = [[3], [1], []]
    expect(canMove(s, 0, 1)).toBe(false) // 3 onto 1
    const { state, valid } = move(s, 0, 1)
    expect(valid).toBe(false)
    expect(state).toBe(s) // unchanged reference on invalid
  })

  it('rejects moving from an empty peg', () => {
    const s = [[2, 1], [], []]
    expect(canMove(s, 1, 2)).toBe(false)
    expect(move(s, 1, 2).valid).toBe(false)
  })

  it('rejects moving a peg onto itself', () => {
    const s = initState(3, 0)
    expect(canMove(s, 0, 0)).toBe(false)
  })

  it('allows a smaller disk onto a bigger one', () => {
    const s = [[3], [], [2]]
    // move disk 2 from peg 2 onto disk 3 at peg 0
    expect(canMove(s, 2, 0)).toBe(true)
  })
})

describe('isWon', () => {
  it('is true only when the target peg holds the full ordered stack', () => {
    expect(isWon([[], [], [3, 2, 1]], 3, 2)).toBe(true)
    expect(isWon([[3, 2, 1], [], []], 3, 2)).toBe(false) // wrong peg
    expect(isWon([[], [], [3, 1]], 2, 2)).toBe(false) // wrong contents / count
    expect(isWon([[], [], [3, 2, 1]], 3, 0)).toBe(false) // asked for peg 0
  })
})

describe('minMoves', () => {
  it('matches 2**n - 1', () => {
    expect(minMoves(3)).toBe(7)
    expect(minMoves(4)).toBe(15)
    expect(minMoves(5)).toBe(31)
    expect(minMoves(6)).toBe(63)
    expect(minMoves(7)).toBe(127)
  })
})

describe('solveHint drives an optimal completion', () => {
  for (const n of [3, 4, 5]) {
    it(`solves n=${n} from initState in exactly minMoves(${n}) moves`, () => {
      const from = 0
      const to = 2
      let state = initState(n, from)
      let count = 0
      const cap = minMoves(n) + 5 // safety bound; should never be hit
      while (!isWon(state, n, to)) {
        const hint = solveHint(state, n, from, to)
        expect(hint, `no hint at step ${count} for n=${n}`).not.toBeNull()
        expect(canMove(state, hint.from, hint.to)).toBe(true)
        const res = move(state, hint.from, hint.to)
        expect(res.valid).toBe(true)
        state = res.state
        count++
        if (count > cap) break
      }
      expect(isWon(state, n, to)).toBe(true)
      expect(count).toBe(minMoves(n))
    })
  }

  it('returns null when already solved', () => {
    const state = initState(3, 2) // all disks already on the target
    expect(solveHint(state, 3, 0, 2)).toBeNull()
  })

  it('finds the next optimal move from a mid-solve state', () => {
    // Standard 3-disk solve, target peg 2, after the first move (1: 0->2)
    const state = [[3, 2], [], [1]]
    expect(solveHint(state, 3, 0, 2)).toEqual({ from: 0, to: 1 }) // disk 2: 0->1
  })
})

describe('authored hanoi levels', () => {
  it('has 10 levels with the right difficulty ramp', () => {
    expect(hanoiLevels).toHaveLength(10)
    expect(hanoiLevels.filter((l) => l.difficulty === 'easy')).toHaveLength(2)
    expect(hanoiLevels.filter((l) => l.difficulty === 'medium')).toHaveLength(4)
    expect(hanoiLevels.filter((l) => l.difficulty === 'hard')).toHaveLength(4)
  })

  it('every level has valid fields and unique ids', () => {
    const ids = new Set()
    hanoiLevels.forEach((l, i) => {
      expect(Number.isInteger(l.disks) && l.disks >= 3 && l.disks <= 7).toBe(true)
      expect([0, 1, 2]).toContain(l.from)
      expect([0, 1, 2]).toContain(l.to)
      expect(l.from).not.toBe(l.to)
      expect(l.maxHints).toBeGreaterThanOrEqual(0)
      expect(l.maxHints).toBeLessThanOrEqual(2)
      expect(l.id).toBe(i + 1) // ids 1..N in order
      expect(ids.has(l.id)).toBe(false)
      ids.add(l.id)
    })
  })

  it('ramps disk counts easy(3) -> medium(4,5) -> hard(6,7)', () => {
    for (const l of hanoiLevels) {
      if (l.difficulty === 'easy') expect(l.disks).toBe(3)
      if (l.difficulty === 'medium') expect([4, 5]).toContain(l.disks)
      if (l.difficulty === 'hard') expect([6, 7]).toContain(l.disks)
    }
  })

  it('ramps hints 2 -> 1 -> 0 by level order (cap 2)', () => {
    // first ~4 levels max hints 2, middle ~3 -> 1, last ~3 -> 0
    for (const l of hanoiLevels) {
      if (l.id <= 4) expect(l.maxHints).toBe(2)
      else if (l.id <= 7) expect(l.maxHints).toBe(1)
      else expect(l.maxHints).toBe(0)
    }
  })
})
