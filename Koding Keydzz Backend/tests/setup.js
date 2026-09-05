// Test environment defaults.
//
// The integration suite needs a REAL MongoDB (see tests/integration/harness.js)
// and refuses to run against a database whose name doesn't look like a test DB.
// The unit tests never touch it.
//
// The database name carries a per-RUN suffix (see the `env` block in
// vitest.config.js for why): every worker of one run shares it, and no two runs
// share it, so two overlapping `npm test` invocations cannot delete each
// other's fixtures. An explicit MONGO_URI is honoured exactly as given, which
// is what CI passes.
const testDbSuffix = process.env.MONGO_TEST_DB_SUFFIX;
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  `mongodb://127.0.0.1:27017/koding_keydzz_test${testDbSuffix ? `_${testDbSuffix}` : ''}`;
// Long enough to satisfy the production secret-strength checks if NODE_ENV is
// ever flipped, and clearly non-production values.
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test_access_secret_0123456789abcdefghij';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_0123456789abcdefghij';
process.env.NODE_ENV = 'test';

/**
 * HASH AT THE FLOOR IN TESTS, NOT AT THE PRODUCTION COST.
 *
 * Production uses bcrypt cost 12. Each step doubles the work, so the suite —
 * which creates hundreds of fixture users and signs in constantly — pays four
 * times the hashing cost of the old value. Measured: one integration file went
 * from ~25s to 96s, almost all of it bcrypt.
 *
 * 10 is the FLOOR the model enforces, so this cannot be used to test something
 * weaker than the product has ever shipped, and it is the value every existing
 * hash in the database was written with anyway.
 *
 * `passwordHashUpgrade.test.js` overrides this back to 12 for its own
 * assertions, because the thing it tests IS the cost — so the security
 * property stays covered while the other 850 tests stay fast.
 */
process.env.BCRYPT_COST = process.env.BCRYPT_COST || '10';

/**
 * NEVER let the test suite execute code over the network.
 *
 * `runCode` defaults to CODE_RUNNER='auto', which tries a local interpreter
 * and then falls back to Piston — a THIRD-PARTY service at emkc.org. Left on
 * auto, the suite makes real outbound HTTP calls whenever a local interpreter
 * is missing or slow, which means:
 *
 *   • tests fail for reasons unrelated to the code under test (this was the
 *     source of intermittent failures in the final-test marking suite, where a
 *     slow runner turned into lost marks on a "perfect paper");
 *   • CI depends on an external service being up;
 *   • test code is sent to somebody else's server.
 *
 * 'local' keeps execution on this machine, and returns a deterministic
 * offline notice when no interpreter is installed rather than reaching out.
 */
process.env.CODE_RUNNER = 'local';
