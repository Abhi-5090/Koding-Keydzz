/**
 * Migration: allow multiple quiz attempts per student.
 *
 * The QuizAttempt collection carried a UNIQUE index on (user, quiz), which
 * meant only a student's first attempt was ever stored — so a child who failed
 * once could never earn the quiz's credit, and teachers only ever saw that
 * first score. The model now records every attempt.
 *
 * This script drops the obsolete unique index and backfills the new fields on
 * existing rows. It is idempotent and safe to re-run.
 *
 *   node scripts/migrate-quiz-attempts.mjs
 */
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { QuizAttempt } from '../src/models/QuizAttempt.js';

await connectDB();

const collection = mongoose.connection.collection('quizattempts');

/*
 * 1) Drop the old unique index if it is still present.
 *
 * The collection may not exist at all on a brand-new database, in which case
 * listing its indexes raises NamespaceNotFound (code 26). That is a success
 * case for a migration — there is nothing to migrate — so it must not abort
 * the run and take the second migration down with it.
 */
let indexes = [];
try {
  indexes = await collection.indexes();
} catch (err) {
  if (err?.code === 26 || /NamespaceNotFound/i.test(err?.codeName || '')) {
    console.log('No quizattempts collection yet — nothing to migrate.');
  } else {
    throw err;
  }
}

const legacy = indexes.find(
  (i) => i.unique && i.key && i.key.user === 1 && i.key.quiz === 1 && Object.keys(i.key).length === 2
);
if (legacy) {
  await collection.dropIndex(legacy.name);
  console.log(`Dropped legacy unique index: ${legacy.name}`);
} else if (indexes.length) {
  console.log('No legacy unique index found (already migrated).');
}

// 2) Backfill the new fields on pre-existing attempts.
const backfilled = await QuizAttempt.updateMany(
  { attemptNumber: { $exists: false } },
  [
    {
      $set: {
        attemptNumber: 1,
        // Anything that had already passed was the row that paid out.
        awarded: { $ifNull: ['$passed', false] },
        coinsEarned: { $cond: [{ $ifNull: ['$passed', false] }, 15, 0] },
      },
    },
  ]
);
console.log(`Backfilled ${backfilled.modifiedCount} existing attempt(s).`);

// 3) Ensure the new indexes exist.
await QuizAttempt.syncIndexes();
console.log('Indexes synced.');

await disconnectDB();
console.log('Migration complete.');
process.exit(0);
