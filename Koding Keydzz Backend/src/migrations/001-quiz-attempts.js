/**
 * Migration 001 — quiz attempts moved out of the user document.
 *
 * Wraps the original `scripts/migrate-quiz-attempts.mjs` so it is recorded in
 * `_migrations` like everything else. The script is left in place and still
 * works standalone; this is the path that runs on a deploy.
 *
 * Idempotent: the original was written to be re-runnable, and the runner will
 * only call it once per database anyway.
 */
export const name = '001-quiz-attempts';

export default async function up() {
  // Imported lazily so discovering migrations does not execute their work.
  await import('../../scripts/migrate-quiz-attempts.mjs');
}
