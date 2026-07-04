import { getGame } from '../../data/games'
import levels from '../../data/bugfixLevels'
import LeveledGamePage from '../../components/games/LeveledGamePage'
import QuestionLevelGame from '../../components/games/QuestionLevelGame'

const GAME_KEY = 'bug-fix'
const game = getGame(GAME_KEY)

/**
 * Bug Fix Challenge — 18 question-set levels teaching DEBUGGING. Each level
 * shows short buggy snippets (Python or JS) and asks the player to spot the
 * bug, pick the correct fix, or predict the output. Bugs ramp from beginner
 * typos (= vs ==) to off-by-one, scope, and logic errors. Built on the shared
 * LeveledGamePage + QuestionLevelGame scaffold; progress + rewards persist via
 * useGameLevels.
 */
export default function BugFixChallenge() {
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
