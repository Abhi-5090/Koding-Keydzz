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
 * THE SUITE RUNS AGAINST A KNOWN CONFIGURATION, NOT THE DEVELOPER'S.
 *
 * `src/config/env.js` calls `dotenv.config()`, so every variable in a personal
 * `.env` reaches the tests. That is fine for a database URL and fatal for
 * anything that changes BEHAVIOUR: an operator setting `METRICS_TOKEN` to
 * secure their own deployment made `observability.test.js` fail on a machine
 * where nothing about observability had changed — the endpoint simply started
 * answering 401.
 *
 * A test suite whose result depends on an untracked file is not a test suite.
 * So the behaviour-changing variables are neutralised here, and any test that
 * needs one sets it explicitly for itself and restores it afterwards (see
 * metricsAccess.test.js and passwordReset.test.js).
 */
/*
 * SET EMPTY, never `delete`.
 *
 * `dotenv.config()` runs when `src/config/env.js` is first imported — AFTER
 * this file — and it skips any key already present in `process.env` but
 * happily fills in one that is absent. So deleting a variable here does not
 * neutralise it; it hands dotenv permission to put the developer's value back.
 *
 * An empty string counts as present, so dotenv leaves it alone, and every
 * consumer treats it as unset because they all test truthiness.
 */
process.env.METRICS_TOKEN = '';
process.env.MAIL_TRANSPORT = '';
process.env.SMTP_HOST = '';
// An ENUM in the schema, so it takes its real default rather than an empty
// string — which validates as a value and fails startup.
process.env.ALLOW_STUDENT_SIGNUP = 'false';
process.env.ALLOW_REMOTE_TEST_DB = '';

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
