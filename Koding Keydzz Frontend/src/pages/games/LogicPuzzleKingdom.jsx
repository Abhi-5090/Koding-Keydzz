import { getGame } from '../../data/games'
import levels from '../../data/logicLevels'
import LeveledGamePage from '../../components/games/LeveledGamePage'
import QuestionLevelGame from '../../components/games/QuestionLevelGame'

const GAME_KEY = 'logic-puzzle'
const game = getGame(GAME_KEY)

/**
 * Logic Puzzle Kingdom — 18 question-set levels (true/false, pattern "what
 * comes next", odd-one-out, deduction). Built on the shared LeveledGamePage +
 * QuestionLevelGame scaffold; progress and rewards persist via useGameLevels.
 */
export default function LogicPuzzleKingdom() {
  return (
    <LeveledGamePage
      gameKey={GAME_KEY}
      game={game}
      levels={levels}
      renderPlay={({ level, onExit, onNext, hasNext, completeLevel }) => (
        <QuestionLevelGame
          game={game}
          level={level}
          onExit={onExit}
          onNext={onNext}
          hasNext={hasNext}
          onComplete={(stars) => completeLevel(level, stars)}
        />
      )}
    />
  )
}
