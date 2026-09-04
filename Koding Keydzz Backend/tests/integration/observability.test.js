import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, BASE, connectTestDb, disconnectTestDb } from './harness.js';
import { normalisePath, resetMetrics } from '../../src/middlewares/metrics.js';

/**
 * OBSERVABILITY.
 *
 * `/health` returning `{status:'ok'}` answered the least useful question — the
 * process is almost always alive. These endpoints answer the ones that matter,
 * and one of them is the reason this exists at all:
 *
 *   AN INSTANCE WITH NO CODE TOOLCHAIN IS "HEALTHY" AND CANNOT MARK AN EXAM.
 *
 * Coding answers then grade as `needsReview` — correctly, since failing a pupil
 * for a server misconfiguration would be worse — and a whole cohort's papers
 * land silently in a marking queue with nothing reporting the cause.
 */
describe('observability', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('keeps liveness trivial and dependency-free', async () => {
    // A load balancer hits this constantly; it must never touch the database.
    const res = await api().get(`${BASE}/health`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('reports readiness, including whether a code toolchain exists', async () => {
    const res = await api().get(`${BASE}/ready`);
    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe('connected');
    // The signal nothing else in the system provided.
    expect(res.body.data).toHaveProperty('runners');
    expect(res.body.data).toHaveProperty('missingRunners');
  });

  it('says IN WORDS what a missing toolchain means', async () => {
    /**
     * An operator reading a dashboard should not have to know that
     * `runners.python: null` means "exams cannot be marked". The consequence
     * is spelled out, because that is the whole value of the signal.
     */
    const res = await api().get(`${BASE}/ready`);
    const { missingRunners, warning } = res.body.data;

    if (missingRunners.length) {
      expect(warning).toMatch(/flagged for manual marking/i);
      expect(warning).toContain(missingRunners[0]);
    } else {
      expect(warning).toBeNull();
    }
  });

  it('exposes metrics as JSON', async () => {
    const res = await api().get(`${BASE}/metrics`);
    expect(res.status).toBe(200);
    expect(res.body.data.requests).toHaveProperty('total');
    expect(res.body.data.requests).toHaveProperty('errorRate');
    expect(Array.isArray(res.body.data.slowestRoutes)).toBe(true);
  });

  it('exposes metrics in Prometheus format for a scraper', async () => {
    const res = await api().get(`${BASE}/metrics?format=prometheus`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('# TYPE kk_requests_total counter');
    // The alert-worthy gauge.
    expect(res.text).toContain('kk_code_runner_available');
    expect(res.text).toContain('kk_db_connected');
  });

  it('counts requests that FAIL, not just successful ones', async () => {
    /**
     * Metrics mounted after the routes would only ever see what succeeded,
     * hiding precisely the problems worth seeing. This is why the middleware
     * sits above both the rate limiter and the router.
     */
    resetMetrics();
    await api().get(`${BASE}/definitely-not-a-route`);

    const res = await api().get(`${BASE}/metrics`);
    expect(res.body.data.requests.byStatusClass['4xx']).toBeGreaterThan(0);
  });

  it('reports an error RATE, not a bare count', async () => {
    // 50 errors is fine at a million requests and an outage at sixty.
    const res = await api().get(`${BASE}/metrics`);
    const { errorRate } = res.body.data.requests;
    expect(errorRate).toBeGreaterThanOrEqual(0);
    expect(errorRate).toBeLessThanOrEqual(1);
  });
});

describe('metric path normalisation', () => {
  /**
   * Grouping by ROUTE rather than URL is what keeps the metric set bounded.
   * Without it, every id becomes its own series — the classic cardinality
   * mistake, which turns a counter map into a memory leak and makes the data
   * useless at the same time.
   */
  it('collapses Mongo ids', () => {
    expect(normalisePath('/api/v1/admin/students/507f1f77bcf86cd799439011')).toBe(
      '/api/v1/admin/students/:id'
    );
  });

  it('collapses ids in the middle of a path', () => {
    expect(
      normalisePath('/api/v1/admin/classrooms/507f1f77bcf86cd799439011/students')
    ).toBe('/api/v1/admin/classrooms/:id/students');
  });

  it('collapses numeric ids', () => {
    expect(normalisePath('/api/v1/worlds/12/lessons')).toBe('/api/v1/worlds/:n/lessons');
  });

  it('collapses certificate codes', () => {
    // Otherwise every verified certificate becomes a permanent metric series.
    expect(normalisePath('/api/v1/certificates/verify/KK-ABCD-EFGH-JKLM')).toBe(
      '/api/v1/certificates/verify/:code'
    );
  });

  it('drops the query string', () => {
    expect(normalisePath('/api/v1/admin/students?limit=100&page=2')).toBe(
      '/api/v1/admin/students'
    );
  });

  it('leaves a plain route alone', () => {
    expect(normalisePath('/api/v1/courses')).toBe('/api/v1/courses');
  });
});
