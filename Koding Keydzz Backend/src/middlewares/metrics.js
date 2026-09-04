/**
 * REQUEST METRICS, and the readiness signals that matter operationally.
 *
 * The platform had `/health` returning `{status: 'ok'}` and nothing else. That
 * answers "is the process alive", which is the least useful question — the
 * process is almost always alive. It does not answer:
 *
 *   • are requests failing, and which ones;
 *   • are they slow;
 *   • IS THE CODE RUNNER PRESENT.
 *
 * That last one is the reason this exists. If no Python or C toolchain is
 * installed on a host, every coding answer on a final test silently grades as
 * `needsReview` — the marker withholds the mark rather than failing a pupil for
 * a server misconfiguration, which is right, but it means an entire cohort's
 * exams quietly land in a marking queue and NOTHING reports that the cause is a
 * missing binary. A deployment can be "healthy" and unable to mark an exam.
 *
 * Kept deliberately small: an in-process counter set, no dependency, exposed
 * both as JSON and in Prometheus text format so it can be scraped without
 * committing to a particular stack.
 */

/** Buckets in milliseconds. Chosen around what this API actually does. */
const BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

const state = {
  startedAt: Date.now(),
  total: 0,
  byStatusClass: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
  /** route -> { count, totalMs, max, errors } */
  byRoute: new Map(),
  histogram: new Array(BUCKETS.length + 1).fill(0),
  totalMs: 0,
};

/**
 * Group a path into a ROUTE, not a URL.
 *
 * `/api/v1/admin/students/507f1f77bcf86cd799439011` and a thousand siblings are
 * one route. Without this the metric set grows unboundedly with ids — the
 * classic label-cardinality mistake, which turns a small counter map into a
 * memory leak and makes the data useless anyway.
 */
export function normalisePath(path) {
  return (
    String(path || '')
      .split('?')[0]
      // Mongo ids
      .replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:id')
      // Numeric ids
      .replace(/\/\d+(?=\/|$)/g, '/:n')
      // Certificate codes: KK-XXXX-XXXX-XXXX
      .replace(/\/KK-[A-Z0-9-]+/gi, '/:code') || '/'
  );
}

function bucketFor(ms) {
  for (let i = 0; i < BUCKETS.length; i += 1) {
    if (ms <= BUCKETS[i]) return i;
  }
  return BUCKETS.length;
}

/**
 * Record every request's outcome and duration.
 *
 * Hooked on the response's `finish` event rather than wrapping `res.json`, so
 * it also catches streamed responses, redirects and errors that never reach a
 * controller.
 */
export function metricsMiddleware(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const route = `${req.method} ${normalisePath(req.originalUrl || req.path)}`;
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;

    state.total += 1;
    state.totalMs += ms;
    state.histogram[bucketFor(ms)] += 1;
    if (state.byStatusClass[statusClass] !== undefined) {
      state.byStatusClass[statusClass] += 1;
    }

    const entry = state.byRoute.get(route) || { count: 0, totalMs: 0, max: 0, errors: 0 };
    entry.count += 1;
    entry.totalMs += ms;
    entry.max = Math.max(entry.max, ms);
    if (res.statusCode >= 500) entry.errors += 1;
    state.byRoute.set(route, entry);
  });

  next();
}

/** The slowest routes by AVERAGE, which is what points at a real problem. */
function slowestRoutes(limit = 10) {
  return [...state.byRoute.entries()]
    .map(([route, e]) => ({
      route,
      count: e.count,
      avgMs: Math.round((e.totalMs / e.count) * 10) / 10,
      maxMs: Math.round(e.max),
      errors: e.errors,
    }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, limit);
}

/** Routes that have actually returned a 5xx. */
function failingRoutes() {
  return [...state.byRoute.entries()]
    .filter(([, e]) => e.errors > 0)
    .map(([route, e]) => ({ route, errors: e.errors, count: e.count }))
    .sort((a, b) => b.errors - a.errors);
}

export function snapshot() {
  const uptimeSeconds = Math.round((Date.now() - state.startedAt) / 1000);
  return {
    uptimeSeconds,
    requests: {
      total: state.total,
      byStatusClass: { ...state.byStatusClass },
      avgMs: state.total ? Math.round((state.totalMs / state.total) * 10) / 10 : 0,
      /**
       * The error RATE, not just a count.
       *
       * A count is unreadable without traffic volume — 50 errors is fine at a
       * million requests and an outage at sixty.
       */
      errorRate: state.total
        ? Math.round((state.byStatusClass['5xx'] / state.total) * 10000) / 10000
        : 0,
    },
    latencyBuckets: BUCKETS.map((upper, i) => ({
      leMs: upper,
      count: state.histogram[i],
    })).concat([{ leMs: null, count: state.histogram[BUCKETS.length] }]),
    slowestRoutes: slowestRoutes(),
    failingRoutes: failingRoutes(),
  };
}

/** Prometheus text exposition, so it can be scraped without a client library. */
export function prometheusText(extra = {}) {
  const s = snapshot();
  const lines = [];

  const push = (name, help, type, value, labels = '') => {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} ${type}`);
    lines.push(`${name}${labels} ${value}`);
  };

  push('kk_uptime_seconds', 'Seconds since this process started', 'gauge', s.uptimeSeconds);
  push('kk_requests_total', 'Total HTTP requests handled', 'counter', s.requests.total);

  lines.push('# HELP kk_requests_by_class Requests by status class');
  lines.push('# TYPE kk_requests_by_class counter');
  for (const [cls, n] of Object.entries(s.requests.byStatusClass)) {
    lines.push(`kk_requests_by_class{class="${cls}"} ${n}`);
  }

  push('kk_request_error_rate', 'Fraction of requests returning 5xx', 'gauge', s.requests.errorRate);
  push('kk_request_avg_ms', 'Mean request duration in milliseconds', 'gauge', s.requests.avgMs);

  /**
   * The runner gauges are the operationally important ones.
   *
   * `kk_code_runner_available{language="python"} 0` is the alert that says
   * "every coding answer on a final test is going to a marking queue".
   * Nothing else in the system reports that.
   */
  lines.push('# HELP kk_code_runner_available Whether a language toolchain is present');
  lines.push('# TYPE kk_code_runner_available gauge');
  for (const [language, present] of Object.entries(extra.runners || {})) {
    lines.push(`kk_code_runner_available{language="${language}"} ${present ? 1 : 0}`);
  }

  push(
    'kk_db_connected',
    'Whether the database connection is ready',
    'gauge',
    extra.dbConnected ? 1 : 0
  );

  return `${lines.join('\n')}\n`;
}

/** Test seam: forget everything recorded so far. */
export function resetMetrics() {
  state.total = 0;
  state.totalMs = 0;
  state.byStatusClass = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
  state.byRoute.clear();
  state.histogram = new Array(BUCKETS.length + 1).fill(0);
}

export default { metricsMiddleware, snapshot, prometheusText, normalisePath, resetMetrics };
