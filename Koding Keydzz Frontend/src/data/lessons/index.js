// Topic lesson content registry.
//
// LESSONS maps a world slug -> { [topicKey]: lesson }, assembled from the
// per-world files. Every lesson follows one shared schema so the lesson
// components can render any of them uniformly:
//
//   {
//     title,      // topic name, e.g. "Variables"
//     tagline,    // one-line hook shown under the title
//     intro,      // 2–4 warm sentences: what it is + why it matters
//     sections:   [{ heading, body, bullets? }],  // the teaching content
//     snippet:    { language, lines: [..], caption },  // runnable, revealed line-by-line
//     tryIt:      { language?, starter, challenge, hint },  // embedded editor seed
//     guide:      [{ step, body }],   // progressive step-by-step tutor
//     takeaways:  ['..', ..],         // 3–5 key points
//   }
//
// Topic keys inside each world file are LOWER-CASE. getLesson() normalises the
// requested topic label to lower-case so it matches whatever casing the API
// sends for world.topics (e.g. "Variables", "Stored Values").

import codingForest from './coding-forest'
import loopMountain from './loop-mountain'
import functionCastle from './function-castle'
import algorithmDesert from './algorithm-desert'
import pythonKingdom from './python-kingdom'

export const LESSONS = {
  'coding-forest': codingForest,
  'loop-mountain': loopMountain,
  'function-castle': functionCastle,
  'algorithm-desert': algorithmDesert,
  'python-kingdom': pythonKingdom,
}

/** Normalise a topic label to its lesson key: trimmed + lower-cased. */
export function normalizeTopic(topic) {
  return String(topic ?? '').trim().toLowerCase()
}

/**
 * Look up an authored lesson for a world + topic. Returns the lesson object,
 * or null when none is authored yet (the modal degrades gracefully).
 */
export function getLesson(slug, topic) {
  const world = LESSONS[slug]
  if (!world) return null
  return world[normalizeTopic(topic)] || null
}

/** True when an authored lesson exists for this world + topic. */
export function hasLesson(slug, topic) {
  return getLesson(slug, topic) !== null
}
