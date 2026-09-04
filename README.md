# Koding Keydzz — Learn Coding Through Adventure

A gamified coding-education platform for kids 6–16, themed as the **Golden Coding Kingdom** (Turmeric `#FFBE0B` + Malt `#2A2312`). This repo contains three apps plus a shared design spec.

```
Koding Keydzz/
├── DESIGN_TOKENS.md         # single source of truth: colors, fonts, worlds, XP rules
├── Koding Keydzz Backend/   # Node + Express + MongoDB + Socket.IO (API :5500)
├── Koding Keydzz Frontend/  # Student app — Vite + React + GSAP + Framer (:5175)
└── Koding Keydzz Admin/     # Admin portal — Vite + React + Recharts (:5176)
```

All three are scaffolded, install cleanly, and build/lint green. Frontend & Admin **degrade gracefully to demo data** when the backend is offline, so they run standalone.

## Prerequisites
- Node 20+ (tested on v26)
- MongoDB running locally (or a MongoDB Atlas URI) — only needed for the backend

## Run everything (3 terminals)

**1. Backend**
```bash
cd "Koding Keydzz Backend"
cp .env.example .env          # set MONGO_URI + JWT secrets (PORT=5500, CLIENT_ORIGINS=5175,5176)
npm run seed                  # seeds 7 worlds, achievements, admin user
npm run dev                   # http://localhost:5500/api/v1
```
Seeded admin login (LOCAL DEVELOPMENT ONLY): `admin@kodingkeydzz.com` / `Admin@123`.
In production the seed refuses to create these accounts without `SEED_SUPERADMIN_PASSWORD`
and `SEED_ADMIN_PASSWORD` set to strong values — see `DEPLOYMENT.md`.

**2. Student frontend**
```bash
cd "Koding Keydzz Frontend"
npm run dev                   # http://localhost:5175
```

**3. Admin portal**
```bash
cd "Koding Keydzz Admin"
npm run dev                   # http://localhost:5176
```

> Ports are pinned in each app's `package.json` (`vite --port …`) and the backend `.env` (`PORT`, `CLIENT_ORIGINS`). The frontend/admin `.env` files set `VITE_API_URL=http://localhost:5500/api/v1`.

## What's implemented
- **Backend**: MVC + repository architecture, multi-tenant (superadmin → org admin → student), JWT access+refresh with rotation, role-based access + org-scoping, helmet/strict-CORS/rate-limit/mongo-sanitize/zod validation, production error-hiding + graceful shutdown + secret guard, Socket.IO. XP/level engine, achievements with live progress, tuned coin economy. Avatar catalog + equip, shop with atomic coin purchases, quiz grading (mcq/dragdrop/fillblank/match, idempotent XP), **sandboxed code execution** (local python/node with Piston fallback), game-level completion + **move/time leaderboards**, real-time battle-arena sockets, Cloudinary uploads. Seed + cleanup scripts, multi-stage Dockerfile. **118 unit tests pass.**
- **Frontend (student)**: GSAP landing, animated auth, game-HQ dashboard, **5 themed worlds** (concept + Python) with per-world environments, Monaco **code-driven Maze** playground, card-grid quiz arena (20 quizzes), **11 mini-games** (Maze, Robot Nav, Treasure Hunt, Bug Fix, Space Adventure, Battle Arena, Logic Puzzle, Sudoku, N-Queens, Towers of Hanoi, Zip) with stars + leaderboards, avatar wardrobe (48 items), treasure-marketplace shop (41 items), notifications, achievements with progress bars. 100% backend-driven (real loading/empty/error states); RTK Query with 401-refresh. **419 tests pass.**
- **Admin**: super-admin analytics + org-cards console; org drill-in with Excel bulk student upload (common password); org-admin dashboard (Recharts), student table with suspend/reset/CSV export, CRUD for courses/lessons/challenges/quizzes/achievements/shop-items, leaderboards, broadcast notifications. **33 tests pass.**
- **DevOps**: `docker-compose.yml` (mongo + backend + nginx), `nginx/nginx.conf` (proxies `/api` **and** `/socket.io`), `.github/workflows/ci.yml`, per-app `vercel.json`, root + per-app `.env.example`, and `DEPLOYMENT.md` (local / Atlas / EC2 / Vercel / CI-CD + go-live checklist).

## Tests & builds
- Backend `npm test` → **118 passing** · Student `npx vitest run` → **419 passing** · Admin `npx vitest run` → **33 passing** · all three `npm run build` → green (no >500 kB chunk warnings).

## Deploy / run in production
Everything DevOps lives at the repo root:

```bash
# Single-host stack: MongoDB + backend + nginx reverse proxy
cp .env.example .env         # set MONGO_ROOT_PASSWORD + JWT secrets (openssl rand -hex 32)
docker compose up -d --build
curl http://localhost/api/v1/health
```

- `docker-compose.yml` — mongo (volume + healthcheck) + backend (non-root, prod image, healthcheck) + nginx.
- `nginx/nginx.conf` — reverse proxy for `/api/` **and** `/socket.io/`, gzip, security headers, 25 MB upload limit, optional static SPA serving.
- `Koding Keydzz Backend/Dockerfile` — multi-stage, prod-only deps, runs as the unprivileged `node` user.
- Per-app `vercel.json` + `.env.example` — the two Vite frontends deploy as static builds on Vercel (`VITE_API_URL` is set at **build time**).
- `.github/workflows/ci.yml` — Node 20, `npm ci` + test + build for all three apps.

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full step-by-step guide (local / MongoDB Atlas / EC2 / Vercel / CI-CD) and the **production go-live checklist**.

## Remaining polish (optional)
Code-split the >500 kB Vite vendor chunk (cosmetic warning), expand E2E/integration test coverage, wire real Cloudinary creds, and add live socket wiring for the in-app battle arena UI (the backend events + client scaffolding are already in place).

See `DESIGN_TOKENS.md` and `DEPLOYMENT.md` before extending — they keep all apps consistent and deployable.
