/**
 * Chart theme — the validated palette and shared chart parameters.
 *
 * WHY THESE HEXES AND NOT THE ONES IN DESIGN_TOKENS.md
 * ----------------------------------------------------
 * The design system documents a categorical ramp built for UI accents (game
 * tints, rarity badges, world themes). Run through the data-viz checks against
 * this app's chart surface it fails badly as a *series* palette:
 *
 *   #FF602F ↔ #FF6A3D   ΔE 1.8  (normal vision) — indistinguishable
 *   #9DB8C4 ↔ #5BC0BE   ΔE 1.2  (protanopia)
 *   #5BC0BE, #9DB8C4    chroma below the floor — they read as gray
 *
 * Two series painted in colours 1.8 apart are not two series, they are one
 * smudge. So the ramp below keeps the brand's two poles — ember orange and
 * teal — and re-steps everything in OKLCH so adjacent pairs actually separate,
 * every slot sits inside the dark-mode lightness band, and all clear 3:1
 * against the card surface.
 *
 * A PALETTE IS ONLY VALID AGAINST ONE SURFACE
 * -------------------------------------------
 * Every ramp below is checked against #04212E, the card it is drawn on. That
 * is not a formality: these values were re-stepped in OKLCH precisely because
 * the design system's UI ramp failed as a series palette on this surface.
 *
 * If the card colour ever moves, these are all invalid until re-checked.
 *
 * VALIDATED, not eyeballed. Re-run after ANY change:
 *   node scripts/validate-palette.mjs "<hexes>" --mode dark --surface "#04212E"
 *   ... plus --pairs all for the donut ramp, --ordinal for the sequential one.
 */

/** The chart surface — `card` from the design tokens. The validator needs it. */
export const CHART_SURFACE = '#04212E';

/**
 * CATEGORICAL — identity. Assign in this FIXED order, never cycled.
 *
 * Validated (dark, surface #04212E, adjacent pairs): all checks pass.
 *   worst adjacent ΔE 16.0 (deutan) · normal-vision floor 28.0
 *
 * Slots 1 and 2 are the brand poles, so the two most common series in any
 * chart carry the product's identity.
 */
export const CATEGORICAL = [
  '#f45707', // 1 ember   (brand primary)
  '#0aa99b', // 2 teal    (brand secondary)
  '#a86bfd', // 3 violet
  '#b18e15', // 4 amber
  '#0795fd', // 5 blue
  '#fe12a9', // 6 magenta
];

/**
 * DONUT / PIE — every pair is visually adjacent, so this must pass the
 * ALL-PAIRS check, which is much stricter.
 *
 * A warm-anchored brand palette can only support THREE all-pairs-separable
 * slots on this surface: under deuteranopia ember↔amber collapses to ΔE 1.4
 * and blue↔violet to ΔE 0.7. So a donut gets three slices at most — past that
 * use a labelled bar chart, which reads better anyway.
 *
 * Validated (--pairs all): worst ΔE 16.0 (deutan), 14.6 (tritan).
 */
export const CATEGORICAL_ALL_PAIRS = ['#f45707', '#0aa99b', '#a86bfd'];

/**
 * SEQUENTIAL — magnitude. One hue, dim → bright.
 *
 * Runs dim→bright rather than light→dark because the surface is dark: on
 * #04212E the dark end of a conventional ramp disappears. The dimmest step is
 * chosen so it still clears 2:1 against the surface.
 *
 * Validated (--ordinal): monotone lightness, all ΔL gaps ≥ 0.06,
 * dim-end contrast 3.04:1, single hue (19° spread).
 */
export const SEQUENTIAL = [
  '#a8501f',
  '#c96a1a',
  '#e0810f',
  '#f09a3d',
  '#f9b673',
  '#ffd2ab',
];

/**
 * STATUS — reserved for state, never reused as "series 4".
 *
 * Always shipped with an icon and a text label, never colour alone, so the
 * amber here does not have to be separable from the categorical amber.
 */
export const STATUS = {
  good: '#34D399', // from the design tokens
  warning: '#F5A524',
  serious: '#FB7185',
  critical: '#FF5470', // from the design tokens
  neutral: '#9DB8C4',
};

/**
 * Ink tokens. Text NEVER wears a series colour — a mark beside it carries
 * identity, so a label stays legible whatever its series is painted.
 */
export const INK_DARK = {
  primary: '#FFFFFF',
  secondary: '#9DB8C4',
  muted: 'rgba(157, 184, 196, 0.55)',
  grid: 'rgba(157, 184, 196, 0.12)',
  axis: 'rgba(157, 184, 196, 0.25)',
};

export const INK = INK_DARK;

/** Recessive axis config, built over a theme's ink set. */
export const makeAxisProps = (ink) => ({
  stroke: ink.axis,
  tick: { fill: ink.secondary, fontSize: 11 },
  tickLine: false,
  axisLine: false,
});

/** Recessive grid — horizontal only; vertical gridlines add noise, not meaning. */
export const makeGridProps = (ink) => ({
  stroke: ink.grid,
  strokeDasharray: '0',
  vertical: false,
});

/** Tooltip container, matched to the card surface it floats above. */
export const makeTooltipStyle = (ink, theme) => ({
  background: theme === 'light' ? '#FFFFFF' : '#062b3a',
  border:
    theme === 'light'
      ? '1px solid rgba(4, 33, 46, 0.14)'
      : '1px solid rgba(255, 96, 47, 0.28)',
  borderRadius: 10,
  padding: '10px 12px',
  boxShadow:
    theme === 'light'
      ? '0 2px 4px rgba(4,33,46,0.08), 0 12px 28px rgba(4,33,46,0.12)'
      : '0 8px 28px rgba(0, 0, 0, 0.45)',
  fontSize: 12,
  color: ink.primary,
});

export const axisProps = makeAxisProps(INK_DARK);
export const gridProps = makeGridProps(INK_DARK);
export const tooltipStyle = makeTooltipStyle(INK_DARK, 'dark');

/** Colour for slot `i`, assigned by position and never cycled past the end. */
export function seriesColor(i, palette = CATEGORICAL) {
  return palette[i] ?? INK.secondary;
}

/**
 * Compact number formatting for axes and tiles: 1234 -> "1.2k".
 * Keeps a KPI tile from wrapping and an axis from colliding.
 */
export function compact(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(v);
}

/** "2026-09-02" -> "2 Sep". Axis labels must not carry a full ISO date. */
export function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "2026-09" -> "Sep 26". */
export function shortMonth(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

export default {
  CHART_SURFACE,
  CATEGORICAL,
  CATEGORICAL_ALL_PAIRS,
  SEQUENTIAL,
  STATUS,
  INK,
  axisProps,
  gridProps,
  tooltipStyle,
  seriesColor,
  compact,
  shortDate,
  shortMonth,
};
