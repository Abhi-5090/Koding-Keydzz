import { useCallback, useState } from 'react'

const STORAGE_KEY = 'kk_maze_progress'

/** Read the {id: bestStars} map from localStorage, tolerant of bad data. */
function readProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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

/**
 * Persisted best-stars map keyed by level id.
 *   progress      -> { [id]: bestStars }
 *   bestStars(id) -> number (0 if never beaten)
 *   recordStars(id, stars) -> keeps the max; returns the new best
 *   isUnlocked(id) -> level 1 always; otherwise prev level has >= 1 star
 */
export default function useMazeProgress() {
  const [progress, setProgress] = useState(readProgress)

  const bestStars = useCallback((id) => progress[id] || 0, [progress])

  const recordStars = useCallback((id, stars) => {
    let nextBest = stars
    setProgress((prev) => {
      const current = prev[id] || 0
      nextBest = Math.max(current, stars)
      if (nextBest === current && id in prev) return prev
      const next = { ...prev, [id]: nextBest }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* storage unavailable — keep in-memory state only */
      }
      return next
    })
    return nextBest
  }, [])

  const isUnlocked = useCallback(
    (id) => id <= 1 || (progress[id - 1] || 0) >= 1,
    [progress]
  )

  return { progress, bestStars, recordStars, isUnlocked }
}
