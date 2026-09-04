import { useCallback, useMemo, useState } from 'react'
import useLevelReward from '../../hooks/useLevelReward'

/**
 * useGameLevels(gameKey, levels) — shared progress + reward hook for any
 * leveled mini-game.
 *
 * Best stars per level persist to localStorage under `kk_<gameKey>_progress`
 * ({ [levelId]: bestStars }, max kept on replay).
 *
 * Unlock rule: the first level (index 0) is always open; finishing a level
 * with >= 1 star unlocks the next one in the ordered `levels` array.
 *
 * @param {string} gameKey  game slug (e.g. 'robot-navigation')
 * @param {Array}  levels   the ordered level list (used for unlock chaining)
 *
 * Returns:
 *   progress       -> { [levelId]: bestStars }  (read-only snapshot)
 *   bestStars(id)  -> number (0 if never beaten)
 *   isUnlocked(level, index) -> boolean
 *   totalStars     -> number (sum of best stars across all levels)
 *   completedCount -> number (levels with >= 1 star)
 *   completeLevel(level, stars, metrics?) -> Promise<awardResult>
 *      updates the local best (keeps max) AND calls the backend reward path
 *      (useLevelReward -> POST /games/complete) with
 *      { gameKey, levelId:level.id, difficulty:level.difficulty, stars }.
 *      `metrics = { moves, timeMs, performance }`:
 *        - moves / timeMs feed the move-count and time leaderboards (only
 *          finite values are sent),
 *        - performance = { hintsUsed, mistakes, outcome?, optimalPath?,
 *          cleanCode? } is HOW THE RUN WENT, and the server grades the stars
 *          from it. Pass it: a run that reports nothing is graded at two
 *          stars, so omitting it silently costs the player the perfect bonus.
 *      Resolves to the backend award result
 *      ({ awarded:{xp,coins}, alreadyCompleted, best, levelRank, ... }).
 *      Never throws.
 */
export default function useGameLevels(gameKey, levels = []) {
  const storageKey = `kk_${gameKey}_progress`
  const { award } = useLevelReward()

  const [progress, setProgress] = useState(() => readProgress(storageKey))

  const bestStars = useCallback((levelId) => progress[levelId] || 0, [progress])

  const isUnlocked = useCallback(
    (level, index) => {
      if (index <= 0) return true
      const prev = levels[index - 1]
      if (!prev) return true
      return (progress[prev.id] || 0) >= 1
    },
    [levels, progress]
  )

  const totalStars = useMemo(
    () => levels.reduce((sum, l) => sum + (progress[l.id] || 0), 0),
    [levels, progress]
  )

  const completedCount = useMemo(
    () => levels.filter((l) => (progress[l.id] || 0) >= 1).length,
    [levels, progress]
  )

  /**
   * Write a level's star count to local progress.
   *
   * By default this keeps the MAXIMUM, so replaying a level worse never erases
   * a better result. `authoritative` overrides that: the server's `bestStars`
   * is already the best-ever across every attempt, so when it comes back it
   * REPLACES the local value — including downwards. Without that escape hatch
   * an optimistic three would be permanently stuck above a server grade of
   * two, and the player's total would never agree with their account.
   */
  const recordLocal = useCallback(
    (levelId, stars, { authoritative = false } = {}) => {
      setProgress((prev) => {
        const current = prev[levelId] || 0
        const next = authoritative ? stars : Math.max(current, stars)
        if (next === current && levelId in prev) return prev
        const updated = { ...prev, [levelId]: next }
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated))
        } catch {
          /* storage unavailable — keep in-memory only */
        }
        return updated
      })
    },
    [storageKey]
  )

  const completeLevel = useCallback(
    async (level, stars, metrics = {}) => {
      const clamped = Math.max(0, Math.min(3, Math.round(stars)))
      // Record the local best straight away so the level grid updates even if
      // the request is slow or the device is offline.
      recordLocal(level.id, clamped)

      const { moves, timeMs, performance } = metrics || {}
      const result = await award({
        gameKey,
        levelId: level.id,
        difficulty: level.difficulty,
        stars: clamped,
        ...(Number.isFinite(moves) ? { moves } : {}),
        ...(Number.isFinite(timeMs) ? { timeMs } : {}),
        ...(performance ? { performance } : {}),
      })

      // The SERVER grades the stars, so its answer wins over the optimistic
      // local one. Without this the grid could show three stars for a run the
      // server graded at two, and the player would never see the real total.
      if (!result?.error && Number.isFinite(result?.bestStars)) {
        recordLocal(level.id, Math.max(0, Math.min(3, Math.round(result.bestStars))), {
          authoritative: true,
        })
      }
      return result
    },
    [award, gameKey, recordLocal]
  )

  return {
    progress,
    bestStars,
    // recordStars(levelId, stars) -> persists the local best only (keeps the
    // max), WITHOUT calling the backend. Use this when a play screen already
    // performs its own reward award via gameKey (e.g. the shared code-writing
    // PlayScreen). completeLevel bundles both; recordStars is the local half.
    recordStars: recordLocal,
    isUnlocked,
    totalStars,
    completedCount,
    completeLevel,
  }
}

/** Read & sanitize the {id: bestStars} map from localStorage. */
function readProgress(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const clean = {}
    for (const [id, stars] of Object.entries(parsed)) {
      const n = Number(stars)
      if (Number.isFinite(n) && n >= 0 && n <= 3) clean[id] = Math.floor(n)
    }
    return clean
  } catch {
    return {}
  }
}
