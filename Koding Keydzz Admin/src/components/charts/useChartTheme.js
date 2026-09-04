import { useMemo } from 'react';
import {
  CATEGORICAL,
  CATEGORICAL_ALL_PAIRS,
  SEQUENTIAL,
  STATUS,
  INK,
  CHART_SURFACE,
  makeAxisProps,
  makeGridProps,
  makeTooltipStyle,
} from './chartTheme';

/**
 * The chart palette and shared chart parameters.
 *
 * ONE theme, so this no longer resolves anything — it is kept because it is
 * the single import site every chart uses for its ramps, axis config, grid and
 * tooltip. Four pages depend on it, and centralising those parameters is what
 * stops a chart being styled slightly differently from its neighbour.
 *
 * Recharts needs concrete colour strings: it computes gradients, measures
 * labels and writes `fill` attributes directly, so handing it
 * `var(--c-primary)` yields an empty attribute in some code paths. Hence real
 * hexes here rather than the CSS variables the rest of the app uses.
 *
 * Every ramp is validated against the surface it is drawn on — see
 * chartTheme.js and scripts/validate-palette.mjs.
 */
export default function useChartTheme() {
  return useMemo(
    () => ({
      surface: CHART_SURFACE,
      // Assign categorical slots in this FIXED order, never cycled — colour
      // follows the entity, so a filter that drops a series must not repaint
      // the ones that remain.
      CATEGORICAL,
      CATEGORICAL_ALL_PAIRS,
      SEQUENTIAL,
      STATUS,
      INK,
      axisProps: makeAxisProps(INK),
      gridProps: makeGridProps(INK),
      tooltipStyle: makeTooltipStyle(INK, 'dark'),
      /** Colour for slot `i`. Never cycles past the end — a 7th series folds
       *  into "Other" or becomes small multiples instead. */
      seriesColor: (i) => CATEGORICAL[i] ?? INK.secondary,
    }),
    []
  );
}
