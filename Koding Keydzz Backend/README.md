# Koding Keydzz Backend

Production-ready backend foundation for **Koding Keydzz**, an educational gaming platform that teaches kids to code through gamified worlds, lessons, quizzes, challenges, XP, levels, coins, achievements, and leaderboards.

## Tenancy model

```
superadmin  (platform owner, tenant-less)
   └── Organization  (a school — the tenant boundary)
         ├── admin    (MANY per school — full access to that school)
         ├── faculty  (teachers — see only their assigned classes)
         └── student  (learners)
               ▲
               └── Classroom  links faculty ⇄ students
```

**Roles and what they can do** live in one place: `src/config/permissions.js`.
Routes declare the CAPABILITY they need (`requireCapability('student:write')`)
rather than a list of roles, so adding a role is a single edit there instead of
a sweep through every route file.

| Role | Scope | Can |
|---|---|---|
| `superadmin` | Platform | Manage organizations, author the shared curriculum, see every school's analytics |
| `admin` | One school | Manage that school's students, teachers, classes, announcements and reports. Many admins per school |
| `faculty` | Their classes | See and report on the pupils in classes assigned to them; reset a pupil's password; adjust their own class rosters |
| `student` | Themselves | Learn |

**Faculty scoping.** A teacher's view is narrowed by `withClassroomScope`,
which resolves the classes they teach into `req.classroomScope`. Every student
read and write threads that through, so granting a teacher `student:read`
cannot expose the rest of the school. A pupil outside their classes returns
`404`, never `403` — a teacher must not be able to confirm that a child they
do not teach exists.

**Curriculum is global and superadmin-only to write.** Worlds, lessons,
quizzes, achievements and shop items are ONE shared set backing every tenant.
Org staff can read them; only the platform owner can change them, because
otherwise a single school could rename a world or delete a quiz for everyone.

### Analytics

| Endpoint | Audience | Returns |
|---|---|---|
| `GET /superadmin/analytics/platform` | superadmin | Scale, growth, DAU/WAU/MAU + stickiness, per-tenant health with an at-risk list, distributions, content coverage |
| `GET /superadmin/orgs/:id/analytics` | superadmin | One school, in the same shape its own admin sees |
| `GET /admin/analytics` | admin **or** faculty | Whole school for an admin; only their own classes for a teacher — the server scopes it from the token |
| `GET /admin/analytics/classrooms/:id` | admin, faculty | One class |

Responses are chart-ready: series come back **dense** (a quiet day is a zero,
not a missing point, so a line chart cannot draw a straight line across a gap
and lie), KPIs carry `{ value, previous, delta, direction }` with `delta: null`
when there is no honest baseline, and every average is paired with a median.


## Stack

- Node.js (ESM, `"type": "module"`)
- Express 4
- Mongoose 8 (MongoDB)
- JWT access + refresh tokens (separate secrets), refresh-token hash stored on the user
- Socket.IO (real-time notifications)
- bcryptjs, helmet, express-rate-limit, express-mongo-sanitize, cors, morgan
- zod (request validation), dotenv

Architecture: **MVC + Repository pattern** (`routes -> controllers -> services -> repositories -> models`). Controllers are thin and delegate to services.

## Project structure

```
src/
  config/        db.js, env.js
  models/        Mongoose schemas (User, World, Course, Lesson, Quiz, Question,
                 Challenge, Achievement, Reward, Notification, Purchase, LeaderboardEntry,
                 AvatarItem, QuizAttempt, GameScore)
  repositories/  data-access layer (BaseRepository + one per used model)
  services/      business logic (auth, student, progress, admin, leaderboard, ...)
  controllers/   request handlers
  routes/        express routers mounted under /api/v1
  middlewares/   auth (protect + authorize), error, validate, rateLimit
  utils/         ApiError, ApiResponse, asyncHandler, tokens, xp, validators
  sockets/       socket.io setup + notification emitters
  seed/          seed.js
  app.js         express app
  server.js      http server + socket.io + db connect + listen
```

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file from the template and edit values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   | --- | --- |
   | `PORT` | HTTP port (default 5000) |
   | `MONGO_URI` | MongoDB connection string |
   | `JWT_ACCESS_SECRET` | Secret for signing access tokens |
   | `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
   | `ACCESS_TTL` | Access token lifetime (e.g. `15m`) |
   | `REFRESH_TTL` | Refresh token lifetime (e.g. `7d`) |
   | `CLIENT_ORIGINS` | Comma-separated CORS origins |
   | `CLOUDINARY_*` | Optional media upload credentials (placeholders) |

3. Make sure MongoDB is running locally (or point `MONGO_URI` at Atlas).

## Run

```bash
npm run seed    # seed worlds, lessons, quizzes, achievements, daily challenges, superadmin + default org/admin
npm run dev     # start with --watch (auto reload)
npm start       # start without watch
```

`npm run seed` is **idempotent** and ends at a clean baseline: 5 worlds, their lessons,
**20 real quizzes** (~4 per world, ≥5 questions each), **12 achievements** (with
`{ type, target }` criteria), **48 avatar items** (6 categories × 8; **41 purchasable
in the shop**), 3 daily challenges, exactly one superadmin and one default org + admin.
It also clears previously-seeded content and removes leftover test data (the old
`Sunrise Public School` org and any stray seeded admin/superadmin accounts), while
leaving real app-created students untouched. The seed prints a count summary at the end.

Seeded accounts:

**Local development only.** `npm run seed` creates two bootstrap accounts:

- Super admin: `superadmin@kodingkeydzz.com`
- Default org admin: `admin@kodingkeydzz.com` (org **Koding Keydzz Academy**, code `KKACAD`)

Their dev passwords are `Super@123` / `Admin@123`. These are **development
defaults and must never reach production** — they used to be re-applied on
every seed run, which silently reset the platform's highest-privilege account
to a password published in this file.

In production the seed **refuses to create either account** unless you supply
strong values:

```bash
SEED_SUPERADMIN_PASSWORD="$(node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))")" \
SEED_ADMIN_PASSWORD="$(node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))")" \
NODE_ENV=production npm run seed
```

The seed is **idempotent**: it upserts content on a natural key and never
touches the password of an account that already exists, so it is safe to re-run
after a content update. `--reset` restores the old destructive wipe for local
work and is refused against `NODE_ENV=production`.

The first four worlds teach coding **concepts** in a friendly, language-neutral way
(what a variable is, how loops repeat, what functions return, how boolean logic works);
only **Python Kingdom** teaches an actual programming language. Seeded quizzes follow the
same split (e.g. **Variables 1: What Is a Variable**, **While Loops 2: Repeating While
True**, **Return Values 3: Getting Something Back**, **Boolean Logic 2: AND, OR, NOT**,
**Python 3: Loops & Logic**) — each links to a lesson in its world and mixes `mcq`,
`fillblank`, `match`, and `dragdrop` questions with correct answers. There is no
JavaScript or AI/ML content. Use `GET /api/v1/quizzes` to discover their ids.

Health check: `GET /api/v1/health`.

## Docker

```bash
docker build -t koding-keydzz-backend .
docker run --env-file .env -p 5000:5000 koding-keydzz-backend
```

## XP / Level logic (`src/utils/xp.js`)

- Activity rewards: lesson **+100**, quiz **+50**, challenge **+150**, project **+300**.
- Levels 1–100 with a cumulative curve: `xpForLevel(n) = 100 * n * (n + 1) / 2`.
- `computeLevel(totalXp)` returns the current level.
- `nextLevelXp(totalXp)` returns the cumulative XP threshold for the next level.

## Economy (`src/utils/economy.js`)

Coins are the shop currency. Per-event awards are deliberately **modest** so reaching
the top of the shop (5000 coins) is a real long-term goal — a dedicated kid grinding
many levels/quizzes gets there over time, but not trivially. All awards are **idempotent**
(granted once per user + item/level/quiz; replays that don't improve award nothing).

### Award table

| Event | XP | Coins | Notes |
| --- | --- | --- | --- |
| Lesson complete | +100 | +10 | once per user + lesson |
| Quiz pass (≥70%) | +50 | +15 | once per user + quiz; increments `quizzesPassed` |
| Daily challenge | +150 | +25 | once per user + challenge; increments `dailyChallengesCompleted` |
| Game level — easy | +20 | +5 | first completion of `(gameKey, levelId)` |
| Game level — medium | +35 | +10 | first completion |
| Game level — hard | +60 | +20 | first completion |
| 3-star bonus | +15 | +5 | one-time, first time a level reaches 3 stars |

Every coin award also accrues to the lifetime `totalCoinsEarned` counter (separate from
spendable `coins`), which drives coin achievements.

### Shop price ladder (50 → 5000)

Purchasable avatar items are priced across the full ladder; commons are cheap, legendaries
sit at the expensive end:

`50, 75, 100, 150, 200, 250, 300, 400, 500, 550, 750, 1000, 1300, 1700, 2200, 2800, 3000, 3500, 4300, 5000`

Roughly: **common** 50–200, **rare** 300–750, **epic** 1000–1700, **legendary** 2200–5000.

## Response envelope

All responses are wrapped as:

```json
{ "success": true, "data": { }, "message": "..." }
```

Errors:

```json
{ "success": false, "message": "...", "details": [ ] }
```

## API Contract (base path `/api/v1`)

### Auth (`/auth`, rate limited)

| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| POST | `/auth/register/student` | – | `{ name, grade, school, email, password }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/login` | – | `{ identifier, password }` (identifier = **username OR email**; legacy `{ email, password }` still works) | `{ user, accessToken, refreshToken }` |
| POST | `/auth/refresh` | – | `{ refreshToken }` | `{ accessToken }` |
| POST | `/auth/logout` | Bearer | – | `null` |
| GET | `/auth/me` | Bearer | – | `{ user }` |

Registration is gated by `ALLOW_STUDENT_SIGNUP` (default off → `403`; org admins provision
students). **Brute-force protection is two-layered:** an IP-based limiter (`authLimiter`,
30 requests / 15 min across the `/auth` router) **plus** a per-account lockout. After
**5 consecutive wrong passwords** an account is locked for **15 minutes**; further login
attempts return **`423 Locked`** with `"Account temporarily locked. Try again in N minutes."`
*before* the password is even checked. A successful login clears the counter. Wrong passwords
still return the generic `401 "Invalid credentials"` (email existence is never revealed). The
pure decision logic lives in `src/utils/loginLockout.js` (unit-tested in
`tests/loginLockout.test.js`).

**Login by username or email.** Students provisioned without an email log in with a
**username** (their login id). `POST /auth/login` takes `{ identifier, password }` where
`identifier` is a username **or** an email; the legacy `{ email, password }` body is still
accepted (the email value is used as the identifier when `identifier` is absent). Resolution
is case-insensitive via `$or: [{ email }, { username }]` (`userRepository.findByLogin`).
The pure resolver (`buildLoginFilter` / `normalizeIdentifier`) lives in `src/utils/username.js`.
The returned `user` payload now includes `username`.

### Student

| Method | Path | Auth | Returns |
| --- | --- | --- | --- |
| GET | `/student/dashboard` | student | `{ xp, level, coins, achievements:[{ key,title,description,icon,progress,target,percent,unlocked }], dailyChallenges, progress, nextLevelXp }` |

### Worlds & Lessons

| Method | Path | Auth | Returns |
| --- | --- | --- | --- |
| GET | `/worlds` | – | `[worlds]` |
| GET | `/worlds/:id/lessons` | – | `[lessons]` |

### Progress

| Method | Path | Auth | Returns |
| --- | --- | --- | --- |
| POST | `/progress/lesson/:id/complete` | Bearer | `{ xpEarned, totalXp, level, leveledUp, coins }` |

Lesson/challenge/quiz completion persists XP + coins to the user, recomputes level,
increments the relevant lifetime counter, and runs achievement checks. All are idempotent.

### Games (`/games`)

| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| POST | `/games/complete` | Bearer | `{ gameKey: string, levelId: number\|string, difficulty: easy\|medium\|hard, stars: 0..3, moves?: int≥0, timeMs?: int≥0 }` | `{ awarded:{ xp, coins }, alreadyCompleted, bestStars, totalXp, level, coins, leveledUp, best:{ moves, timeMs, stars }, levelRank }` |
| GET | `/games/:gameKey/leaderboard?limit=20&scope=global\|org` | Bearer (student/admin) | – | `{ entries:[{ rank, userId, name, avatar, levelsCompleted, totalStars, totalMoves, totalTimeMs }], me:{…}\|null, totalPlayers }` |
| GET | `/games/:gameKey/levels/:levelId/leaderboard?limit=20&scope=global\|org` | Bearer (student/admin) | – | `{ entries:[{ rank, userId, name, avatar, moves, timeMs, stars }], me:{…}\|null, totalPlayers }` |

Records a finished game level on the user's account (`User.gameProgress`, best stars kept),
awards base XP/coins by difficulty on the **first** completion, grants a **one-time 3-star
bonus** the first time a level reaches 3 stars, recomputes level, increments
`gameLevelsCompleted` / `perfectLevels` / `totalCoinsEarned`, and runs achievement checks.
Replays that don't improve stars award nothing. Pure award/idempotency logic lives in
`computeGameAward` (`src/utils/economy.js`).

**Move/time leaderboard.** `/games/complete` additionally upserts a `GameScore`
(`src/models/GameScore.js`) for `(user, gameKey, levelId)` — unique per player+level, with
indexes `(gameKey, levelId, moves, timeMs)` and `(gameKey, user)`. The **best** result is
kept in place: fewer `moves` wins, tie-broken by lower `timeMs`; `stars` keeps the max seen.
Omitting `moves`/`timeMs` still records stars and leaves the stored move/time unchanged.
The response's `best` is the stored best for that level and `levelRank` is the player's
1-based rank by moves asc, timeMs asc (null if no moves recorded). `org` is copied from the user.

- **Game leaderboard** aggregates per player across the game from `GameScore` docs:
  `levelsCompleted` (distinct levels with a score), `totalStars`, `totalMoves` and
  `totalTimeMs` (nulls ignored). Ranked by `levelsCompleted` desc, then `totalStars` desc,
  then `totalTimeMs` asc (faster wins).
- **Level leaderboard** ranks players with a score for that level by `moves` asc, then
  `timeMs` asc.
- `scope=org` restricts to the requester's organization; `scope=global` (default) spans all
  students. The requester's own row is always returned as `me`, even outside the top `limit`.
  Name/avatar are resolved via a Mongoose aggregation `$lookup` on users. Pure, DB-free
  ranking helpers (`isBetterScore`, `aggregatePerGame`, `comparePerLevel`,
  `comparePerGameAggregate`) live in `src/utils/leaderboard.js` and are unit-tested in
  `tests/leaderboard.test.js`.

### Achievements / Challenges / Leaderboards / Notifications

| Method | Path | Auth | Returns |
| --- | --- | --- | --- |
| GET | `/achievements` | Bearer | `[{ key, title, description, icon, progress, target, percent, unlocked }]` (per-user progress) |
| GET | `/achievements/catalog` | – | `[achievements]` (raw catalog, no per-user progress) |
| GET | `/challenges/daily` | – | `[challenges]` |
| POST | `/challenges/:id/complete` | Bearer | `{ xpEarned, coins }` |
| GET | `/leaderboards?scope=global` | – (optional Bearer) | `{ scope, entries:[{ rank, name, avatar, xp, level }], me:{…}\|null }` |
| GET | `/leaderboards?scope=school` | Bearer | `{ scope:"school", entries:[{ rank, name, avatar, xp, level }], me:{…}\|null }` |
| GET | `/notifications` | Bearer | `[notifications]` |

**Leaderboard scope.** `scope=global` (default, **public**) ranks students platform-wide
by XP. `scope=school` ranks students **within the requesting user's organization** and
therefore **requires auth** (`401` if unauthenticated); the org is taken from `req.user.org`.
Both variants return the same entry shape `{ rank, name, avatar, xp, level }` and, when the
request is authenticated, include the caller's own `me: { rank, name, avatar, xp, level }`
(`null` if they are not a ranked student). The legacy `?type=global|school|weekly` param is
still accepted for back-compat (unknown types are treated as `global`); prefer `scope`.

**Achievement criteria** are `{ type, target }`. Supported `type` values:
`levelsCompleted`, `perfectLevels`, `quizzesPassed`, `lessonsCompleted`, `totalXp`,
`reachLevel`, `coinsEarned`, `worldsUnlocked` (worlds whose `requiredLevel ≤ user.level`),
`dailyChallenge`. Progress is computed against the user's cumulative counters; an
achievement unlocks when `progress ≥ target` and is then pushed onto `User.achievements`
(deduped) with a notification. Pure logic lives in `src/utils/achievementProgress.js`.

Seeded achievements: First Code (`levelsCompleted` 1), Getting Started (5), Code Explorer
(20), Maze Runner (40), Perfectionist (`perfectLevels` 10), Flawless (25), Quiz Whiz
(`quizzesPassed` 5), Quiz Master (15), XP Hunter (`totalXp` 1000), Rising Star
(`reachLevel` 10), Coin Collector (`coinsEarned` 500), Treasure Hoarder (2500).

### Avatar (`/avatar`)

| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| GET | `/avatar/items` | – | – | `[AvatarItem]` (full catalog) |
| GET | `/avatar/me` | Bearer | – | `{ avatar, inventory[keys], ownedItems[] }` |
| PUT | `/avatar/me` | Bearer | `{ key }` | `{ avatar }` (equips an owned item into its slot) |

`AvatarItem` shape: `{ key, name, type: skin|outfit|accessory|pet|effect|background, price, requiredLevel, rarity: common|rare|epic|legendary, asset, isDefault }`.
`User.avatar` carries equipped slots: `{ skin, outfit, accessory, pet, profileEffect, background }`. Ownership is tracked on `User.inventory` (array of item keys); `isDefault` items are always owned. The shop carries 6 categories × 8 items (48 total), with one or two free defaults per category and the rest priced across the 50→5000 ladder.

### Shop / Economy (`/shop`)

| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| GET | `/shop/items` | Bearer | – | `[AvatarItem + { owned }]` (purchasable catalog) |
| POST | `/shop/purchase` | Bearer | `{ itemKey }` | `{ coins, item }` |
| GET | `/shop/purchases` | Bearer | – | `[Purchase]` (history, populated item) |

`POST /shop/purchase` validates coins ≥ price and level ≥ requiredLevel, rejects already-owned/insufficient with `400`, deducts coins atomically, adds the key to `inventory`, and records a `Purchase { user, item, itemKey, priceCoins }`.

### Quizzes (`/quizzes`)

| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| GET | `/quizzes` | – | – | `[{ id, title, type, questionCount, xpReward, typeCounts:{ [type]: n }, lesson:{ id, title }, world:{ id, name, slug } }]` (list to discover a real quiz id) |
| GET | `/quizzes/:id` | – | – | Quiz **without** correct answers/explanations |
| POST | `/quizzes/:id/submit` | Bearer | `{ answers: { [questionId]: answer } }` | `{ score, total, correctCount, passed, xpEarned, coinsEarned, pending, alreadyAttempted, perQuestion:[{questionId, correct}] }` |

Server-side grading per question type: `mcq` (index or value match), `fillblank` (case-insensitive trimmed; accepts an array of accepted answers), `match` (order-independent pair equality), `dragdrop` (ordered array equality), `coding` (normalized expected-output compare, or marked **pending** when no expected output). Pass = ≥ 70%. First passing attempt awards **+50 XP** / **+15 coins**, increments the user's `quizzesPassed` + `totalCoinsEarned` counters, runs achievement checks, and is idempotent per user+quiz via a unique `QuizAttempt` record.

### Playground (`/playground`, code execution)

| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| POST | `/playground/run` | Bearer | `{ language: python\|javascript, code, stdin? }` | `501` (disabled by default) or `{ stdout, stderr, output, exitCode, mocked }` |

**Server-side code execution is DISABLED by default.** The Playground now runs user code
entirely client-side (in the browser), so the server no longer spawns interpreters — this
closes the local `child_process` RCE surface. By default `POST /playground/run` returns
`501` with `"Server-side code execution is disabled; code runs in your browser."`

Set **`ENABLE_SERVER_CODE_EXEC=true`** to re-enable the server-side runner. Only do this
behind a real sandbox (self-hosted Piston, or a jailed/Docker runner). When enabled, it runs
user code via local interpreters and/or the public **Piston API**
(`https://emkc.org/api/v2/piston/execute`), controlled by `CODE_RUNNER` (`auto` (default) `|
local | piston`); `python → python`, `javascript → node`. On failure it falls back to a safe
mock (it never evals user code inline). The route keeps its tighter rate limit (20 runs/min).

### Uploads (`/uploads`)

| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| POST | `/uploads/avatar` | Bearer | `multipart/form-data` file field `file` | `{ url, publicId }` |

Uses `multer` memory storage + the Cloudinary SDK (configured from `CLOUDINARY_*`). If Cloudinary env is not set, returns `503 "Uploads not configured"` (never crashes at boot). The returned URL is also saved on `user.avatar.url`.

### Admin (`/admin`, admin role)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/admin/stats` | `{ totalStudents, activeStudents, completionRate, xpDistribution[] }` |
| GET | `/admin/students?search=&page=&limit=` | Paginated student search (org-scoped; used by the org drill-in) |
| POST | `/admin/students` | Single create. Body `{ firstName, lastName?, email? (optional), phone?, username? (optional), password? }` (password min 6, default `Keydzz@123` if omitted). `email` is now optional; `username` is auto-generated from `firstName` when omitted. `name` is composed as `firstName lastName`. Returns `{ student, username, password }`. |
| POST | `/admin/students/bulk` | `multipart/form-data`: file field **`file`** (.xlsx/.xls/.csv) **plus** text field **`password`** (the one common password applied to every student in the batch, min 6). See bulk shape below. |
| GET | `/admin/students/template` | `.xlsx` template download with header row `firstName, lastName, email, phone, username` + example rows (email + username optional) |
| GET | `/admin/students/export` | CSV roster download (`text/csv`, `<slugOrCode>_students.csv`) of all org students: columns `name,grade,school,email,xp,level,coins,status,createdAt` |
| PATCH | `/admin/students/:id/suspend` | Body `{ suspend?: boolean }` (default true) |
| POST | `/admin/students/:id/reset-password` | Body `{ password? }` (min 6; generated if omitted). Resets the student's password, invalidates their refresh token, returns `{ student: { id, name, email, username }, password }` (plaintext). 404 if the student is outside the admin's org. |
| GET | `/admin/students/:id` | Single student **profile + progress** (org-scoped: `404` if the student is outside the admin's org). See payload below. |
| GET/POST/GET:id/PUT/PATCH/DELETE | `/admin/courses` | Course CRUD (platform-level, see note) |
| GET/POST/GET:id/PUT/PATCH/DELETE | `/admin/lessons` | Lesson CRUD (platform-level) |
| GET/POST/GET:id/PUT/PATCH/DELETE | `/admin/challenges` | Challenge CRUD (platform-level) |
| GET/POST/GET:id/PUT/PATCH/DELETE | `/admin/achievements` | Achievement CRUD (platform-level) |
| GET/POST/GET:id/PUT/PATCH/DELETE | `/admin/shop-items` | Shop-item (**AvatarItem**) CRUD (platform-level). Body `{ key, name, type: skin\|outfit\|accessory\|pet\|effect\|background, price?, requiredLevel?, rarity?: common\|rare\|epic\|legendary, asset?, isDefault? }`. `key` is unique — a duplicate returns `409`. |
| GET/POST/GET:id/PUT/PATCH/DELETE | `/admin/quizzes` | Quiz CRUD with nested questions (platform-level). See body/shape below. |
| POST | `/admin/notifications/broadcast` | Body `{ title, body?, scope? }` (platform-level) |

#### Student detail + progress (`GET /admin/students/:id`)

Also available to the super admin as `GET /superadmin/students/:id` (any org) and
`GET /superadmin/orgs/:id/students/:studentId` (that org's student). Response `data`:

```json
{
  "student": {
    "id": "...", "name": "Asha Rao", "firstName": "Asha", "lastName": "Rao",
    "username": "asharao", "email": "asha@example.com", "phone": "",
    "grade": "", "school": "", "status": "active",
    "org": { "id": "...", "name": "Koding Keydzz Academy" },
    "xp": 1200, "level": 5, "coins": 300, "nextLevelXp": 1500,
    "totalCoinsEarned": 450, "createdAt": "2026-01-01T00:00:00.000Z"
  },
  "stats": { "quizzesPassed": 4, "gameLevelsCompleted": 12, "perfectLevels": 3, "lessonsCompleted": 9 },
  "gameProgress": [{ "gameKey": "maze", "levelsCompleted": 2, "totalStars": 5 }],
  "achievements": [{ "key": "first_steps", "title": "First Steps", "icon": "🎯", "unlocked": true, "progress": 1, "target": 1, "percent": 100 }]
}
```

`org` is `null` for a student with no org. `gameProgress` aggregates the student's flat
`gameProgress` rows (`{ gameKey, levelId, stars }`) into per-game `{ levelsCompleted, totalStars }`.
`achievements` reuses the same per-user progress computation as `GET /achievements` / the dashboard.

#### Quiz management (`/admin/quizzes`)

Questions are stored **embedded** in the Quiz document (not a separate collection), so a
`DELETE` removes the quiz and its questions together. Both `lesson` and `world` are optional
refs (a quiz may hang off a lesson — inheriting its world — or be pinned directly to a world).

- **GET `/admin/quizzes`** → `[{ id, title, type, xpReward, questionCount, lesson:{ id, title }\|null, world:{ id, name, slug }\|null }]`.
- **GET `/admin/quizzes/:id`** → the FULL quiz **including each question's answer** (this is the admin editor endpoint — unlike the student-facing `GET /quizzes/:id`, answers are **not** stripped):

  ```json
  {
    "id": "...", "title": "Loops Quiz", "type": "mcq", "xpReward": 50,
    "lesson": { "id": "...", "title": "For loops" }, "world": { "id": "...", "name": "Python Kingdom", "slug": "python-kingdom" },
    "questions": [{ "id": "...", "type": "mcq", "prompt": "2+2?", "options": ["3","4"], "answer": 1, "explanation": "", "points": 10 }]
  }
  ```

- **POST `/admin/quizzes`** → body `{ title, lesson?, world?, type?, xpReward?, questions: [{ type: mcq\|fillblank\|match\|dragdrop\|coding, prompt, options?, answer, points?, explanation? }] }`. Each question's `answer` is persisted as the model's `correctAnswer` (Mixed — index/string/array/map per type); `correctAnswer` is accepted as an alias. Missing `type` → `mcq`, missing `points` → `10`.
- **PUT/PATCH `/admin/quizzes/:id`** → partial update. When `questions` is supplied it **replaces** the existing set wholesale.
- **DELETE `/admin/quizzes/:id`** → removes the quiz (+ embedded questions).

#### Bulk student upload (Excel)

Both org admins (`POST /admin/students/bulk`, into their own org) and the super admin
(`POST /superadmin/orgs/:id/students/bulk`, into a chosen org) upload students from a
spreadsheet via the **same** bulk service. The request is `multipart/form-data`:

- **`file`** — the `.xlsx`/`.xls`/`.csv` workbook (max 5MB).
- **`password`** — one **common password** (string, min 6) applied to **every** student
  in the batch. Each student logs in with a **username** (their login id) — supplied in the
  `username` column, or **auto-generated** from `firstName` when blank. The password is
  shared. (A power user may add a per-row `password` column; that row then uses its own
  password. If neither is present the default `Keydzz@123` is used.)

Template / accepted columns (header keys are case-insensitive and space-tolerant, e.g.
`first name`, `FIRSTNAME`):

| Column | Required | Notes |
| --- | --- | --- |
| `firstName` | yes | used to compose `name` |
| `lastName` | no | composes `name = "firstName lastName"` |
| `email` | **no (optional)** | validated + lowercased when present; unique when present |
| `phone` | no | stored on the student |
| `username` | **no (optional)** | the login id; lowercased; **auto-generated** from `firstName` when blank; unique |
| `password` | no (power-user) | overrides the common password for that row |

Per-row handling: rows missing `firstName`, with an invalid email (when one is provided),
duplicated in-file (by email **or** username when present), with a username already in use,
or already existing in the target org (by email) are **skipped** with a reason. Response
(HTTP 201) — `created[]` includes the **username** so the admin can hand out the login id
plus password:

```json
{
  "createdCount": 2,
  "skippedCount": 1,
  "created": [{ "name": "Asha Rao", "username": "asharao", "email": "asha.rao@example.com", "phone": "9876543210", "password": "Common@123" }],
  "skipped": [{ "row": 3, "email": "dup@example.com", "reason": "Duplicate in file" }]
}
```

Successful creates increment the org's `studentCount`.

**Authorization split.** Student management routes (`/admin/stats`, `/admin/students*`) are org-scoped: they require `authorize('admin')` **and** `requireOrg`, so the tenant-less superadmin cannot call them (it manages students via `/superadmin/students*` instead). The content-management routes (`/admin/courses`, `/admin/lessons`, `/admin/challenges`, `/admin/achievements`, `/admin/shop-items`, `/admin/quizzes`, `/admin/notifications/broadcast`) are **platform-level** and authorized with `authorize('admin', 'superadmin')` with **no** `requireOrg`, so both org admins and the superadmin can manage shared content.

### Super Admin (`/superadmin`, superadmin role)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/superadmin/stats` | `{ totalOrgs, activeOrgs, totalAdmins, totalStudents }` |
| GET | `/superadmin/analytics` | Platform-wide analytics (see shape below) |
| POST | `/superadmin/orgs` | Create org + its admin |
| GET | `/superadmin/orgs` | List orgs (with student counts + admin) |
| GET | `/superadmin/orgs/:id` | Org detail (returns the live student count) |
| PATCH | `/superadmin/orgs/:id` | Update org name/status |
| PATCH | `/superadmin/orgs/:id/admin` | Update an org's admin |
| DELETE | `/superadmin/orgs/:id` | Delete org (cascades users) |
| GET | `/superadmin/orgs/:id/students?search=&page=&limit=` | List students **in that org** (paginated/searchable). `404` if the org is not found. Same row shape as `/superadmin/students`. |
| GET | `/superadmin/orgs/:id/students/:studentId` | Single student **profile + progress** for that org's student. `404` if the org is missing or the student isn't in it. Same payload as `GET /admin/students/:id`. |
| POST | `/superadmin/orgs/:id/students/bulk` | Bulk upload **into org `:id`**. `multipart/form-data` with file field **`file`** + text field **`password`** (common, min 6). Same bulk response shape as `/admin/students/bulk`. `404` if the org is not found. Increments `org.studentCount`. |
| POST | `/superadmin/orgs/:id/students` | Single create **into org `:id`**. Body `{ firstName, lastName?, email? (optional), phone?, username? (optional), password? }`. Returns `{ student, username, password }`. `404` if the org is not found. |
| GET | `/superadmin/students/template` | `.xlsx` template (`firstName, lastName, email, phone, username`) — the super admin has no org but needs the template to upload into one. |
| GET | `/superadmin/students?search=&org=&page=&limit=` | **All** students across orgs, paginated + searchable (name/email/username). Each row is the student (incl. `username`, and `email` when present) plus `org:{ id, name, code }` (or `null`). |
| GET | `/superadmin/students/:id` | Single student **profile + progress**, any org (unscoped). Same payload as `GET /admin/students/:id`. `404` if not a student. |
| PATCH | `/superadmin/students/:id/suspend` | Body `{ suspend?: boolean }` (default true). Global (not org-bound). |
| POST | `/superadmin/students/:id/reset-password` | Body `{ password? }` (min 6; generated if omitted). Global; reuses the same generator as admin reset. Returns `{ student:{ id, name, email, username }, password }`. |

`GET /superadmin/analytics` returns (all computed via Mongoose aggregation, real data only):

```json
{
  "totals": { "orgs": 0, "activeOrgs": 0, "suspendedOrgs": 0, "admins": 0, "students": 0, "suspendedStudents": 0 },
  "growth": { "students": [{ "period": "YYYY-MM", "count": 0 }], "orgs": [{ "period": "YYYY-MM", "count": 0 }] },
  "studentsPerOrg": [{ "orgId": "...", "org": "...", "code": "...", "students": 0 }],
  "xpDistribution": [{ "bucket": "0-99", "count": 0 }],
  "levelDistribution": [{ "level": 1, "count": 0 }],
  "activeUsers": { "last7": 0, "last30": 0 },
  "topOrgsByStudents": [{ "org": "...", "code": "...", "students": 0 }],
  "topOrgsByXp": [{ "org": "...", "code": "...", "totalXp": 0 }],
  "contentCounts": { "worlds": 0, "lessons": 0, "quizzes": 0, "challenges": 0, "achievements": 0, "avatarItems": 0 }
}
```

`growth` covers the last 6 months by `createdAt`. `activeUsers` counts students whose `updatedAt` falls within the window. `xpDistribution` buckets: `0-99`, `100-499`, `500-1999`, `2000-4999`, `5000-9999`, `10000+`.

## Real-time (Socket.IO)

Connect with an optional access token in the handshake:

```js
io("http://localhost:5000", { auth: { token: accessToken } });
```

Authenticated sockets join a `user:<id>` room and receive a `notification` event
on level-ups, achievements, and admin broadcasts.

### Battle Arena (real-time multiplayer)

In-memory matchmaking pairs two authenticated players into a coding duel. State
(`waiting` queue + active `rooms`) is held in memory.

**Client → server events**

| Event | Payload | Description |
| --- | --- | --- |
| `join_queue` | – | Enter matchmaking (requires an authenticated socket). |
| `leave_queue` | – | Leave matchmaking. |
| `submit_answer` | `{ roomId?, output }` | Submit your answer/output for the battle question. |

**Server → client events**

| Event | Payload | Description |
| --- | --- | --- |
| `queued` | `{ position }` | Acknowledges queue entry. |
| `left_queue` | `{}` | Acknowledges leaving the queue. |
| `battle_start` | `{ roomId, players, question:{ prompt, language } }` | Two players matched; prompt sent to both (answer never leaked). |
| `answer_result` | `{ correct, score }` | Result of your submission. |
| `battle_end` | `{ roomId, reason, winnerUserId, scores, rewards }` | Battle over; winner gets **+100 XP / +25 coins**. |
| `battle_error` | `{ message }` | e.g. unauthenticated join attempt. |

Win conditions: **first correct answer wins**; if both finish without a first-correct, the **higher score** wins (else draw). Disconnecting during an active battle **forfeits** it (the opponent wins). Reasons: `first_correct`, `higher_score`, `draw`, `forfeit`.

## Security

- `helmet`, CORS restricted to `CLIENT_ORIGINS` (includes `http://localhost:5173` and `5174`).
- `express-mongo-sanitize` against NoSQL injection.
- `express-rate-limit` on `/auth` and a general limiter on `/api`.
- Passwords hashed with bcrypt; never returned in responses.
- JWT access (15m) + refresh (7d) with separate secrets; the refresh token's hash
  is stored on the user and rotated on login/register, cleared on logout.
- Role-based `authorize(...roles)` middleware.
- Central error handler returning `{ success: false, message }`.

## Tests

Pure, fast unit tests with **Vitest** (no live MongoDB or network required):

```bash
npm test
```

Covers `src/utils/xp.js` (level math), the quiz grading helpers exported from
`src/services/quizService.js`, the pure `validatePurchase` logic in
`src/services/shopService.js`, the pure analytics helpers in
`src/utils/analytics.js` (XP bucketing + month-series grouping used by
`/superadmin/analytics`), the game-level award/idempotency logic
(`computeGameAward` in `src/utils/economy.js`) and the per-event award amounts,
and the achievement progress computation (`src/utils/achievementProgress.js`).
`supertest` is included as a dev dependency for future HTTP-level tests.

## Seeded worlds

The curriculum is **concept-oriented**: the first four worlds teach the ideas behind coding
in a language-neutral way, and only the fifth, **Python Kingdom**, teaches a real
programming language (Python). There is no JavaScript or AI/ML content.

1. Coding Forest (requiredLevel 1) — Variables, Stored Values, Input, Output *(concepts)*
2. Loop Mountain (requiredLevel 3) — For Loops, While Loops, Nested Loops *(concepts)*
3. Function Castle (requiredLevel 6) — Functions, Parameters, Return Values *(concepts)*
4. Algorithm Desert (requiredLevel 9) — Conditions, Boolean Logic, Problem Solving *(concepts)*
5. Python Kingdom (requiredLevel 12) — Python Syntax, Running Python, Putting It Together *(real Python)*
