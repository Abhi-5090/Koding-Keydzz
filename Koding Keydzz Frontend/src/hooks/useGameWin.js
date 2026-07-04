import { useCallback, useState } from 'react'
import useLevelReward from './useLevelReward'

/**
 * useGameWin — convenience wrapper for the single-level mini-games (everything
 * except the multi-level Maze). Drives the GameShell win overlay from the
 * backend award instead of hardcoded client numbers.
 *
 *   const { reward, alreadyMastered, claim, resetWin } = useGameWin('treasure-hunt')
 *   // when the player wins:
 *   claim({ difficulty: 'medium', stars: 3 })
 *   // then in <GameShell xp={reward.xp} coins={reward.coins} alreadyMastered={alreadyMastered} />
 *
 * Because useLevelReward invalidates the Dashboard tag, the topbar XP/level/coins
 * refresh automatically once the award resolves.
 */
export default function useGameWin(gameKey) {
  const { award } = useLevelReward()
  const [reward, setReward] = useState({ xp: 0, coins: 0 })
  const [alreadyMastered, setAlreadyMastered] = useState(false)

  const claim = useCallback(
    async ({ levelId = 1, difficulty = 'easy', stars = 3 } = {}) => {
      const res = await award({ gameKey, levelId, difficulty, stars })
      const awarded = res?.awarded || { xp: 0, coins: 0 }
      if (res?.alreadyCompleted) setAlreadyMastered(true)
      setReward({ xp: awarded.xp || 0, coins: awarded.coins || 0 })
      return res
    },
    [award, gameKey]
  )

  const resetWin = useCallback(() => {
    setReward({ xp: 0, coins: 0 })
    setAlreadyMastered(false)
  }, [])

  return { reward, alreadyMastered, claim, resetWin }
}
