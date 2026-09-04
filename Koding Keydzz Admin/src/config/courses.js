/**
 * THE COURSE LADDER, as the admin app labels it.
 *
 * Mirrors `Koding Keydzz Backend/src/config/courses.js` — the server is the
 * source of truth for what a course IS; this is only how the portal names and
 * colours it in tabs and headings.
 *
 * It exists because the list was written out twice, in the question bank and in
 * the results page, and the two copies had already drifted: one called the
 * second course "C" and the other "C Programming". Staff moving between the two
 * screens could not tell whether they were looking at the same course.
 *
 * When a course is added to the backend config, add it here too. Anything that
 * needs a course's real STATE — published, locked, ordered — must ask the API;
 * this is labels only.
 */
export const COURSES = [
  { slug: 'python', title: 'Python', short: 'Python', tint: '#34D399' },
  { slug: 'c', title: 'C Programming', short: 'C', tint: '#47A6F0' },
  { slug: 'html', title: 'HTML & CSS', short: 'HTML', tint: '#E8A63D' },
  { slug: 'ai', title: 'AI & Prompting', short: 'AI', tint: '#9E86F5' },
];

/** The first course, used as the default tab everywhere. */
export const DEFAULT_COURSE_SLUG = COURSES[0].slug;

/** Look one up, falling back to the first rather than returning undefined. */
export function courseBySlug(slug) {
  return COURSES.find((c) => c.slug === slug) || COURSES[0];
}

export default COURSES;
