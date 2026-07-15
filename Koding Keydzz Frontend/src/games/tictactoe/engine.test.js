import { describe, it, expect } from 'vitest'
import {
  LINES,
  emptyBoard,
  otherMark,
  winner,
  winningLine,
  emptyCells,
  applyMove,
  currentPlayer,
  immediateMove,
  minimax,
  bestMove,
  aiMove,
  aiMoveBySkill,
} from './engine'
import ticTacToeLevels from '../../data/tictactoeLevels'

const B = (s) => s.split('').map((ch) => (ch === '.' ? null : ch))

describe('winner / winningLine', () => {
  it('detects all 8 winning lines for X and O', () => {
    for (const line of LINES) {
      const board = emptyBoard()
      for (const i of line) board[i] = 'X'
      expect(winningLine(board)).toEqual(line)
      expect(winner(board)).toBe('X')

      const oBoard = emptyBoard()
      for (const i of line) oBoard[i] = 'O'
      expect(winningLine(oBoard)).toEqual(line)
      expect(winner(oBoard)).toBe('O')
    }
    expect(LINES).toHaveLength(8)
  })

  it('reports a draw on a full board with no line', () => {
    // X O X / X O O / O X X — full, nobody has three.
    const board = B('XOXXOOOXX')
    expect(winningLine(board)).toBeNull()
    expect(winner(board)).toBe('draw')
  })

  it('returns null while the game is still in progress', () => {
    expect(winner(emptyBoard())).toBeNull()
    expect(winningLine(emptyBoard())).toBeNull()
    expect(winner(B('X...O....'))).toBeNull()
  })
})

describe('emptyCells / applyMove', () => {
  it('lists open cells', () => {
    expect(emptyCells(emptyBoard())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(emptyCells(B('X.O.X.O..'))).toEqual([1, 3, 5, 7, 8])
  })

  it('applyMove is immutable (returns a new board, leaves input untouched)', () => {
    const board = emptyBoard()
    const next = applyMove(board, 4, 'X')
    expect(next).not.toBe(board)
    expect(next[4]).toBe('X')
    expect(board[4]).toBeNull() // original unchanged
    expect(board.every((c) => c === null)).toBe(true)
  })
})

describe('currentPlayer', () => {
  it('X moves first; alternates by count', () => {
    expect(currentPlayer(emptyBoard())).toBe('X')
    expect(currentPlayer(B('X........'))).toBe('O')
    expect(currentPlayer(B('XO.......'))).toBe('X')
  })
})

describe('immediateMove', () => {
  it('finds a winning cell and a blocking cell', () => {
    // X X . -> X can win at index 2.
    expect(immediateMove(B('XX.......'), 'X')).toBe(2)
    // O O . -> O's own winning cell is index 2 (so X should block there).
    expect(immediateMove(B('OO.......'), 'O')).toBe(2)
    // X has no immediate win on that same board.
    expect(immediateMove(B('OO.......'), 'X')).toBe(-1)
    // Nothing immediate on an empty board.
    expect(immediateMove(emptyBoard(), 'X')).toBe(-1)
  })
})

describe('bestMove — tactical correctness', () => {
  it('takes an immediate win when available', () => {
    // O O . / X X . / X . .  — O to move (X:3, O:2), completes the top row at 2.
    const board = B('OO.XX.X..')
    expect(winner(board)).toBeNull()
    expect(currentPlayer(board)).toBe('O')
    expect(bestMove(board, 'O')).toBe(2)
  })

  it('blocks the opponent’s immediate win', () => {
    // X X . / . O . / . . .  — X threatens to complete the top row; O to move
    // (X:2, O:1) must block at index 2.
    const board = B('XX..O....')
    expect(winner(board)).toBeNull()
    expect(currentPlayer(board)).toBe('O')
    expect(bestMove(board, 'O')).toBe(2)
  })

  it('opens in the center or a corner from an empty board (optimal)', () => {
    const move = bestMove(emptyBoard(), 'X')
    expect([0, 2, 4, 6, 8]).toContain(move)
  })
})

/** Play a full game; O uses `aiMove(level)`, X uses the supplied strategy. */
function playGame({ level, xStrategy, rng }) {
  let board = emptyBoard()
  let turn = 'X' // X always moves first
  while (!winner(board)) {
    let move
    if (turn === 'X') {
      move = xStrategy(board)
    } else {
      move = aiMove(board, 'O', level, rng)
    }
    if (move < 0) break
    board = applyMove(board, move, turn)
    turn = otherMark(turn)
  }
  return winner(board)
}

// A perfect X player (also unbeatable) for perfect-vs-perfect games.
const perfectX = (board) => bestMove(board, 'X')

describe('the grandmaster AI is UNBEATABLE', () => {
  it('never loses vs a random X player (many games, varied openings)', () => {
    // Deterministic PRNG so the suite is reproducible across runs.
    let seed = 123456789
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const randomX = (board) => {
      const cells = emptyCells(board)
      return cells[Math.floor(rng() * cells.length)]
    }
    for (let g = 0; g < 3000; g++) {
      const result = playGame({ level: 'grandmaster', xStrategy: randomX, rng })
      // The human (X) must NEVER win.
      expect(result === 'X').toBe(false)
      expect(['O', 'draw']).toContain(result)
    }
  })

  it('never loses across EVERY possible first two X moves vs perfect play afterward', () => {
    // Exhaustively try each opening X cell, then let X play perfectly the rest
    // of the game against the grandmaster. The AI must never be beaten.
    for (let first = 0; first < 9; first++) {
      let board = applyMove(emptyBoard(), first, 'X')
      let turn = 'O'
      while (!winner(board)) {
        const move = turn === 'O' ? bestMove(board, 'O') : bestMove(board, 'X')
        board = applyMove(board, move, turn)
        turn = otherMark(turn)
      }
      const result = winner(board)
      expect(result === 'X').toBe(false)
    }
  })

  it('perfect vs perfect is always a draw', () => {
    const result = playGame({ level: 'grandmaster', xStrategy: perfectX })
    expect(result).toBe('draw')

    // Also from every forced opening: perfect X first move, then both perfect.
    for (let first = 0; first < 9; first++) {
      let board = applyMove(emptyBoard(), first, 'X')
      let turn = 'O'
      while (!winner(board)) {
        const move = turn === 'O' ? bestMove(board, 'O') : bestMove(board, 'X')
        board = applyMove(board, move, turn)
        turn = otherMark(turn)
      }
      expect(winner(board)).toBe('draw')
    }
  })
})

describe('weaker bots are beatable / legal', () => {
  it('rookie and sharp always return a legal empty cell', () => {
    let seed = 42
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    for (const level of ['rookie', 'sharp']) {
      for (let t = 0; t < 500; t++) {
        // Random partial board with X to move-ish.
        const board = emptyBoard()
        const fill = Math.floor(rng() * 5)
        const cells = [...Array(9).keys()]
        for (let f = 0; f < fill; f++) {
          const idx = cells.splice(Math.floor(rng() * cells.length), 1)[0]
          board[idx] = f % 2 === 0 ? 'X' : 'O'
        }
        if (winner(board) || emptyCells(board).length === 0) continue
        const move = aiMove(board, 'O', level, rng)
        expect(emptyCells(board)).toContain(move)
      }
    }
  })

  it('a rookie CAN be beaten by a perfect human (at least sometimes)', () => {
    let seed = 999
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    let humanWins = 0
    for (let g = 0; g < 400; g++) {
      const result = playGame({ level: 'rookie', xStrategy: perfectX, rng })
      if (result === 'X') humanWins++
    }
    expect(humanWins).toBeGreaterThan(0)
  })
})

/** A deterministic PRNG factory so skill-based games are reproducible. */
function makeRng(seed) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

/** Play a full game; O uses `aiMoveBySkill(skill)`, X uses the supplied strategy. */
function playSkillGame({ skill, xStrategy, rng }) {
  let board = emptyBoard()
  let turn = 'X'
  while (!winner(board)) {
    const move = turn === 'X' ? xStrategy(board) : aiMoveBySkill(board, 'O', skill, rng)
    if (move < 0) break
    board = applyMove(board, move, turn)
    turn = otherMark(turn)
  }
  return winner(board)
}

describe('aiMoveBySkill — the skill dial', () => {
  it('at skill 1.0 always plays bestMove (deterministic via rng)', () => {
    const rng = () => 0 // 0 < 1 -> always the perfect branch
    const boards = [
      emptyBoard(),
      B('X........'),
      B('XX..O....'), // O must block at 2
      B('OO.XX.X..'), // O can win at 2
      B('X...O...X'),
      B('XOX.O....'),
    ]
    for (const board of boards) {
      if (winner(board) || emptyCells(board).length === 0) continue
      expect(aiMoveBySkill(board, 'O', 1, rng)).toBe(bestMove(board, 'O'))
    }
  })

  it('at skill 1.0 NEVER loses to a random human (perfect O, many games)', () => {
    const rng = makeRng(20260715)
    const randomX = (board) => {
      const cells = emptyCells(board)
      return cells[Math.floor(rng() * cells.length)]
    }
    for (let g = 0; g < 3000; g++) {
      const result = playSkillGame({ skill: 1, xStrategy: randomX, rng })
      expect(result === 'X').toBe(false) // the human can never win
      expect(['O', 'draw']).toContain(result)
    }
  })

  it('at skill 1.0, perfect vs perfect is always a draw', () => {
    const result = playSkillGame({ skill: 1, xStrategy: perfectX, rng: () => 0 })
    expect(result).toBe('draw')
  })

  it('at skill 0.0 (blunder branch forced) picks a legal empty cell', () => {
    // Any rng returning >= 0 never satisfies rng() < 0, so it's always the
    // random-legal branch. Try a large rng too to stress the modulo.
    for (const rng of [() => 0, () => 0.5, () => 0.999999]) {
      const boards = [emptyBoard(), B('X.O.X.O..'), B('XOX.O...X'), B('X........')]
      for (const board of boards) {
        if (winner(board) || emptyCells(board).length === 0) continue
        const move = aiMoveBySkill(board, 'O', 0, rng)
        expect(emptyCells(board)).toContain(move)
      }
    }
  })

  it('returns -1 on a finished or full board', () => {
    expect(aiMoveBySkill(B('XOXXOOOXX'), 'O', 0.5)).toBe(-1) // full draw board
    expect(aiMoveBySkill(B('XXX......'), 'O', 0.5)).toBe(-1) // X already won
  })

  it('clamps out-of-range skill (>1 acts perfect, <0 acts random)', () => {
    const board = B('OO.XX.X..') // O can win at 2
    expect(aiMoveBySkill(board, 'O', 5, () => 0.9)).toBe(bestMove(board, 'O'))
    // skill -1 -> p clamped to 0 -> always random-legal branch.
    const rndBoard = B('X........')
    expect(emptyCells(rndBoard)).toContain(aiMoveBySkill(rndBoard, 'O', -1, () => 0.1))
  })
})

describe('authored tic-tac-toe levels — the 20-level climb', () => {
  it('has 20 levels split 10 easy / 6 medium / 4 hard', () => {
    expect(ticTacToeLevels).toHaveLength(20)
    const counts = { easy: 0, medium: 0, hard: 0 }
    for (const l of ticTacToeLevels) counts[l.difficulty]++
    expect(counts).toEqual({ easy: 10, medium: 6, hard: 4 })
  })

  it('ids are 1..20, unique and ordered', () => {
    const ids = ticTacToeLevels.map((l) => l.id)
    expect(ids).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    expect(new Set(ids).size).toBe(20)
  })

  it('every level has a name (string) and a difficulty', () => {
    for (const l of ticTacToeLevels) {
      expect(typeof l.name).toBe('string')
      expect(l.name.length).toBeGreaterThan(0)
      expect(['easy', 'medium', 'hard']).toContain(l.difficulty)
    }
  })

  it('skill is in [0,1] and monotonically non-decreasing across ids 1..20', () => {
    let prev = -Infinity
    for (const l of ticTacToeLevels) {
      expect(typeof l.skill).toBe('number')
      expect(l.skill).toBeGreaterThanOrEqual(0)
      expect(l.skill).toBeLessThanOrEqual(1)
      expect(l.skill).toBeGreaterThanOrEqual(prev) // never gets easier
      prev = l.skill
    }
  })

  it('level 20 is perfect (skill == 1.0) and so is level 19', () => {
    const byId = (id) => ticTacToeLevels.find((l) => l.id === id)
    expect(byId(20).skill).toBe(1)
    expect(byId(19).skill).toBe(1)
  })
})
