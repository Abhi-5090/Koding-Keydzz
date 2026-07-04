# Deployment

Operational guide for running **Koding Keydzz Backend** in production
(Node/Express/MongoDB). See `README.md` for the API surface and `.env.example`
for the full, commented environment template.

## 1. Prerequisites

- Node.js 18+ (uses global `fetch`, `AbortSignal.timeout`).
- MongoDB (Atlas recommended, or self-hosted).
- A process manager / orchestrator (systemd, PM2, Docker, or a PaaS).

## 2. Environment

Copy `.env.example` to `.env` and set real values. In **production** the server
refuses to boot unless `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are unique,
≥ 32 chars, and not the example defaults (see `src/config/env.js`). Generate
secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Required: `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`CLIENT_ORIGINS` (your real frontend origin(s) — the localhost wildcard is
dev-only).

### Feature flags & ops env vars

| Variable | Default | Purpose |
| --- | --- | --- |
| `ALLOW_STUDENT_SIGNUP` | `false` | Public student self-registration. Off → `POST /auth/register/student` returns `403`; org admins provision students. Set `true` to re-enable. |
| `ENABLE_SERVER_CODE_EXEC` | `false` | Server-side code execution for the playground. Off → `POST /playground/run` returns `501` ("code runs in your browser"). The Playground runs client-side; enabling this re-opens a local `child_process` execution surface, so only enable it behind a real sandbox. |
| `CODE_RUNNER` | `auto` | Only used when `ENABLE_SERVER_CODE_EXEC=true`: `auto \| local \| piston`. |
| `SENTRY_DSN` | _(unset)_ | Error tracking. When set, the central error handler emits a structured record per 5xx. Integration point for `@sentry/node` (see Monitoring below). |

## 3. Build & run

```bash
npm ci --omit=dev        # install production deps
npm run seed             # one-time: seed baseline content + superadmin/org (idempotent)
npm start                # start the server (src/server.js)
```

Or with Docker:

```bash
docker build -t koding-keydzz-backend .
docker run --env-file .env -p 5000:5000 koding-keydzz-backend
```

The server handles `SIGINT`/`SIGTERM` with graceful shutdown (drains HTTP,
closes Socket.IO and MongoDB, hard-exits after 10s).

## 4. Reverse proxy

Terminate TLS at a reverse proxy (nginx / a load balancer) and forward to the
app. `trust proxy` is enabled so the IP-based rate limiters see the real client
IP via `X-Forwarded-For`. Forward WebSocket upgrade headers for Socket.IO.

---

## Monitoring & Backups

### Uptime / health checks
- Point your uptime monitor (UptimeRobot, Pingdom, a load-balancer health check,
  or Kubernetes liveness/readiness probes) at **`GET /api/v1/health`** — it
  returns `{ success: true, data: { status: "ok" } }` and does not touch the DB.
- Alert on non-200 responses or latency spikes.

### Error tracking (Sentry)
- Set **`SENTRY_DSN`** to turn on error reporting. The central error handler
  (`src/middlewares/error.js`) already:
  - logs every **5xx** as a structured one-line JSON record with
    `method`, `path`, `status`, `message`, and `timestamp` (plus the full error
    object with stack), while the client only ever receives a generic message in
    production; and
  - when `SENTRY_DSN` is set, emits an additional `[sentry]` structured record
    (including the stack) as an integration point.
- For **full APM** (breadcrumbs, releases, performance): `npm i @sentry/node`,
  initialize it early in `src/server.js`
  (`Sentry.init({ dsn: process.env.SENTRY_DSN })`), and replace the `[sentry]`
  log line in `src/middlewares/error.js` with `Sentry.captureException(err)`.
  This is intentionally **not** a hard dependency so the app stays lean by default.

### Log shipping & rotation
- The app logs to **stdout/stderr** (structured 5xx lines + morgan `combined`
  access logs in production). Do **not** write log files from inside the app.
- Let the platform capture stdout/stderr and ship it:
  - Docker/Kubernetes: use the container log driver + a collector (Fluent Bit /
    Vector / the cloud provider's logging agent).
  - systemd: logs go to `journald`; forward with `journald` → your aggregator.
  - PM2: enable `pm2-logrotate` (`pm2 install pm2-logrotate`) to cap file size
    and rotate.
- Retain enough history to investigate incidents (e.g. 14–30 days) and alert on
  5xx rate.

### MongoDB backups
- **Atlas (recommended):** enable **Cloud Backups** with a snapshot schedule and
  point-in-time recovery; periodically test a restore into a staging cluster.
- **Self-hosted:** run a `mongodump` cron and copy the archive off-box to object
  storage, e.g. a nightly job:

  ```bash
  # /etc/cron.d/koding-keydzz-backup  (runs 02:15 daily)
  15 2 * * * mongo  mongodump --uri="$MONGO_URI" \
    --archive="/backups/kk-$(date +\%F).gz" --gzip && \
    aws s3 cp "/backups/kk-$(date +\%F).gz" s3://your-bucket/koding-keydzz/
  ```

  Keep several daily/weekly copies, store them **off the database host**, and
  **test restores** regularly (`mongorestore --gzip --archive=...`). An untested
  backup is not a backup.
