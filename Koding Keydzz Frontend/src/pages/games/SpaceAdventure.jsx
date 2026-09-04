import { getGame } from '../../data/games'
import levels from '../../data/spaceLevels'
import LeveledGamePage from '../../components/games/LeveledGamePage'
import OrderingPuzzleGame from '../../components/games/OrderingPuzzleGame'

const GAME_KEY = 'space-adventure'
const game = getGame(GAME_KEY)

/**
 * Space Adventure — 18 ordering-puzzle levels. Arrange the mission steps in the
 * correct order. Built on the shared LeveledGamePage + OrderingPuzzleGame
 * scaffold; progress and rewards persist via useGameLevels.
 */
export default function SpaceAdventure() {
  return (
    <LeveledGamePage
      gameKey={GAME_KEY}
      game={game}
      levels={levels}
      renderPlay={({ level, onExit, onNext, hasNext, completeLevel }) => (
        <OrderingPuzzleGame
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
