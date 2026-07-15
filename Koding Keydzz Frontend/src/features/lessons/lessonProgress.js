// Lesson progress persistence.
//
// A tiny localStorage-backed store recording which topic lessons a student has
// completed. Keys are `<slug>:<normalizedTopic>` so a completed session is
// stable across worlds and page reloads. Every access is wrapped in try/catch
// so the app keeps working when storage is unavailable (private mode, quota,
// SSR, disabled cookies) — it simply behaves as "nothing completed".
//
//   Stored shape (JSON under STORAGE_KEY):
//     { "coding-forest:variables": true, "loop-mountain:for loops": true, ... }

import { normalizeTopic } from '../../data/lessons'

export const STORAGE_KEY = 'kk_lesson_progress'

/** Build the storage key for a world slug + topic (topic normalised the same
 *  way getLesson() normalises, so progress keys line up with lesson lookups). */
export function topicKey(slug, topic) {
  return `${String(slug ?? '').trim()}:${normalizeTopic(topic)}`
}

/** Read the whole progress map, tolerating missing/corrupt/unavailable storage. */
function readAll() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Persist the whole progress map, swallowing any storage failure. */
function writeAll(map) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    return true
  } catch {
    return false
  }
}

/** True when the given world + topic lesson has been completed. */
export function isTopicComplete(slug, topic) {
  return readAll()[topicKey(slug, topic)] === true
}

/** Mark a world + topic lesson complete and persist. Idempotent. */
export function markTopicComplete(slug, topic) {
  const map = readAll()
  map[topicKey(slug, topic)] = true
  return writeAll(map)
}

/** Count how many of the given topics are completed for a world. */
export function getCompletedCount(slug, topics = []) {
  const map = readAll()
  return (topics || []).reduce(
    (n, topic) => (map[topicKey(slug, topic)] === true ? n + 1 : n),
    0
  )
}
