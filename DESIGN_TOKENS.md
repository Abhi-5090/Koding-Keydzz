# Koding Keydzz — Shared Design Tokens (Single Source of Truth)

> Every app (Frontend, Admin) must use **exactly** these values. The **Ember theme** — hot orange `#FF602F` on deep teal-navy `#001621`.
> Token *names* are kept from the original theme (`turmeric` = primary, `malt` = background) so existing classes keep working; only the values changed.

## Colors

| Token | Hex | Usage |
|---|---|---|
| `turmeric` (primary) | `#FF602F` | Primary buttons, XP bars, coins, highlights, progress, achievements, active states |
| `malt` (secondary/bg) | `#001621` | App background, nav, sidebars, headers, footers |
| `accent` | `#FF6A3D` | Hover states, interactive elements |
| `success` | `#34D399` | Success states |
| `error` | `#FF5470` | Error states (kept distinct from the orange primary) |
| `card` | `#04212E` | Card background |
| `surface` | `#0A2E3C` | Surface background |
| `text-primary` | `#FFFFFF` | Primary text |
| `text-secondary` | `#9DB8C4` | Secondary text |
| `k-border` | `#FF602F29` | Borders (primary @ ~16%) |

### Categorical ramp (worlds, games, charts, rarities — no rainbow hues)
Warm: `#FF602F` · `#FF6A3D` · `#FF8A4D` · `#E8623C` — Cool: `#1FB6A6` · `#2DD4BF` · `#5BC0BE` — Neutral/bronze: `#9DB8C4` · `#C98A5A`.
Podium: 1st `#FF602F`, 2nd `#9DB8C4`, 3rd `#C98A5A`. Rarity: common `#9DB8C4`, rare `#2DD4BF`, epic `#FF6A3D`, legendary `#FF602F`.

## Glow

- Ember glow: `rgba(255, 96, 47, 0.5)` — used on primary buttons, rewards, achievements, active nav, unlocks. (Tailwind utility name `shadow-golden-glow`/`shadow-glow` is kept; value updated.)
- Box-shadow utility: `0 0 24px rgba(255,96,47,0.5)`

## Motion (Emil Kowalski principles)

- Easing vars: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`.
- Pressables use `:active`/`whileTap` `scale(0.97)` (~150ms ease-out). UI animations ≤ 300ms, `ease-out` for enter/exit, never `ease-in`. Entries start at `scale(0.95)`+`opacity:0`, never `scale(0)`.
- Animate only `transform`/`opacity` for movement (no `transition: all`). Dropdowns are origin-aware; modals stay centered. Lists stagger 40–70ms. Hover-scale gated behind `@media (hover:hover) and (pointer:fine)`. Full `prefers-reduced-motion` support + `:focus-visible` ring in primary.

## Typography

- Headings: **Poppins** (ExtraBold, 800)
- Body: **Inter**
- Game text / playful: **Fredoka**

## Tailwind theme keys (use in both apps' `tailwind.config.js`)

```js
colors: {
  turmeric: '#FF602F',
  malt: '#001621',
  accent: '#FF6A3D',
  success: '#34D399',
  error: '#FF5470',
  card: '#04212E',
  surface: '#0A2E3C',
  'text-primary': '#FFFFFF',
  'text-secondary': '#9DB8C4',
  'k-border': '#FF602F29',
}
```

## Game Worlds (canonical list — shared by backend seed + frontend map)

1. Coding Forest — Variables, Inputs, Outputs
2. Loop Mountain — For Loops, While Loops
3. Function Castle — Functions, Parameters, Return Values
4. Algorithm Desert — Logic, Problem Solving
5. Python Kingdom — Python Programming
6. JavaScript Galaxy — JavaScript Programming
7. AI Future City — AI, ML Basics, Prompt Engineering

## XP rules (shared by backend)

- Lesson complete: +100 XP
- Quiz complete: +50 XP
- Challenge complete: +150 XP
- Project submission: +300 XP
- Levels: 1–100. Level curve: `xpForLevel(n) = 100 * n * (n + 1) / 2` (cumulative triangular).
