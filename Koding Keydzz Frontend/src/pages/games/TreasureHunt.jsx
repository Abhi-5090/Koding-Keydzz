import { getGame } from '../../data/games'
import levels from '../../data/treasureLevels'
import LeveledGamePage from '../../components/games/LeveledGamePage'
import QuestionLevelGame from '../../components/games/QuestionLevelGame'

const GAME_KEY = 'treasure-hunt'
const game = getGame(GAME_KEY)

/**
 * Treasure Hunt — 18 question-set levels teaching CONDITIONS (if / else).
 * A pirate/jungle treasure-map adventure of path choices: comparisons,
 * boolean logic (AND / OR / NOT), and nested if/else as difficulty rises.
 * Built on the shared LeveledGamePage + QuestionLevelGame scaffold; progress
 * and rewards persist via useGameLevels.
 */
export default function TreasureHunt() {
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
          onComplete={(stars, performance) => completeLevel(level, stars, { performance })}
        />
      )}
    />
  )
}
