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
- [ ] **Seed**: run `npm run seed` against the production DB with `SEED_SUPERADMIN_PASSWORD` and `SEED_ADMIN_PASSWORD` set to strong random values. The seed is idempotent (upserts content, never resets an existing account's password), so it is safe to re-run after a curriculum update. Never pass `--reset` in production — it wipes all worlds, lessons, quizzes, achievements and shop items.
- [ ] **Remove test/demo data** and any test accounts before launch.
- [ ] **Health check green**: `curl https://api.<domain>/api/v1/health` returns `{"success":true,...}`; `docker compose ps` shows the backend `healthy`.
- [ ] **Logs & monitoring**: ship container logs somewhere durable and set up basic uptime/error alerting (see notes below).
- [ ] **`SENTRY_DSN` set.** Without it errors only reach stdout, so nothing aggregates them and nothing alerts you. The API logs a warning at boot if it is missing in production.
- [ ] **Run the migrations** (see §8 below) — required when upgrading an existing install.
- [ ] **Self-host Pyodide** (see §8) so Python lessons work on school networks that block public CDNs.
- [ ] **`ENABLE_SERVER_CODE_EXEC` unset or `false`.** Leave it off. See the warning in §9.
- [ ] **Verify the Playground THROUGH the proxy**, not just in `vite dev`. A CSP that blocks `blob:` workers or the Pyodide origin silently kills every interactive coding lesson while dev keeps working.
- [ ] **Test a restore, not just a backup.** An untested backup is not a backup.

---

## 8. Upgrading an existing install (migrations)

Run these ONCE, in order, after deploying the new code and before letting users
back in. Both are idempotent and safe to re-run.

```bash
cd "Koding Keydzz Backend"
npm run migrate          # runs both migrations below
```

**`migrate-quiz-attempts.mjs`** — drops the obsolete `unique (user, quiz)` index
on `quizattempts` and backfills the new fields. That index meant only a
student's FIRST attempt was ever stored, so a child who failed once could never
earn the quiz's credit and the teacher only ever saw the failing score. Every
attempt is recorded now, and credit is granted on the first *passing* attempt.

**`migrate-sessions.mjs`** — clears stale session state and syncs the new
indexes (including the per-org `rollNumber` unique index).

> **Everyone signs in once more after this deploy.** Refresh-token hashes moved
> from bcrypt to SHA-256. bcrypt truncates its input at 72 bytes and every JWT
> for one user shares its first 72 bytes, so all of a user's refresh tokens
> hashed identically — token revocation and rotation were silently doing
> nothing. Old digests cannot be carried forward, so existing sessions are
> intentionally invalidated.

### Regenerating the game catalogue

`POST /games/complete` validates every completion against
`src/config/gameCatalog.json`, which is generated from the student app's level
data. If you add, remove or re-grade a level, regenerate and commit it:

```bash
npm run generate:catalog   # rewrites src/config/gameCatalog.json
npm run verify:catalog     # CI runs this; fails if the file has drifted
```

Forgetting this makes the new level unplayable — the server rejects it as an
"unknown level" and the child earns nothing.

The catalogue also carries a `facts` map per level — the few numbers the server
needs to GRADE a run rather than take the client's word for it (`maxHints`,
Towers of Hanoi's `disks`, Tic-Tac-Toe's bot `skill`). Two consequences worth
knowing when you add a level:

- **A hinted game's level MUST declare `maxHints`.** The five puzzle boards
  (Sudoku, Zip, Patches, N-Queens, Towers of Hanoi) have a hint button, and the
  server treats an undeclared allowance as *zero* — so a level added without one
  would let a child spend a hint the server then refuses, and the level would
  never complete. A test fails if any hinted level is missing it.
- **A new game needs a scoring model** in `src/config/starPolicy.js`. Without
  one the server grades every run at two stars, so nobody on that game could
  ever earn the 3-star bonus. A test fails if a catalogue game has no model.

### How stars are awarded

`stars` in the request body is ignored. Three stars pays a one-time bonus
(`PERFECT_BONUS`: 15 XP, 5 coins), so a client that could name its own star
count was setting part of its own payout — the same problem `difficulty` had.

The client now reports **what happened** — hints used, mistakes made, moves
taken, and for the programming games whether the path was optimal and the code
used a loop — and `src/config/starPolicy.js` applies each game's own published
rule to those counters. Counters a level makes impossible (more hints than it
grants) are rejected with a 400.

Two limits, stated plainly:

- A forged request can still claim "no hints, no mistakes" and be graded at
  three stars. Proving otherwise means replaying the puzzle server-side, which
  would put every solution in a file the API serves — a worse trade for one
  bonus per level. The base completion award has never depended on stars.
- For Maze Coding and Robot Navigation, the *optimal path* and *clean code*
  bits are still supplied by the client, because deciding them requires running
  the pupil's program against the maze. They are bounded to one star each, so
  the ceiling is a real 3.

A client that reports nothing at all still completes the level and earns the
base award, graded at two stars — so shipping this did not strand anyone on an
older bundle.

### Fonts are self-hosted (already done)

Both apps used to pull Poppins / Inter / Fredoka from `fonts.googleapis.com` at
runtime. Two problems in a school:

- Many school networks filter Google's CDNs, and some sites have no reliable
  outbound internet at all. The app still worked but fell back to the browser's
  default font, which is the first thing a teacher notices as "broken".
- Each request sent the pupil's IP and referring page to a third party — a
  consent question nobody wants to answer about children's data.

The latin woff2 files now ship with each app (`public/fonts/`, ~110 kB total)
and `nginx.conf`'s CSP no longer allows those hosts. Nothing to configure. To
refresh a face, see the header comment in `public/fonts/fonts.css`; CI fails if
either app goes back to the CDN or references a font file that isn't deployed.

### The code editor is self-hosted (already done)

`@monaco-editor/react` ships only a *loader* — the ~3 MB editor is fetched at
runtime, and with no configuration it comes from `cdn.jsdelivr.net`. On a
school network that filters public CDNs that means the Playground and **both**
programming games (Maze Coding's 50 levels and Robot Navigation's 16) show a
blank panel, with a single console line — `Monaco initialization: error` — as
the only clue. It surfaced here as an intermittent browser-test failure, which
is the same fault with a better error report.

There was a quieter second problem, and it turned out to be the one that bit:
the loader's pinned default was `monaco-editor@0.55.1` while the app depended
on `0.53.0`. Serving the 0.53 files to a loader written for 0.55 threw
`Property description must be an object: undefined` and the editor never
mounted — a failure that only appears once you stop using the CDN, because
until then the CDN was quietly serving 0.55.1. Both are now pinned to
**0.55.1** (dependency and `overrides`), and `fetch:monaco` warns if they
drift.

`npm run build` now runs `npm run fetch:monaco` first, which copies
`node_modules/monaco-editor/min/vs` into `public/monaco/vs` (nothing is
downloaded — it is already a dependency). The app loads `/monaco/vs` by
default, so there is nothing to configure.

- The output is a ~15 MB build artifact and is gitignored, so every build
  regenerates it.
- `vite.config.js` **fails the build** if the directory is missing, rather than
  shipping an app that 404s its own editor.
- `nginx.conf` serves `/monaco/` with a 7-day cache — deliberately shorter than
  `/pyodide/`'s 30-day immutable, because this path is not version-pinned.
- To point at a CDN or a shared asset host instead, set `VITE_MONACO_URL`.

With Monaco and the fonts both local, `cdn.jsdelivr.net` remains in the CSP for
exactly one reason: the Pyodide fallback below. Self-host Pyodide too and the
app has no third-party origins at all.

### Self-hosting Pyodide (recommended)

The Playground and every in-lesson "Try It" editor run Python in the browser via
Pyodide. By default it loads from jsDelivr, which school networks routinely
block — and it is ~10 MB per device.

```bash
cd "Koding Keydzz Frontend"
npm run fetch:pyodide                     # downloads ~13 MB into public/pyodide
VITE_PYODIDE_URL=/pyodide/v0.26.4/full/ npm run build
```

The binaries are **not committed** — git would keep 13 MB forever — so this
step is part of the build. It is idempotent, and the build **fails loudly** if
`VITE_PYODIDE_URL` points at a local path whose assets are missing, so a
deploy cannot silently fall back to a CDN the school's network blocks.

The bundled nginx config already serves `/pyodide/` with the correct
`application/wasm` type and a long cache, and its CSP already permits both
`blob:` workers (the JavaScript runner) and WebAssembly.

### Browser tests

The unit and integration suites cover logic and the HTTP layer but never render
the apps. `e2e/` drives the real built apps in Chromium and WebKit (at iPad
dimensions) against a real API and database — which is what covers UI flows,
the lazily-split route chunks, the in-browser code runners and tablet layout.

```bash
cd e2e
npm install
npx playwright install chromium webkit
npm test                # starts the API + both apps automatically
```

It is worth running before a release: it is what caught an unassociated form
label, a login gate that rejected the faculty role, and a sign-in rate limit
that would have locked out a whole school.

### The course ladder (Phase 1)

Python → C → HTML/CSS → AI. A pupil works **one language at a time**; each
course unlocks only when the previous one's final test is passed.

`src/config/courses.js` is the single source of truth for the four slugs, their
order and the language list. `slug`, `order` and `language` are reconciled from
that file on every seed, because the unlock chain and the compiler both depend
on them and neither tolerates drift — titles and descriptions stay editable.

```bash
cd "Koding Keydzz Backend"
npm run seed:courses            # reconcile; safe to re-run
npm run seed:courses -- --dry   # report only
```

The seed also **backfills**: every existing world becomes Python content, and
challenges are attached by their language.

#### Two things are derived, never stored

- **Lock state.** A course is unlocked when the previous one is passed. A
  stored flag can disagree with the attempts it reflects — leaving a pupil
  stuck behind a course they finished, or handed one they never earned. Both
  fail silently.
- **Final-test readiness.** Counted live from lessons, quizzes and game levels.
  A cached percentage goes stale the moment content is added, and adding a
  lesson would then let pupils sit a test on material they never saw.

`CourseProgress` holds only what actually happened: attempts, scores, the
completion date. It is a separate collection rather than an array on `User`
because a final-test submission would otherwise re-save the whole user
document — losing one of two concurrent writes — and "who has passed Python?"
across a school would mean scanning every pupil.

#### Content is scoped, not just labelled

`GET /worlds` returns only the current course's worlds, and
`GET /worlds/:id/lessons` **404s** for a world in a locked course. Without the
second, the first is cosmetic: world ids are handed out by the map, so the
lesson URLs would stay readable to anyone who guessed one. Staff still get the
whole curriculum — they have to be able to author the C course.

#### A course with no content is never published

0 of 0 is arithmetically 100%, so an empty course would report as complete and
hand out its final test on day one. The seed publishes a course only when it
has worlds **and** lessons — which is why C, HTML and AI are staged
unpublished.

#### Games: 7 language-specific, 6 universal

The catalogue now carries `course` per game. The six logic games (Sudoku,
Towers of Hanoi, N-Queens, Zip, Patches, Tic-Tac-Toe — 86 levels) carry **no**
course, which means every course: they teach computational thinking with no
syntax at all. The seven code games (145 levels) are tagged `python`.

That tag is what stops the C course demanding Python's maze levels. Re-run
`npm run generate:catalog` after changing `GAME_COURSES`.

#### JavaScript has been removed

It belonged to no course, so it sat in the playground picker with no lessons,
quizzes or games behind it. Gone from the language enums, the code runner, the
playground, the lesson editor and the client-side runners — including the
sandboxed Web Worker that ran it.

The CSP's `worker-src 'self' blob:` is **deliberately kept**: Monaco's language
services run in Web Workers and can fall back to a blob URL, and the staff
portal builds blob URLs for CSV export. Narrowing it would be a theoretical
tightening against a real risk of breaking either in production only.

### The final test (Phase 2)

Every course ends in a **200-point test; 150 passes**. Three attempts, with a
fresh draw each time. Passing writes `CourseProgress.completedAt`, which is the
single field the unlock chain reads.

Two paper shapes, chosen by the course's `kind` — both in
`src/config/finalTest.js`:

| | Code paper (Python, C) | Build paper (HTML, AI) |
|---|---|---|
| Knowledge | 10 MCQ x 5, 10 fill-in x 5 | 20 mixed x 5 |
| Applied | 3 coding x 20 | 2 tasks x 30 |
| Hardest one | 1 coding x 40 | 1 task x 40 |
| **Total** | **200** | **200** |

#### Points belong to the section, not the question

A question is worth what its blueprint section is worth. Per-question marks
would let one attempt total 200 and the next 185 purely because of the draw —
so the 150 pass mark would mean something different to every pupil.

`assertBlueprintTotals()` runs at **module load**, so a blueprint that does not
add to 200 fails at boot rather than at the end of a child's exam.

#### The paper is frozen at the start of an attempt

Questions are drawn when the attempt begins and stored on the attempt. Nothing
re-draws them on submit. Otherwise answers would be marked against different
questions than the pupil read, and a superadmin retiring a question mid-attempt
could remove questions from a paper already in progress.

Resuming returns the **same** paper. A pupil whose tab crashed must not get a
free reroll, nor lose the answers they already gave.

#### The mark scheme never leaves the server

`answerIndex`, `acceptedAnswers`, `testCases` and `expectedOutcome` are stripped
by one function — `forStudent()` in `finalTestService.js`. Anything else that
serialises a question is a bug. An integration test asserts none of those keys,
nor any accepted-answer text, appears in a drawn paper.

Visible test cases *do* survive: they are the worked example. The hidden ones
are what stop a solution that just prints the answer it was shown.

#### Coding answers are executed server-side

The lessons run Python in the browser, which is right for practice and useless
for an exam — a graded answer cannot be marked by the machine being graded. The
grader uses `codeExecutionService` (local interpreter, Piston fallback).

Partial credit is proportional to hidden test cases passed, with full marks
only for all of them: all-or-nothing on a 20-mark question punishes an
off-by-one as hard as a blank answer.

**If nothing ran at all** the mark is *withheld* (`needsReview`), not invented.
Scoring 0 would fail a child for a server misconfiguration; scoring full marks
would hand out a pass for nothing.

#### Build tasks await review

Open-ended tasks cannot be marked automatically yet, so they score 0 with
`awaitingReview` set on the attempt — visibly unfinished business rather than a
silent fail. LLM grading arrives with the HTML and AI courses.

#### The question bank

Superadmin-only (`/superadmin/questions`) — it holds the mark scheme for every
test, so a school admin must never read it. The model refuses a question that
could not be marked, because such a question gets drawn into a real test and
scores every pupil zero.

`GET /superadmin/questions/coverage/:slug` reports, per section, how many
questions are needed versus available. That prevents the failure that is
invisible until the worst moment: a pupil who has finished an entire course
pressing "Start test" and being told the bank is too small.

Questions are **retired**, not deleted, once used — past attempts store the ids
they drew, and deleting would leave a pupil unable to see the paper they sat.
The delete endpoint refuses with that explanation and points at retire.

### Every user must belong to an organization

`User.org` defaults to `null`, and public self-registration
(`POST /auth/register/student`, gated by `ALLOW_STUDENT_SIGNUP`) used to never
set it. Any account created that way was a **tenant orphan**, and the failure
was silent in the worst way: the person could still sign in and use the app,
but no school owned them, so

- no admin could see or manage them,
- they appeared on no classroom and in no report,
- every org-scoped query filtered them out.

Nothing in the product surfaced them. Three things changed:

**1. Registration can no longer create one.** The endpoint now requires the
school's join `code` (`Organization.code`), resolves it to a real, active
organization, honours its seat limit, and refuses the sign-up otherwise. The
error deliberately does not distinguish "no such code" from "wrong code" —
codes are short, and confirming which exist would let anyone enumerate the
schools on the platform.

**2. Existing orphans are visible and fixable.** The superadmin's
*Organizations* page shows an **"N people are not in any school"** panel above
the org list (and renders nothing when there are none). It covers **every
role** — the all-students table only lists pupils, so an orphaned administrator
or teacher was invisible even there. Each row has an *Assign a school* action;
the all-students table has the same action, and its Organization column now
reads *"No school — assign"* rather than an em-dash.

**3. There is a CLI for bulk clean-up:**

```bash
cd "Koding Keydzz Backend"
npm run users:unassigned                        # report only
node scripts/find-unassigned-users.mjs --assign SPRING          # move them all
node scripts/find-unassigned-users.mjs --assign SPRING --email someone@x.com
```

#### Assigning is not just a field write

`org` is the tenant boundary, so `PATCH /superadmin/users/:id/organization`
handles what changing it implies:

- **Classrooms.** Membership lives on the `Classroom` document, which carries
  its own `org`. Writing `org` on the user alone would leave them on the old
  school's roster, so that teacher would keep seeing the pupil in their lists
  and analytics — a cross-tenant leak. They are pulled from every classroom in
  the previous org, as student *and* as faculty.
- **Roll numbers.** `(org, rollNumber)` is uniquely indexed, so a clash in the
  destination is detected up front and reported by name instead of surfacing a
  raw `E11000`.
- **Seat limits.** A school on a seat-limited plan is not pushed over it.
- **Audited.** Recorded as `user.org.assigned` / `user.org.moved`, including how
  many classrooms the person was removed from — that is the answer to "why did
  this pupil vanish from my class?" six months later.

Member counts need no fixup: they are aggregated live from `User`, never
incremented by hand. The `superadmin` account is refused — being org-less is
correct for the platform operator, and giving it a tenant would scope its own
queries and lock it out of every other school.

### Recovering a locked-out superadmin

Password recovery is hierarchical — a student is reset by their teacher, a
teacher by the superadmin, and the superadmin by this script. There is no
self-service reset flow and no mail provider.

```bash
npm run recover:superadmin -- --list
npm run recover:superadmin -- --email you@example.com --generate
npm run recover:superadmin -- --email you@example.com --unlock
```

---

## 9. Production notes, risks & recommendations

- **⚠️ `ENABLE_SERVER_CODE_EXEC` is a remote-code-execution switch. Leave it off.**
  Server-side code execution is disabled by default and the Playground runs
  student code entirely in the browser, so the API never spawns an interpreter.
  Setting this to `true` re-enables raw `child_process` execution of arbitrary
  student-submitted code on your API host, with a timeout and an output cap as
  the *only* safeguards — no sandbox, no filesystem isolation, no network
  isolation. Do not enable it to "fix" a Playground problem; if the Playground
  is failing in production it is almost always the CSP or a blocked Pyodide CDN
  (see §8). If you genuinely need server-side execution, put a real sandbox in
  front of it first: self-hosted Piston, or a jailed container with seccomp and
  resource limits.
- **Curriculum is global and superadmin-only.** Worlds, lessons, courses,
  quizzes, achievements, challenges and shop items are ONE shared set backing
  every tenant. Org admins can read them but not write them, because a single
  school's admin could otherwise rename a world or delete a quiz for every
  other school. If per-school authoring becomes a requirement, add an `org`
  field to those models rather than widening the guard.
- **Running more than one API instance needs `REDIS_URL` and sticky sessions.**
  Socket.IO keeps its rooms in the memory of the process that owns the
  connection, so with two instances and no shared backplane a notification
  emitted on instance A never reaches a pupil connected to instance B — the
  emit finds no room and is dropped, with nothing logged. Two changes are
  required together:
    1. **`REDIS_URL`** on every instance. This attaches the Socket.IO Redis
       adapter (`src/sockets/index.js`), which makes every room emit
       cross-instance. Startup FAILS if the URL is set but unreachable —
       deliberately, because falling back to the in-memory adapter would look
       like a healthy deployment while silently dropping notifications.
    2. **Sticky sessions** at the load balancer (`ip_hash` in
       `nginx/nginx.conf`). Socket.IO's long-polling fallback sends a handshake
       and then further requests that must reach the same instance; without
       stickiness they fail with `400 Session ID unknown`. This is required by
       Socket.IO itself, not just by this app.

  With both in place, notifications and every room emit work across instances.
  **Live-duel matchmaking is the one thing that does not**: the waiting queue
  and room state are still per-process (`src/sockets/battle.js`), so two pupils
  served by different instances will not be paired with each other, and a
  restart drops in-flight duels. Everything else in the product is unaffected.
  Making duels fully multi-instance means moving the queue and room state into
  Redis — worth doing before a deployment where duels matter at scale, and
  called out at startup in the logs so it is never a surprise.

  A single instance needs none of this: leave `REDIS_URL` unset and everything,
  duels included, works.
- **Rate limits are sized for a shared school IP.** Every pupil in a school
  usually shares one public address, so an IP-keyed sign-in cap throttles the
  whole building. The sign-in budget defaults to 600 per 15 minutes and the
  general API budget to 3,000 per minute (`AUTH_RATE_LIMIT_MAX`,
  `API_RATE_LIMIT_MAX`); raise them for a large school behind a single NAT.
  The per-account lockout — five wrong passwords, then a 15-minute lock — is
  the actual brute-force defence and is unaffected by these numbers. The
  per-user limiters (game completions, playground runs, uploads) are keyed by
  account, not IP, for the same reason.
- **Roster imports are capped at 2,000 rows** and are idempotent (they dedupe
  on `rollNumber`, then email, then name-within-school). A larger school should
  split the roster by class; re-uploading the same file is safe and creates
  nothing new.

- **Committed backend `.env` (action required).** `Koding Keydzz Backend/.env` holds a real Atlas connection string and JWT secrets. It is git-ignored, but since it exists on disk, treat those credentials as compromised and rotate them before go-live. Keep production secrets only in the host `.env` / GitHub Actions secrets / Vercel env — never in the repo.
- **Vite env is build-time, not runtime.** `VITE_*` values are inlined into the static bundle when it is built. You cannot change the API URL by setting an env var on the host serving the files — you must rebuild/redeploy the frontend. This is the most common "prod points at localhost" bug.
- **Atlas SRV/DNS** — see the caveat in §2. Have the non-SRV connection string ready as a fallback.
- **Secrets management** — for anything beyond a single host, move secrets into a managed store (AWS SSM Parameter Store / Secrets Manager, Doppler, or GitHub Actions encrypted secrets injected at deploy) rather than a plaintext `.env` on the box.
- **Logging/monitoring suggestions** — the backend already emits morgan `combined` access logs in production. Recommended additions: ship stdout/stderr via the Docker `json-file` (with rotation) or a driver like `awslogs`/Loki; add an uptime monitor hitting `/api/v1/health`; add error tracking (e.g. Sentry) around the Express error handler; watch the Mongo/Atlas metrics for connection saturation.
- **Backups** — if you self-host the `mongo` container instead of Atlas, schedule `mongodump` of the `mongo_data` volume; Atlas provides automated backups on paid tiers.
- **Rate limiting & body size** — the API rate-limiter and a 1 MB JSON body limit are set in the app; nginx allows 25 MB multipart for Excel uploads. Tune both if bulk imports grow.
