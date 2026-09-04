# Koding Keydzz — Shared Design Tokens (Single Source of Truth)

> The **Ember theme** — hot orange `#FF602F` on deep teal-navy `#001621`.
> **One theme. The app is dark.** There is no light mode and no theme
> switching.

## Where colour is defined

**Not in components.** Both apps declare the palette as CSS custom properties
in `src/theme.css`, and their Tailwind configs resolve every colour utility to
those variables. `bg-card`, `text-turmeric`, `border-k-border` all keep their
names and read from one place.

That indirection is not about theming — it is so a colour has exactly **one**
definition. The same six brand hexes used to be hand-written in ~90 places
(game-board grounds, SVG fills, the Monaco theme object, inline badge styles)
and they drifted. Never put a brand hex in a component; the few places a class
cannot reach read the tokens through `src/theme/tokens.js`.

Values are space-separated RGB **channels** (`255 96 47`), not hex, so Tailwind
can compose them with an opacity modifier: `bg-surface/80` becomes
`rgb(var(--c-surface) / 0.8)`. The codebase uses those modifiers 300+ times, so
a hex-valued variable would break every one of them silently.

| Token | Tailwind name | Value | Usage |
|---|---|---|---|
| `--c-bg` | `malt` | `#001621` | App background |
| `--c-bg-elev` | `bg-elev` | `#04212E` | Nav, topbar, sidebar |
| `--c-card` | `card` | `#04212E` | Card background |
| `--c-surface` | `surface` | `#0A2E3C` | Raised surface inside a card |
| `--c-text` | `text-primary` | `#FFFFFF` | Primary text |
| `--c-muted` | `text-secondary` | `#9DB8C4` | Secondary text |
| `--c-primary` | `turmeric` | `#FF602F` | Brand — text, icons **and** fills |
| `--c-accent` | `accent` | `#FF6A3D` | Brand hover step |
| `--c-success` | `success` | `#34D399` | Success |
| `--c-error` | `error` | `#FF5470` | Error |
| `--c-focus` | `focus` | `#FF602F` | Focus ring |
| `--c-border-rgb` + `-a` | `k-border` | `#FF602F` @ 16% | Hairline borders |
| `--c-ember` | `ember` | `#FF602F` | The brand hue as a **graphic** — glows, world tints, decorative marks. Never text. |

`ember` is deliberately the same value as `turmeric`. The separate name marks
the places that want the brand hue as a *graphic* rather than as readable ink,
so the two uses do not get conflated.

### These numbers are proven, not chosen

`src/theme/contrast.test.js` **parses `theme.css`** and fails the build if any
pairing drops below WCAG AA (4.5:1 text, 3:1 non-text UI) — 24 assertions per
app. The load-bearing one is the primary button: `bg-turmeric text-malt` works
because a *dark* label on hot orange clears AA at 6.13:1, where white-on-ember
is only 3.0:1.

Two assertions compare the grounds to **each other** (a card must lift off the
page, an inset must recede). Contrast ratios cannot catch a flat palette,
because they only ever compare ink to a ground.

Text on a bright world tint uses the fixed dark ink `ON_TINT` in
`src/theme/tokens.js` — every tint is a bright saturated colour, and
white-on-tint fails AA on all of them.

## Elevation

On a dark ground the brand glow **is** the elevation.

| Token | Value |
|---|---|
| `--shadow-card` | `0 1px 2px rgb(0 0 0 / 0.4)` |
| `--shadow-lift` | `0 12px 32px rgb(0 0 0 / 0.5)` |
| `--shadow-brand` (`shadow-golden-glow`) | `0 0 24px` ember @ 50% |

`--glow-strength`, `--deco-opacity` and `--deco-opacity-mult` scale glows and
ambient decoration from one place; all are at full strength.

## Charts

Chart ramps live in `Koding Keydzz Admin/src/components/charts/chartTheme.js`
and are read through `useChartTheme()` — never the module constants directly.

They are **re-stepped in OKLCH for `#04212E`**, because the design system's UI
ramp fails as a *series* palette on that surface: two slots sit 1.8 ΔE apart
(indistinguishable) and two more fall below the chroma floor (they read as
grey). A palette is only valid against one surface — if the card colour moves,
every value is invalid until re-checked:

```bash
cd "Koding Keydzz Admin"
node scripts/validate-palette.mjs "<hexes>" --mode dark --surface "#04212E"
# --pairs all for the donut ramp, --ordinal for the sequential one
```

That validator is committed (OKLab ΔE, Viénot CVD simulation, lightness band,
chroma floor, surface contrast) so palette changes stay verifiable.

### Categorical ramp (worlds, games, charts, rarities — no rainbow hues)
Warm: `#FF602F` · `#FF6A3D` · `#FF8A4D` · `#E8623C` — Cool: `#1FB6A6` · `#2DD4BF` · `#5BC0BE` — Neutral/bronze: `#9DB8C4` · `#C98A5A`.
Podium: 1st `#FF602F`, 2nd `#9DB8C4`, 3rd `#C98A5A`. Rarity: common `#9DB8C4`, rare `#2DD4BF`, epic `#FF6A3D`, legendary `#FF602F`.

## Glow

- Ember glow: `rgba(255, 96, 47, 0.5)` — used on primary buttons, rewards, achievements, active nav, unlocks. (Tailwind utility name `shadow-golden-glow`/`shadow-glow` is kept; value updated.)
- Box-shadow utility: `0 0 24px rgba(255,96,47,0.5)`

## Motion

- Easing vars: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`, `--ease-back: cubic-bezier(0.34, 1.56, 0.64, 1)`.
- Pressables use `:active`/`whileTap` `scale(0.97)` (~150ms ease-out). UI animations ≤ 300ms, `ease-out` for enter/exit, never `ease-in`. Entries start at `scale(0.95)`+`opacity:0`, never `scale(0)`.
- Animate only `transform`/`opacity` for movement (no `transition: all`). Dropdowns are origin-aware; modals stay centered. Lists stagger 40–70ms. Hover-scale gated behind `@media (hover:hover) and (pointer:fine)`. Full `prefers-reduced-motion` support + `:focus-visible` ring in primary.
- The theme cross-fade is scoped to a transient `.theme-switching` class, **not** left on permanently: a standing `transition: color` on every element puts a 220ms lag on every hover in the app.

### The GSAP layer (`src/motion/`)

Two libraries, on purpose. **framer-motion** stays where it is structural —
`Reorder.Group` in the ordering puzzle, `AnimatePresence` on routes and modals,
and the shared UI kit. **GSAP** is the orchestration layer: timelines, scroll
reveals, counters, the reward sequence.

| Module | What it is for |
|---|---|
| `motion/gsapCore.js` | Lazy loader. GSAP is **112 kB** and is dynamically imported, cached, and preloaded at idle. It must never be imported statically — CI fails if it is. |
| `motion/animations.js` | The vocabulary: `revealIn`, `revealOnScroll`, `countUp`, `celebrate`, `pulseOnce`, `growBar`. |
| `motion/hooks.js` | React bindings: `useRevealIn`, `useRevealOnScroll`, `useCountUp`, `useGrowBar`, `useGsapContext`, `useGsapPreload`. |

Three rules every helper enforces, so no caller has to remember them:

1. **Reduced motion applies the END STATE, not nothing.** An entrance sets
   `opacity: 0`; returning early without settling it leaves the content
   *invisible*, which is far worse than un-animated. Same for a GSAP chunk that
   fails to download. Both paths are covered by tests.
2. **`transform` and `opacity` only** — both composite off the main thread. A
   tween on `width` or `top` re-lays out the page every frame.
3. **Cleanup is returned synchronously**, so a component that unmounts while
   GSAP is still downloading does not leak a tween onto a detached node.

Hooks use `useLayoutEffect`, not `useEffect`: setting the start state after the
browser has painted shows a flash of the finished element before it fades in
from nothing.

## Typography

- Headings: **Poppins** (ExtraBold, 800)
- Body: **Inter**
- Game text / playful: **Fredoka**

## Tailwind theme keys (both apps' `tailwind.config.js`)

Colours resolve to **variables**, never literals — one definition per colour.
`<alpha-value>` is what keeps `bg-surface/80` working; omit it and every
opacity modifier in the codebase silently stops applying.

```js
colors: {
  turmeric: 'rgb(var(--c-primary) / <alpha-value>)',
  malt: 'rgb(var(--c-bg) / <alpha-value>)',
  'bg-elev': 'rgb(var(--c-bg-elev) / <alpha-value>)',
  accent: 'rgb(var(--c-accent) / <alpha-value>)',
  success: 'rgb(var(--c-success) / <alpha-value>)',
  error: 'rgb(var(--c-error) / <alpha-value>)',
  card: 'rgb(var(--c-card) / <alpha-value>)',
  surface: 'rgb(var(--c-surface) / <alpha-value>)',
  'text-primary': 'rgb(var(--c-text) / <alpha-value>)',
  'text-secondary': 'rgb(var(--c-muted) / <alpha-value>)',
  focus: 'rgb(var(--c-focus) / <alpha-value>)',
  // carries its own alpha, so it is composed rather than modified
  'k-border': 'rgb(var(--c-border-rgb) / var(--c-border-a))',
  // BRAND-CONSTANT in both themes
  ember: 'rgb(var(--c-ember) / <alpha-value>)',
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
