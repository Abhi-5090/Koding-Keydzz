import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { api, BASE, auth, login, makeOrg, makeUser, resetDb, connectTestDb, disconnectTestDb } from './harness.js';

/**
 * WHO MAY READ THE METRICS.
 *
 * The endpoint publishes request volume, error rate, uptime and which language
 * runtimes are installed, so it should not be world-readable in production —
 * hence `METRICS_TOKEN`.
 *
 * But there are TWO kinds of caller, and the first version of the guard only
 * accepted one:
 *
 *   • a SCRAPER, which presents the token and has no session;
 *   • a PLATFORM OWNER, reading the System Health panel in the admin portal,
 *     whose browser sends their JWT.
 *
 * The panel cannot be asked to send `METRICS_TOKEN` — that would mean shipping
 * a server secret to a browser. So the moment an operator set the variable to
 * secure the endpoint, the product's own health panel started answering 401.
 * Setting a variable to secure something must not break the feature built to
 * read it.
 */
describe('metrics access', () => {
  let org;
  let superToken;
  let adminToken;
  let pupilToken;
  let previousToken;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    org = await makeOrg('Metrics School');
    adminToken = (await login(org.admin.email)).accessToken;

    const owner = await makeUser({
      role: 'superadmin',
      name: 'Platform Owner',
      email: 'owner@platform.test',
      org: null,
    });
    superToken = (await login(owner.email)).accessToken;

    await makeUser({
      role: 'student',
      name: 'Metrics Pupil',
      username: 'metricspupil',
      org: org.org._id,
    });
    pupilToken = (await login('metricspupil')).accessToken;

    previousToken = process.env.METRICS_TOKEN;
  });

  /**
   * Restored in `afterEach`, not at the end of each test body.
   *
   * An inline restore is skipped when an assertion fails, and the leaked
   * variable then breaks every later FILE in the same worker — which is
   * exactly the cross-file contamination this suite has been bitten by before.
   */
  afterEach(() => {
    if (previousToken === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = previousToken;
  });

  describe('with no METRICS_TOKEN configured', () => {
    beforeEach(() => {
      delete process.env.METRICS_TOKEN;
    });

    it('is open, so an existing scraper keeps working', async () => {
      const res = await api().get(`${BASE}/metrics`);
      expect(res.status).toBe(200);
    });
  });

  describe('with METRICS_TOKEN configured', () => {
    const TOKEN = 'a-metrics-token-of-known-length';

    beforeEach(() => {
      process.env.METRICS_TOKEN = TOKEN;
    });

    it('REFUSES an anonymous request', async () => {
      const res = await api().get(`${BASE}/metrics`);
      expect(res.status).toBe(401);
    });

    it('accepts the token in a Bearer header', async () => {
      const res = await api().get(`${BASE}/metrics`).set({ Authorization: `Bearer ${TOKEN}` });
      expect(res.status).toBe(200);
    });

    it('accepts the token as a query parameter, for scrapers that cannot set headers', async () => {
      const res = await api().get(`${BASE}/metrics`).query({ token: TOKEN });
      expect(res.status).toBe(200);
    });

    it('refuses a WRONG token of the same length', async () => {
      // Same length so the comparison cannot short-circuit on length alone.
      const wrong = 'b-metrics-token-of-known-length';
      expect(wrong.length).toBe(TOKEN.length);
      const res = await api().get(`${BASE}/metrics`).set({ Authorization: `Bearer ${wrong}` });
      expect(res.status).toBe(401);
    });

    it('ACCEPTS A SIGNED-IN PLATFORM OWNER — the bug this file exists for', async () => {
      /**
       * The System Health panel sends the superadmin's JWT, not the metrics
       * token. Without this branch, securing the endpoint broke the only
       * screen in the product that reads it.
       */
      const res = await api().get(`${BASE}/metrics`).set(auth(superToken));
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.data.runners).toBeTruthy();
    });

    it('refuses a school ADMINISTRATOR', async () => {
      // Platform-wide operational data is the platform owner's, not a
      // customer's — a school admin has no business reading it.
      const res = await api().get(`${BASE}/metrics`).set(auth(adminToken));
      expect(res.status).toBe(401);
    });

    it('refuses a pupil', async () => {
      const res = await api().get(`${BASE}/metrics`).set(auth(pupilToken));
      expect(res.status).toBe(401);
    });

    it('refuses an expired or garbage JWT without throwing', async () => {
      // `optionalAuth` must swallow a bad token and continue as anonymous,
      // not 500 — otherwise a stale tab crashes the endpoint.
      const res = await api()
        .get(`${BASE}/metrics`)
        .set({ Authorization: 'Bearer not.a.real.token' });
      expect(res.status).toBe(401);
    });
  });
});
