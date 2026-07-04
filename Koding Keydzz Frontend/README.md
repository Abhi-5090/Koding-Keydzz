# 🗝️ Koding Keydzz — Learn Coding Through Adventure

A premium, game-first student frontend for an educational coding platform for kids aged 6–16.
Built to feel like an adventure game, not an LMS.

## ✨ Tech Stack

- **React 18 + Vite** (plain JS + JSX)
- **React Router DOM v6** — public + protected student routes
- **Redux Toolkit + RTK Query** — auth + student data, 401 re-auth via `/auth/refresh`
- **TailwindCSS v3** — "Golden Coding Kingdom" (Turmeric + Malt) design system
- **GSAP + ScrollTrigger** — landing-page scroll reveals & parallax
- **Framer Motion** — component/page transitions and micro-interactions
- **@monaco-editor/react** — real code Playground (Python / JavaScript)
- **socket.io-client** — wired for real-time leaderboards/notifications
- **lottie-react** — available for optional lazy animations

## 🎨 Design System — Golden Coding Kingdom

| Token | Hex |
|-------|-----|
| turmeric | `#FFBE0B` |
| malt | `#2A2312` |
| accent | `#FFD54A` |
| success | `#4CAF50` |
| error | `#FF5252` |
| card | `#3A301A` |
| surface | `#4A3D20` |
| text-primary | `#FFFFFF` |
| text-secondary | `#F5E6B8` |
| k-border | `#FFBE0B33` |

Fonts: **Poppins** (headings 800), **Inter** (body), **Fredoka** (game text) — loaded via Google Fonts.
Golden glow utility: `box-shadow: 0 0 24px rgba(255,190,11,0.6)`.

## 🌍 The 7 Game Worlds

1. 🌳 **Coding Forest** — Variables, Inputs, Outputs
2. ⛰️ **Loop Mountain** — For / While Loops
3. 🏰 **Function Castle** — Functions, Parameters, Return Values
4. 🏜️ **Algorithm Desert** — Logic, Problem Solving
5. 🐍 **Python Kingdom** — Python
6. 🚀 **JavaScript Galaxy** — JavaScript
7. 🤖 **AI Future City** — AI, ML Basics, Prompt Engineering

## 🚀 Getting Started

```bash
npm install
npm run dev      # starts on http://localhost:5173
npm run build    # production build
npm run preview  # preview the build
```

### Environment

`.env`:

```
VITE_API_URL=http://localhost:5000/api/v1
```

## 🔌 API Contract (RTK Query)

- `POST /auth/login` → `{ user, accessToken, refreshToken }`
- `POST /auth/register/student` → `{ name, grade, school, email, password }`
- `GET  /auth/me`
- `GET  /student/dashboard`
- `GET  /worlds`
- `GET  /leaderboards?type=global`
- `GET  /notifications`
- `POST /auth/refresh` (used automatically on 401)

> **Offline-friendly:** every data page degrades gracefully to bundled demo
> data when the backend is unavailable, so the app always renders. The Login
> screen also offers a one-click **Try Demo Mode** button.

## 📁 Project Structure

```
src/
  app/            store.js, api/baseApi.js, socket.js
  features/
    auth/         authSlice.js, authApi.js
    student/      studentApi.js
  components/
    ui/           Button, Card, GlowBadge, XPBar, CoinCounter,
                  Particles, FloatingShapes, Mascot, Confetti
    layout/       StudentLayout, PageTransition
  hooks/          useAuth, useGsap
  data/           worlds.js, mockData.js
  pages/          Landing, Login, Register, Dashboard, WorldMap,
                  Playground, Quiz, Achievements, Leaderboard, Shop, Profile
  routes/         AppRoutes.jsx, ProtectedRoute.jsx
  App.jsx, main.jsx, index.css
```

## 🛡️ Routes

- **Public:** `/`, `/login`, `/register`
- **Protected (StudentLayout):** `/dashboard`, `/map`, `/play`, `/quiz`,
  `/achievements`, `/leaderboard`, `/shop`, `/profile`
- `ProtectedRoute` redirects to `/login` when there is no access token.

---

Made with golden glow ✨ for the Koding Keydzz kingdom.
