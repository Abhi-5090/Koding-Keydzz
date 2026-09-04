import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Both suites run by default (`npm test`), which is what CI executes:
    //   tests/*.test.js            pure unit tests, no I/O
    //   tests/integration/*.test.js real HTTP + real MongoDB
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],

    /**
     * ONE DATABASE PER RUN.
     *
     * This config module is evaluated once, in the main vitest process, so
     * `process.pid` here is a single value shared by every worker of THIS run
     * and different from every other run's. `tests/setup.js` appends it to the
     * default database name.
     *
     * `fileParallelism: false` below already stops files WITHIN a run from
     * interleaving. What it cannot stop is two RUNS overlapping — a second
     * `npm test` started before the first finished, a watch process left
     * running, a developer and a script going at once. They share the database,
     * and since every file empties it in `beforeEach` and drops it in
     * `afterAll`, each run deletes the other's fixtures underneath it.
     *
     * The result is not a clean failure. It is a scatter of unrelated-looking
     * errors — "Course not found", "User no longer exists", an E11000 on
     * `courses.slug`, a question bank that reports 1 question where 10 were
     * seeded — landing in whichever file happened to be running. It reads
     * exactly like a real intermittent bug in the application, and it cost a
     * long diagnosis before the cause turned out to be two overlapping runs.
     *
     * Isolating per run makes the whole class of failure impossible instead of
     * something to remember. An explicit MONGO_URI is still honoured untouched,
     * which is what CI uses — there the database is a throwaway container.
     */
    env: { MONGO_TEST_DB_SUFFIX: String(process.pid) },

    // Integration tests within a run share one database, so files must not
    // interleave. (Each file resets the DB in beforeEach.)
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
