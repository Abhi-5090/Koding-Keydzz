/**
 * Integration-test harness: a real Express app against a real MongoDB.
 *
 * WHY THIS EXISTS
 * ---------------
 * The suite used to be 172 pure-function tests with no HTTP request and no
 * database — `supertest` was installed but imported nowhere. Every serious
 * defect found in the production readiness review lived in exactly that
 * untested layer: tenant isolation, route authorization, the reward endpoint,
 * and the socket reward path. Unit tests could not have caught any of them.
 *
 * These tests therefore drive the actual app over HTTP, against a real Mongo,
 * with real JWTs — the same way a client (or an attacker) does.
 */
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Organization } from '../../src/models/Organization.js';
import { World } from '../../src/models/World.js';
import { Lesson } from '../../src/models/Lesson.js';
import { Quiz } from '../../src/models/Quiz.js';
import { AvatarItem } from '../../src/models/AvatarItem.js';
import { Achievement } from '../../src/models/Achievement.js';
import { Challenge } from '../../src/models/Challenge.js';
import { Notification } from '../../src/models/Notification.js';
import { QuizAttempt } from '../../src/models/QuizAttempt.js';
import { GameScore } from '../../src/models/GameScore.js';
import { AuditLog } from '../../src/models/AuditLog.js';

export const app = createApp();

/**
 * A REQUEST THAT FAILS SHOULD SAY WHY.
 *
 * Tests read `res.body.data` directly, so a request that returns an error
 * envelope surfaces as `Cannot read properties of undefined (reading 'x')` —
 * with no status, no path and no server message. Diagnosing an intermittent
 * failure from that is guesswork, and it cost three wrong hypotheses (rate
 * limiting, an attempt cooldown, state leaking between files) before this was
 * added.
 *
 * So every unexpected 4xx/5xx during a test run prints one greppable line with
 * the method, path, status and the server's own message. It changes no
 * assertion — tests that deliberately assert on a 401 or 403 still pass — it
 * only makes the failure legible. `EXPECT_HTTP_ERRORS=quiet` silences it.
 */
export const api = () => {
  const agent = request(app);
  for (const method of ['get', 'post', 'patch', 'put', 'delete']) {
    const original = agent[method].bind(agent);
    agent[method] = (url) => {
      const test = original(url);
      const originalThen = test.then.bind(test);
      test.then = (resolve, reject) =>
        originalThen((res) => {
          if (res?.status >= 400 && process.env.EXPECT_HTTP_ERRORS !== 'quiet') {
            const detail =
              res.body?.message ??
              // An EMPTY body on an error is the interesting case: our own
              // handlers always set a message, so a bodyless error did not
              // come from them. Dump the content type and raw text to say
              // where it DID come from.
              `[no message] content-type=${res.headers?.['content-type']} text=${String(
                res.text ?? ''
              ).slice(0, 200)}`;
            console.warn(
              `[test http] ${method.toUpperCase()} ${url} -> ${res.status} ${JSON.stringify(detail)}`
            );
          }
          return resolve ? resolve(res) : res;
        }, reject);
      return test;
    };
  }
  return agent;
};
export const BASE = '/api/v1';

/* -------------------------------------------------------------------------- */
/* Guarding the real database                                                 */
/* -------------------------------------------------------------------------- */

/**
 * THIS SUITE DELETES DATA. THESE GUARDS ARE THE ONLY THING BETWEEN IT AND
 * WHATEVER `MONGO_URI` HAPPENS TO NAME.
 *
 * `resetDb` empties every registered collection and `disconnectTestDb` drops
 * the database outright, so a stray `MONGO_URI` in the environment — a shell
 * that still has production exported, a copied `.env`, a CI secret pasted into
 * the wrong variable — is a data-loss event, not a failed test run.
 *
 * The previous guard was a single `/test|ci/i` applied to the WHOLE URI, and it
 * had three holes worth naming, because each one is a way this fires for real:
 *
 *   1. It matched anywhere in the string, INCLUDING THE CREDENTIALS. A password
 *      that merely contains "ci" — `Pr3ciou5` — satisfies it, and the suite
 *      then wipes the production database the URI actually points at. Random
 *      generated passwords hit a two-letter substring often.
 *   2. `disconnectTestDb` calls `dropDatabase()` with no check of its own, so
 *      anything that reached a connection by another route was unprotected.
 *   3. It said nothing about the HOST. A test run has no business opening a
 *      connection to a remote cluster at all, whatever the database is called.
 *
 * So the checks below read the database NAME and the HOST separately, and run
 * again at every destructive call site against the name Mongoose actually
 * resolved — not the string we hoped it would parse to.
 */

/** Split a connection string without being fooled by its credentials. */
export function parseMongoUri(uri) {
  const bare = String(uri).replace(/^mongodb(\+srv)?:\/\//i, '');
  const isSrv = /^mongodb\+srv:/i.test(uri);

  // `lastIndexOf` rather than `split('@')`: a password may legally contain '@'
  // once percent-decoded, and taking the first one would read half a password
  // as the host.
  const afterCredentials = bare.slice(bare.lastIndexOf('@') + 1);

  const slash = afterCredentials.indexOf('/');
  const hostPart = slash === -1 ? afterCredentials : afterCredentials.slice(0, slash);
  const rest = slash === -1 ? '' : afterCredentials.slice(slash + 1);

  return {
    isSrv,
    hosts: hostPart
      .split(',')
      .map((h) => h.split(':')[0].trim().toLowerCase())
      .filter(Boolean),
    dbName: rest.split('?')[0].trim(),
  };
}

/** A database name a test run is allowed to destroy. */
export function looksLikeTestDb(name) {
  return /(^|[^a-z])(test|ci)([^a-z]|$)/i.test(String(name));
}

/**
 * Is this host one a test run may talk to?
 *
 * Loopback covers a developer's machine and CI alike (the workflow runs Mongo
 * as a service container on 127.0.0.1). A single-label hostname covers the
 * docker-compose service name. Everything else — every dotted domain, and
 * every `mongodb+srv://` URI, which is how Atlas is always addressed — needs
 * the operator to say so explicitly.
 */
export function hostIsLocal(host) {
  if (['127.0.0.1', 'localhost', '::1', '0.0.0.0'].includes(host)) return true;
  if (/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return !host.includes('.');
}

/**
 * The check every destructive operation runs, against the LIVE connection.
 *
 * Re-reading `mongoose.connection.name` rather than trusting the URI we parsed
 * at connect time is the point: it is the database the delete will actually
 * land in, and it is what `dropDatabase()` will drop.
 */
export function assertTestDatabase(action) {
  const { name, host } = mongoose.connection || {};

  if (!name) {
    throw new Error(`Refusing to ${action}: no database connection is open.`);
  }

  if (!looksLikeTestDb(name)) {
    throw new Error(
      `REFUSING TO ${action.toUpperCase()} — "${name}" is not a test database.\n` +
        `  host: ${host || 'unknown'}\n` +
        '  This suite deletes every document it can reach. Point MONGO_URI at a\n' +
        '  database whose NAME contains "test" or "ci".'
    );
  }
}

/**
 * Connect to the test database.
 *
 * Fails LOUDLY rather than skipping: a silently-skipped integration suite is
 * how this whole class of bug survived in the first place.
 */
export async function connectTestDb() {
  const uri =
    process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/koding_keydzz_test';

  const { isSrv, hosts, dbName } = parseMongoUri(uri);

  if (!looksLikeTestDb(dbName)) {
    throw new Error(
      `Refusing to run integration tests against database "${dbName || '(unnamed)'}".\n` +
        '  Point MONGO_URI at a database whose NAME contains "test" or "ci".\n' +
        '  (The name is checked, not the whole URI — a password containing "ci"\n' +
        '   used to be enough to satisfy this guard.)'
    );
  }

  // Two keys, matching how this codebase gates everything else that leaves the
  // machine: a remote host is refused unless the operator has opted in.
  const remote = hosts.filter((h) => !hostIsLocal(h));
  if ((isSrv || remote.length) && process.env.ALLOW_REMOTE_TEST_DB !== '1') {
    throw new Error(
      `Refusing to run integration tests against a REMOTE database: ${remote.join(', ') || hosts.join(', ')}\n` +
        '  This suite empties every collection it can reach and drops the database\n' +
        '  when it finishes. Run it against a local MongoDB:\n\n' +
        '    brew services start mongodb-community\n' +
        '    docker run -d -p 27017:27017 mongo:7\n\n' +
        '  If you genuinely mean to target a remote TEST cluster, set\n' +
        '  ALLOW_REMOTE_TEST_DB=1 — and check which cluster it is first.'
    );
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    throw new Error(
      `Integration tests need a running MongoDB at ${uri}.\n` +
        `  ${err.message}\n\n` +
        '  Start one locally:  brew services start mongodb-community\n' +
        '                 or:  docker run -d -p 27017:27017 mongo:7\n'
    );
  }
}

export async function disconnectTestDb() {
  // The most destructive line in the repository. Guarded on the LIVE
  // connection name, because this drops the database and not just its rows.
  assertTestDatabase('drop the database');
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

/**
 * Empty the test database between tests.
 *
 * Clears every model REGISTERED on the connection. An earlier attempt widened
 * this to every collection in the database via the driver's `listCollections`,
 * on the reasoning that "reset" should mean "empty". That was wrong and caused
 * a 130-test regression: several files seed shared content once in `beforeAll`
 * and reset only per-test data in `beforeEach`, so clearing collections those
 * files had not registered destroyed fixtures they depended on.
 *
 * The narrower contract is the correct one here: clear what this run has
 * touched, and leave the rest alone. Deriving the list from the registered
 * models rather than hand-writing it is what keeps it from falling behind the
 * schema — the hand-written version omitted Classroom, Course, CourseProgress
 * and Session, and those leaked state from one test into the next.
 */
export async function resetDb() {
  assertTestDatabase('delete every document');
  const models = Object.values(mongoose.connection.models);
  await Promise.all(models.map((m) => m.deleteMany({})));
}


/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

export const PASSWORD = 'Test@12345';

/** Create a user directly (bypassing the API) with a known password. */
export async function makeUser({
  role = 'student',
  name = 'Test User',
  email,
  username,
  org = null,
  status = 'active',
  ...rest
}) {
  const user = new User({
    role,
    name,
    ...(email ? { email } : {}),
    ...(username ? { username } : {}),
    org,
    status,
    ...rest,
  });
  await user.setPassword(PASSWORD);
  await user.save();

  return user;
}

/** Create an organization plus its admin. */
export async function makeOrg(label) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const org = await Organization.create({
    name: label,
    slug,
    code: slug.slice(0, 8).toUpperCase(),
    status: 'active',
  });
  const admin = await makeUser({
    role: 'admin',
    name: `${label} Admin`,
    email: `admin@${slug}.test`,
    org: org._id,
  });
  /**
   * Atomic, not a read-modify-save.
   *
   * `org.save()` here builds its update from the document as loaded, so it
   * fails with `DocumentNotFoundError` if anything touched the organization in
   * between — which in a test run is entirely possible. A targeted `$set`
   * cannot conflict. (The same change was made to the login path in
   * authService for the same reason, where it was causing 500s on correct
   * passwords.)
   */
  await Organization.updateOne({ _id: org._id }, { $set: { adminUser: admin._id } });
  org.adminUser = admin._id;

  return { org, admin };
}

/** Log in over the real API and return { accessToken, refreshToken, user }. */
export async function login(identifier, password = PASSWORD) {
  const res = await api()
    .post(`${BASE}/auth/login`)
    .send({ identifier, password });
  if (res.status !== 200) {
    throw new Error(
      `login failed for ${identifier}: ${res.status} ${JSON.stringify(res.body)}`
    );
  }
  return res.body.data;
}

/** Authorization header helper. */
export const auth = (token) => ({ Authorization: `Bearer ${token}` });

/**
 * Minimal platform content so student/content endpoints have something to
 * return. Deliberately small — these tests assert behaviour, not the seed.
 */
export async function seedMinimalContent() {
  const world = await World.create({
    name: 'Test Forest',
    slug: 'test-forest',
    order: 1,
    topics: ['Variables'],
  });
  const lesson = await Lesson.create({
    world: world._id,
    title: 'Variables',
    content: 'A variable holds a value.',
    order: 1,
  });
  const quiz = await Quiz.create({
    title: 'Variables Quiz',
    lesson: lesson._id,
    type: 'mcq',
    xpReward: 50,
    questions: [
      {
        type: 'mcq',
        prompt: 'What holds a value?',
        options: ['a variable', 'a loop'],
        correctAnswer: 'a variable',
        points: 10,
      },
      {
        type: 'mcq',
        prompt: 'Which is a number?',
        options: ['42', 'cat'],
        correctAnswer: '42',
        points: 10,
      },
    ],
  });
  const item = await AvatarItem.create({
    key: 'pet_test',
    name: 'Test Pet',
    type: 'pet',
    price: 50,
    requiredLevel: 1,
  });
  return { world, lesson, quiz, item };
}

/** Correct answers for the fixture quiz, keyed by question id. */
export function correctAnswersFor(quiz) {
  const answers = {};
  for (const q of quiz.questions) answers[String(q._id)] = q.correctAnswer;
  return answers;
}
