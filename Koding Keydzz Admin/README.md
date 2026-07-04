# Koding Keydzz — Admin Portal

Enterprise admin dashboard for the **Koding Keydzz** educational gaming platform.
Built with React 18 + Vite, Redux Toolkit + RTK Query, TailwindCSS, Recharts,
Framer Motion and lucide-react. Golden (Turmeric + Malt) brand language.

## Features

- **Auth** — admin-only login (rejects non-admin roles), Bearer token via RTK Query, 401 refresh handling, persisted session.
- **Dashboard** — Total / Active students, Completion Rate, Avg XP stat cards plus four animated Recharts (XP distribution bar, growth line, completion area, world pie).
- **Students** — searchable / sortable / paginated DataTable; view progress, XP, achievements; suspend / reinstate accounts.
- **Courses** — CRUD courses and nested lessons via modal forms.
- **Challenges** — CRUD challenges (easy / medium / hard, XP & coin rewards, daily + active toggles).
- **Achievements** — CRUD badges (key, title, description, icon picker, criteria).
- **Notifications** — broadcast announcements, rewards and event notifications with live preview and history.
- **Super Admin** — platform-wide analytics, organization provisioning (with org-admin credentials), suspend / reset / delete, and a cross-org student directory.
- **Robust states** — every data view has real loading / empty / error (with Retry) states via `QueryState`; there is no mock-data fallback and no demo-login bypass. When the API is unreachable, pages surface a clear error.

## Quick start

```bash
npm install
npm run dev       # http://localhost:5176
```

### Login

Sign in with real Org Admin or Super Admin credentials issued by the backend.
Super Admins land on `/superadmin`; Org Admins land on `/dashboard`. Non-admin
accounts are rejected.

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start dev server on port **5176**    |
| `npm run build`   | Production build to `dist/`          |
| `npm run preview` | Preview the build on port **5176**   |
| `npm test`        | Run the Vitest suite                 |

## Configuration

The API base URL is **never hardcoded** — it is read from `import.meta.env.VITE_API_URL`
at build time. Set it per environment (e.g. Vercel project env vars). Local `.env`:

```
VITE_API_URL=http://localhost:5500/api/v1
```

## API contract

Responses use `{ success, data, message }`.

- `POST /auth/login` → `{ user(role), accessToken, refreshToken }`
- `GET  /admin/stats` → `{ totalStudents, activeStudents, completionRate, xpDistribution[] }`
- `GET  /admin/students` (paginated / search)
- `PATCH /admin/students/:id/suspend`
- CRUD `/admin/courses`, `/admin/lessons`, `/admin/challenges`, `/admin/achievements`
- `POST /admin/notifications/broadcast`

## Project structure

```
src/
  app/store.js, app/api/baseApi.js
  features/auth/       authSlice.js, authApi.js
  features/admin/      adminApi.js
  features/superadmin/ superadminApi.js
  features/students/   rosterHttp.js  (multipart bulk upload + binary downloads)
  components/layout/   AdminLayout.jsx
  components/ui/        StatCard, DataTable, Modal, Button, FormField,
                        ConfirmDialog, ChartCard, PageHeader, QueryState
  components/org/       OrgCard, OrgStudents, orgSources
  components/students/  BulkUploadModal
  pages/               Login, Dashboard, Students, Courses, Challenges,
                       Quizzes, Achievements, ShopItems, Leaderboards, Notifications,
                       MyOrganization
  pages/superadmin/    SuperAdminDashboard, Organizations, OrgDetail, AllStudents
  routes/              AppRoutes.jsx, ProtectedRoute.jsx
  main.jsx, App.jsx, index.css
```
