# Koding Keydzz — Deployment Guide

This document covers running the platform locally with Docker Compose, provisioning
MongoDB on Atlas, deploying the backend to AWS EC2 behind nginx, deploying the two
frontends to Vercel, and the CI/CD flow.

## Architecture

```
                     ┌─────────────────────────┐
  Student SPA ──────▶│  Vercel (static, CDN)    │
  (Vite :5175)       └─────────────────────────┘
                     ┌─────────────────────────┐
  Admin SPA ────────▶│  Vercel (static, CDN)    │
  (Vite :5176)       └─────────────────────────┘
                                  │  HTTPS  /api/v1
                                  ▼
                     ┌─────────────────────────┐
                     │  EC2: nginx → Express    │  :5000
                     │  (docker-compose)        │
                     └─────────────────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │  MongoDB Atlas (or       │
                     │  the mongo compose svc)  │
                     └─────────────────────────┘
```

| App | Folder | Port (dev) | Deploy target |
| --- | --- | --- | --- |
| Backend (Express/Mongo/Socket.IO) | `Koding Keydzz Backend` | 5500 local / 5000 in Docker | EC2 + Docker + nginx |
| Student frontend (Vite) | `Koding Keydzz Frontend` | 5175 | Vercel |
| Admin portal (Vite) | `Koding Keydzz Admin` | 5176 | Vercel |

> **Port note:** the backend defaults to `5000` (its container/canonical port, used by
> the Dockerfile, docker-compose, and nginx upstream). Local non-docker dev commonly
> runs it on `5500` via `PORT` in `Koding Keydzz Backend/.env`. Set each frontend's
> `VITE_API_URL` to whichever backend you point at.

---

## 1. Local development with Docker Compose

Spins up MongoDB, the backend API, and an nginx reverse proxy.

```bash
# 1. Configure environment
cp .env.example .env
#    Edit .env — set MONGO_ROOT_PASSWORD and the two JWT_* secrets:
#    openssl rand -hex 32

# 2. Build & start
docker compose up -d --build

# 3. Verify
docker compose ps
curl http://localhost:5000/api/v1/health   # backend direct
curl http://localhost/api/v1/health         # through nginx proxy

# 4. (optional) seed demo data
docker compose exec backend npm run seed

# Logs / teardown
docker compose logs -f backend
docker compose down            # keep data
docker compose down -v         # also drop the mongo volume
```

Run the frontends locally against the dockerized API:

```bash
cd "Koding Keydzz Frontend" && npm install && npm run dev   # :5175
cd "Koding Keydzz Admin"    && npm install && npm run dev   # :5176
```

Each frontend reads `VITE_API_URL` from its `.env` (copy `.env.example`). Point it at
the backend you are running — `http://localhost:5000/api/v1` for the dockerized backend,
or `http://localhost:5500/api/v1` for a local `npm run dev` backend. **Vite bakes this in
at build time**, so a change requires re-running the dev server / rebuilding.

---

## 2. MongoDB Atlas (managed production database)

1. Create a free/shared cluster at <https://cloud.mongodb.com>.
2. **Database Access** → add a user (username + strong password).
3. **Network Access** → allow your EC2 instance's public IP (or `0.0.0.0/0`
   temporarily for testing — lock this down for production).
4. **Connect** → *Drivers* → copy the SRV connection string and set it in your
   server `.env`:
   ```
   MONGO_URI=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/koding_keydzz?retryWrites=true&w=majority
   ```
5. When using Atlas you do **not** need the `mongo` compose service. Either remove
   it from `docker-compose.yml` or just leave `MONGO_URI` pointed at Atlas — the
   backend will connect there and the local mongo container is ignored.

> **SRV / DNS caveat.** The `mongodb+srv://` scheme performs a DNS `SRV` + `TXT`
> lookup to discover cluster hosts. On hosts with restrictive or misconfigured DNS
> (some corporate networks, minimal containers, certain VPCs) that lookup can fail
> with `querySrv ENOTFOUND` / `ETIMEOUT`. The backend (`src/config/db.js`) applies a
> public-DNS SRV fallback automatically; you can disable it with
> `MONGO_DNS_FALLBACK=off`. If SRV keeps failing, use the **non-SRV** connection
> string from Atlas (Connect → Drivers → "I'll type my own" / older driver version),
> which lists the shard hosts explicitly and skips the SRV lookup. Also remember to
> **url-encode special characters** in the password (`$` → `%24`, etc.).

---

## 3. Backend on AWS EC2 (Docker + nginx)

1. **Launch** an Ubuntu 22.04 `t3.small` (or larger) instance. Security group:
   open ports `22` (SSH), `80` (HTTP), `443` (HTTPS). Do **not** expose `5000`
   publicly — nginx proxies to it internally.

2. **Install Docker:**
   ```bash
   sudo apt-get update && sudo apt-get install -y ca-certificates curl
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER && newgrp docker
   ```

3. **Deploy the code** (git clone or rsync the repo) and configure env:
   ```bash
   cd "Koding Keydzz"
   cp .env.example .env
   #   Set NODE_ENV=production, MONGO_URI=<Atlas SRV string>,
   #   JWT secrets, and CLIENT_ORIGINS to your Vercel domains, e.g.:
   #   CLIENT_ORIGINS=https://app.kodingkeydzz.com,https://admin.kodingkeydzz.com
   ```

4. **Start the stack:**
   ```bash
   docker compose up -d --build backend nginx
   ```
   `nginx/nginx.conf` proxies `/api/*` **and** `/socket.io/*` to the backend
   container and adds gzip, security headers, a 25 MB `client_max_body_size` (for
   Excel roster uploads), and WebSocket upgrade support. The separate `/socket.io/`
   block is required — the realtime clients connect to the API *origin* at the
   default `/socket.io/` path, so proxying only `/api/` would silently break the
   battle arena and live notifications.

   > **If the backend runs on its own domain (e.g. `api.kodingkeydzz.com`) with TLS
   > terminated by an upstream ALB / Cloudflare / host nginx, make sure that layer
   > also forwards WebSocket upgrade headers and the `/socket.io/` path.**

5. **TLS:** point a domain (e.g. `api.kodingkeydzz.com`) at the EC2 IP, then add
   HTTPS with Certbot on the host nginx, or terminate TLS at an AWS ALB / CloudFront
   in front of the instance.

6. **Updates:** `git pull && docker compose up -d --build backend` (zero-config
   redeploy; the volume keeps any local Mongo data).

---

## 4. Frontends on Vercel

Each frontend ships a `vercel.json` (SPA rewrite → `/index.html`, Vite framework,
`npm ci` install, `dist` output). Create **two** Vercel projects from the same repo:

| Vercel project | Root Directory | Env var |
| --- | --- | --- |
| kk-student | `Koding Keydzz Frontend` | `VITE_API_URL=https://api.kodingkeydzz.com/api/v1` |
| kk-admin | `Koding Keydzz Admin` | `VITE_API_URL=https://api.kodingkeydzz.com/api/v1` |

Steps per project:
1. Import the Git repo in Vercel.
2. Set **Root Directory** to the app folder above.
3. Vercel auto-detects Vite (build `npm run build`, output `dist`); `vercel.json`
   makes this explicit and adds the SPA rewrite.
4. Add the `VITE_API_URL` environment variable (Production + Preview).
5. Deploy. Add the resulting domains to the backend's `CLIENT_ORIGINS` so CORS
   allows them.

> Both apps degrade gracefully if the API is unreachable (mock data / demo mode),
> so a Vercel preview is usable even before the backend is live.

---

## 5. CI/CD flow

`.github/workflows/ci.yml` runs on every push / PR to `main`, `master`, `develop`:

- **backend** job: `npm ci` → `node --check src/server.js` → `npm test --if-present`.
- **frontends** job (matrix over the student app and admin app): `npm ci` →
  `npm test --if-present` → `npm run build`.

All jobs use Node 20 with npm caching keyed on each app's `package-lock.json`.

Recommended continuous deployment:
- **Frontends:** connect the repo to Vercel — every push to `main` auto-deploys
  production; PRs get preview URLs. CI gates the merge.
- **Backend:** on a release/tag, SSH to EC2 (or use a deploy action) and run
  `git pull && docker compose up -d --build backend`. Keep secrets in GitHub
  Actions secrets / EC2 `.env`, never in the repo.

---

## 6. `.dockerignore` guidance

The backend already includes a `.dockerignore` (`node_modules`, `.env`, `.git`,
logs, `README.md`, etc.) so its image stays small and never bakes in secrets or
host `node_modules`. If you later add a Dockerfile for a frontend, give it the
same treatment — at minimum:

```
node_modules
dist
.env
.env.*
.git
*.log
coverage
.DS_Store
```

This keeps build context small, build times fast, and prevents leaking local env
files into images.

---

## Environment variable reference

See `.env.example` at the repo root for the full annotated list. Key ones:

| Variable | Used by | Notes |
| --- | --- | --- |
| `MONGO_URI` | backend | Atlas SRV string in prod; compose `mongo` service locally |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | backend | `openssl rand -hex 32` |
| `ACCESS_TTL` / `REFRESH_TTL` | backend | token lifetimes (`15m`, `7d`) |
| `CLIENT_ORIGINS` | backend | comma-separated allowed CORS origins (real frontend domains in prod) |
| `CLOUDINARY_*` | backend | media uploads (optional; 503 until set) |
| `VITE_API_URL` | frontends | set in Vercel project settings, **build-time** (`.../api/v1`) |
| `VITE_SOCKET_URL` | student frontend | optional; derived from `VITE_API_URL` if unset |

---

## 7. Production go-live checklist

Run through this before pointing real users at the platform:

- [ ] **`NODE_ENV=production`** on the backend (disables the dev localhost-CORS fallback and enables combined access logs).
- [ ] **Strong, unique JWT secrets** — regenerate both: `openssl rand -hex 32`. Never ship the `change_this_*` placeholders.
- [ ] **Rotate any secret that was ever committed.** A real `Koding Keydzz Backend/.env` with a live Atlas password and JWT keys currently exists in the working tree — rotate the Atlas DB user password and both JWT secrets, and confirm `.env` is git-ignored (it is) so it is never pushed.
- [ ] **MongoDB Atlas**: dedicated DB user (least privilege), Network Access allowlist locked to the server's IP (not `0.0.0.0/0`), password url-encoded in `MONGO_URI`.
- [ ] **Real CORS origins**: `CLIENT_ORIGINS` = the exact deployed frontend domains (student + admin), no trailing slash.
- [ ] **Real `VITE_API_URL`** set in BOTH Vercel projects (Production + Preview) = the hosted backend, e.g. `https://api.kodingkeydzz.com/api/v1`. Redeploy after any change — Vite bakes it in at build time.
- [ ] **HTTPS everywhere**: TLS on the backend domain (Certbot / ALB / Cloudflare) and on the Vercel frontends (automatic). Mixed content (https page → http API) will be blocked by the browser.
- [ ] **Socket.IO reachable**: verify the realtime connection works end-to-end (the `/socket.io/` path must be proxied and WebSocket upgrade forwarded).
- [ ] **Cloudinary keys** set if uploads are needed (otherwise upload endpoints return 503).
- [ ] **Seed once**: run `npm run seed` a single time against the production DB, then change the seeded admin password (`admin@kodingkeydzz.com` / `Admin@123`).
- [ ] **Remove test/demo data** and any test accounts before launch.
- [ ] **Health check green**: `curl https://api.<domain>/api/v1/health` returns `{"success":true,...}`; `docker compose ps` shows the backend `healthy`.
- [ ] **Logs & monitoring**: ship container logs somewhere durable and set up basic uptime/error alerting (see notes below).

---

## 8. Production notes, risks & recommendations

- **Committed backend `.env` (action required).** `Koding Keydzz Backend/.env` holds a real Atlas connection string and JWT secrets. It is git-ignored, but since it exists on disk, treat those credentials as compromised and rotate them before go-live. Keep production secrets only in the host `.env` / GitHub Actions secrets / Vercel env — never in the repo.
- **Vite env is build-time, not runtime.** `VITE_*` values are inlined into the static bundle when it is built. You cannot change the API URL by setting an env var on the host serving the files — you must rebuild/redeploy the frontend. This is the most common "prod points at localhost" bug.
- **Atlas SRV/DNS** — see the caveat in §2. Have the non-SRV connection string ready as a fallback.
- **Secrets management** — for anything beyond a single host, move secrets into a managed store (AWS SSM Parameter Store / Secrets Manager, Doppler, or GitHub Actions encrypted secrets injected at deploy) rather than a plaintext `.env` on the box.
- **Logging/monitoring suggestions** — the backend already emits morgan `combined` access logs in production. Recommended additions: ship stdout/stderr via the Docker `json-file` (with rotation) or a driver like `awslogs`/Loki; add an uptime monitor hitting `/api/v1/health`; add error tracking (e.g. Sentry) around the Express error handler; watch the Mongo/Atlas metrics for connection saturation.
- **Backups** — if you self-host the `mongo` container instead of Atlas, schedule `mongodump` of the `mongo_data` volume; Atlas provides automated backups on paid tiers.
- **Rate limiting & body size** — the API rate-limiter and a 1 MB JSON body limit are set in the app; nginx allows 25 MB multipart for Excel uploads. Tune both if bulk imports grow.
