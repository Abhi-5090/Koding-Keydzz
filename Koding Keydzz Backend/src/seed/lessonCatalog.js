import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { C_LESSON_CONTENT } from './cCourse.js';
import { HTML_LESSON_CONTENT } from './htmlCourse.js';
import { AI_LESSON_CONTENT } from './aiCourse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * THE AUTHORED LESSON CONTENT FOR EVERY WORLD, keyed by world slug.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * `seed.js` calls `seed()` at the bottom of the file, so importing anything
 * from it RUNS A FULL SEED as a side effect of the import. Any other script
 * that needs to know which lessons a world is supposed to have — and
 * `scripts/prune-orphans.mjs` needs exactly that, since deciding what is an
 * orphan is impossible without it — cannot safely import from there.
 *
 * WHY GUESSING IS NOT AN OPTION
 * -----------------------------
 * The first version of the prune script inferred the answer by testing a
 * lesson's title against its world's `topics` array. That holds in Python,
 * where the two happen to be identical, and nowhere else:
 *
 *   coding-forest  topics ["Variables", "Stored Values", "Input", "Output"]
 *                  lessons "Variables", "Stored Values", "Input", "Output"
 *
 *   c-workshop     topics ["Your First C Program", "Printing Output", "Compiling"]
 *                  lessons "Your First C Program", "Printing with printf",
 *                          "What the Compiler Does"
 *
 * C, HTML and AI use short labels for the cards and descriptive titles for the
 * lessons, on purpose. The guess therefore flagged seventeen perfectly good
 * lessons as orphans across fifteen worlds, and a script whose job is to
 * delete things must not be working from a guess.
 */
const pythonLessonContent = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'lessonContent.json'), 'utf8')
);

export const ALL_LESSON_CONTENT = {
  ...pythonLessonContent,
  ...C_LESSON_CONTENT,
  ...HTML_LESSON_CONTENT,
  ...AI_LESSON_CONTENT,
};

/** The lesson titles a world is authored to have, or null if it has no content. */
export function authoredTitlesFor(worldSlug) {
  const items = ALL_LESSON_CONTENT[worldSlug];
  if (!Array.isArray(items)) return null;
  return items.map((item) => item.title);
}

export default ALL_LESSON_CONTENT;
