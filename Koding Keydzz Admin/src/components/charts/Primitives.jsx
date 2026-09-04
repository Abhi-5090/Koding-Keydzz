import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Info, BarChart3 } from 'lucide-react';
import { compact } from './chartTheme';
// The palette is resolved PER THEME — the dark ramps are invalid on a white
// card (the teal drops to 2.93:1, the sequential light end to 1.39:1), so
// every chart reads its colours from this hook instead of module constants.
import useChartTheme from './useChartTheme';
// KPI figures COUNT UP rather than appearing. On a dashboard that is the
// difference between a screenshot and a briefing — the number arriving is what
// makes a viewer look at it. Falls back to the plain figure under
// prefers-reduced-motion and if the GSAP chunk never loads.
import { useCountUp } from '../../motion/hooks';

/**
 * Chart primitives.
 *
 * Every chart here ships with:
 *   • a hover layer (an HTML chart IS interactive — a static one wastes it);
 *   • a legend whenever there are 2+ series, so identity is never colour-alone;
 *   • an honest EMPTY state. A chart with no data must say so rather than
 *     draw an empty grid, which reads as "broken" to a non-technical user —
 *     and this product is used by teachers, not analysts;
 *   • recessive axes and horizontal-only gridlines.
 */

/* ========================================================================== */
/* Shared shells                                                              */
/* ========================================================================== */

/** Shown instead of an axis-only skeleton when a chart genuinely has no data. */
export function ChartEmpty({ message = 'No data yet', hint }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <BarChart3 size={26} className="text-text-secondary/35" aria-hidden="true" />
      <p className="text-sm font-semibold text-text-secondary">{message}</p>
      {hint && <p className="max-w-[36ch] text-xs text-text-secondary/70">{hint}</p>}
    </div>
  );
}

/** True when every value in a series is zero/absent — visually identical to no data. */
function isFlatEmpty(data, keys) {
  if (!data?.length) return true;
  return !data.some((row) => keys.some((k) => Number(row[k]) > 0));
}

/** Card shell with a title, optional help text, and an optional right-hand slot. */
export function ChartPanel({
  title,
  subtitle,
  help,
  action,
  children,
  height = 260,
  index = 0,
  className = '',
}) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className={`k-card min-w-0 p-5 ${className}`}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-heading text-base font-bold text-text-primary">
              {title}
            </h3>
            {/* Plain-language explanation of the metric, for readers who do not
                already know what "stickiness" or "coverage" means. */}
            {help && (
              <button
                type="button"
                onClick={() => setShowHelp((v) => !v)}
                aria-expanded={showHelp}
                aria-label={`What does "${title}" mean?`}
                className="rounded-full p-0.5 text-text-secondary/70 transition-colors hover:text-turmeric focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
              >
                <Info size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          {subtitle && <p className="truncate text-xs text-text-secondary/70">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>

      {showHelp && help && (
        <p className="mb-3 rounded-lg border border-k-border bg-surface/60 p-3 text-xs leading-relaxed text-text-secondary">
          {help}
        </p>
      )}

      <div className="w-full min-w-0" style={{ height }}>
        {children}
      </div>
    </motion.section>
  );
}

/* ========================================================================== */
/* KPI tile                                                                   */
/* ========================================================================== */

/**
 * A single headline number with a period-over-period trend.
 *
 * `delta` of null renders as "—", NOT as +100%. When there is no previous
 * baseline there is no honest percentage to show, and inventing one is how a
 * dashboard loses a reader's trust.
 */
export function StatTile({
  label,
  value,
  delta = null,
  direction = 'flat',
  hint,
  icon: Icon,
  tone = 'default',
  index = 0,
}) {
  const reduce = useReducedMotion();
  const TrendIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  // Only NUMBERS count. A value like "3 of 12" or an em-dash placeholder has
  // nothing to count to, and tweening one prints NaN on the dashboard.
  const numeric = typeof value === 'number';
  const countRef = useCountUp(numeric ? value : 0, {
    enabled: numeric,
    // Staggered by tile so a row of KPIs reads left to right rather than all
    // spinning at once, which is noise.
    duration: 0.9 + Math.min(index, 5) * 0.05,
  });

  // For most metrics up is good. `tone="inverse"` marks the ones where it is
  // not — more suspended accounts or more pupils needing help is not progress.
  const good = tone === 'inverse' ? direction === 'down' : direction === 'up';
  const trendColor =
    direction === 'flat'
      ? 'text-text-secondary/70'
      : good
        ? 'text-success'
        : 'text-error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="k-card group relative overflow-hidden p-5"
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-turmeric/5 transition-transform duration-300 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-125" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {label}
          </p>
          {/* The final figure is BOTH rendered as children and animated to:
              a screen reader reads the DOM rather than the tween, and if GSAP
              is unavailable the correct number is already on screen.
              `tabular-nums` stops the digits shifting width mid-count. */}
          <p
            ref={numeric ? countRef : null}
            className="mt-2 font-heading text-3xl font-extrabold tabular-nums text-text-primary"
          >
            {numeric ? value.toLocaleString() : value}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-secondary/70">
            <span className={`inline-flex items-center gap-0.5 ${trendColor}`}>
              <TrendIcon size={13} aria-hidden="true" />
              {delta == null ? '—' : `${Math.abs(delta)}%`}
            </span>
            {hint && <span className="truncate">{hint}</span>}
          </p>
        </div>
        {Icon && (
          <motion.div
            className="shrink-0 rounded-xl bg-turmeric/15 p-2.5 text-turmeric"
            animate={reduce ? undefined : { y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: index * 0.2 }}
          >
            <Icon size={22} aria-hidden="true" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ========================================================================== */
/* Trend (area / line)                                                        */
/* ========================================================================== */

/**
 * Change over time. Area for one series, lines for several.
 *
 * NEVER two y-axes: if two measures have different scales they get two charts.
 * Both series here are counts of the same kind of thing (activity events), so
 * one axis is correct.
 */
export function TrendChart({
  data = [],
  xKey = 'date',
  series = [{ key: 'value', label: 'Value' }],
  formatX = (v) => v,
  emptyMessage = 'No activity recorded yet',
  emptyHint,
}) {
  const { CATEGORICAL, INK, axisProps, gridProps, tooltipStyle } = useChartTheme();
  if (isFlatEmpty(data, series.map((s) => s.key))) {
    return <ChartEmpty message={emptyMessage} hint={emptyHint} />;
  }

  const single = series.length === 1;

  return (
    <ResponsiveContainer width="100%" height="100%">
      {single ? (
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CATEGORICAL[0]} stopOpacity={0.34} />
              <stop offset="100%" stopColor={CATEGORICAL[0]} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={formatX} minTickGap={24} />
          <YAxis {...axisProps} tickFormatter={compact} width={44} allowDecimals={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={formatX}
            // Crosshair — the standard read for a time series.
            cursor={{ stroke: INK.axis, strokeWidth: 1 }}
            formatter={(v) => [Number(v).toLocaleString(), series[0].label]}
          />
          <Area
            type="monotone"
            dataKey={series[0].key}
            name={series[0].label}
            stroke={CATEGORICAL[0]}
            strokeWidth={2}
            fill="url(#trendFill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#04212E' }}
          />
        </AreaChart>
      ) : (
        <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={formatX} minTickGap={24} />
          <YAxis {...axisProps} tickFormatter={compact} width={44} allowDecimals={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={formatX}
            cursor={{ stroke: INK.axis, strokeWidth: 1 }}
          />
          {/* 2+ series always get a legend, so identity is never colour-alone. */}
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: INK.secondary, paddingTop: 8 }}
          />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={CATEGORICAL[i]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#04212E' }}
            />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

/* ========================================================================== */
/* Bar breakdown                                                              */
/* ========================================================================== */

/**
 * Magnitude across categories.
 *
 * Horizontal when the labels are words (they need the room) and vertical when
 * they are short buckets. Values are direct-labelled, so the reader does not
 * have to trace back to an axis.
 */
export function BarBreakdown({
  data = [],
  labelKey = 'label',
  valueKey = 'value',
  horizontal = false,
  // NOT defaulted to a palette colour here: default parameters evaluate before
  // the body, so they cannot read the theme hook. Resolved just below instead.
  color,
  suffix = '',
  emptyMessage = 'Nothing to show yet',
  emptyHint,
  colorFor,
}) {
  const { CATEGORICAL, INK, axisProps, gridProps, tooltipStyle } = useChartTheme();
  // Slot 1 is the brand ember in both themes, re-stepped per surface.
  const barColor = color ?? CATEGORICAL[0];
  if (isFlatEmpty(data, [valueKey])) {
    return <ChartEmpty message={emptyMessage} hint={emptyHint} />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={
          horizontal
            ? { top: 4, right: 44, left: 4, bottom: 4 }
            : { top: 16, right: 8, left: -18, bottom: 0 }
        }
        // 2px of surface between adjacent bars.
        barCategoryGap={horizontal ? '22%' : '28%'}
      >
        <CartesianGrid {...gridProps} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...axisProps} tickFormatter={compact} hide />
            <YAxis
              type="category"
              dataKey={labelKey}
              {...axisProps}
              width={132}
              tick={{ fill: INK.secondary, fontSize: 11 }}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={labelKey} {...axisProps} interval={0} />
            <YAxis {...axisProps} tickFormatter={compact} width={44} allowDecimals={false} />
          </>
        )}
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'rgba(157,184,196,0.06)' }}
          formatter={(v) => [`${Number(v).toLocaleString()}${suffix}`, '']}
        />
        <Bar
          dataKey={valueKey}
          // 4px rounded data-end, anchored to the baseline.
          radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          maxBarSize={horizontal ? 20 : 46}
          isAnimationActive={false}
        >
          {colorFor
            ? data.map((row, i) => <Cell key={i} fill={colorFor(row, i)} />)
            : data.map((_, i) => <Cell key={i} fill={barColor} />)}
          <LabelList
            dataKey={valueKey}
            position={horizontal ? 'right' : 'top'}
            formatter={(v) => (Number(v) > 0 ? `${compact(v)}${suffix}` : '')}
            style={{ fill: INK.secondary, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ========================================================================== */
/* Donut                                                                      */
/* ========================================================================== */

/**
 * Parts of a whole — THREE slices at most.
 *
 * Every pair of slices in a donut is visually adjacent, which is a much
 * stricter colour requirement than a bar chart. On this surface the brand
 * palette only supports three all-pairs-separable colours (see chartTheme),
 * so anything with more categories is rendered as a labelled bar chart
 * instead — which is easier to read anyway.
 */
export function DonutSplit({
  data = [],
  labelKey = 'label',
  valueKey = 'value',
  centerLabel,
  centerValue,
  emptyMessage = 'Nothing to show yet',
}) {
  const { CATEGORICAL_ALL_PAIRS, INK, tooltipStyle } = useChartTheme();
  const rows = (data || []).filter((d) => Number(d[valueKey]) > 0);
  if (!rows.length) return <ChartEmpty message={emptyMessage} />;

  if (rows.length > CATEGORICAL_ALL_PAIRS.length) {
    // Too many categories for a colour-safe donut — fall back to bars.
    return (
      <BarBreakdown
        data={rows}
        labelKey={labelKey}
        valueKey={valueKey}
        horizontal
        emptyMessage={emptyMessage}
      />
    );
  }

  const total = rows.reduce((n, r) => n + Number(r[valueKey] || 0), 0);

  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey={valueKey}
            nameKey={labelKey}
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            // 2px surface gap between segments.
            stroke="#04212E"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={CATEGORICAL_ALL_PAIRS[i]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, n) => [
              `${Number(v).toLocaleString()} (${Math.round((Number(v) / total) * 100)}%)`,
              n,
            ]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: INK.secondary }}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerValue != null || centerLabel) && (
        <div className="pointer-events-none absolute inset-0 -mt-5 flex flex-col items-center justify-center">
          <span className="font-heading text-2xl font-extrabold tabular-nums text-text-primary">
            {centerValue}
          </span>
          {centerLabel && (
            <span className="text-[10px] uppercase tracking-wide text-text-secondary/70">
              {centerLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Progress meter                                                             */
/* ========================================================================== */

/** A labelled 0–100% bar. Used for coverage and mastery, where a chart is overkill. */
export function MeterRow({ label, value, sub, tone }) {
  const { INK, STATUS } = useChartTheme();
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  // Traffic-light by value, and the number is always shown as text too, so the
  // reading never depends on colour alone.
  const color =
    tone ||
    (v >= 70 ? STATUS.good : v >= 40 ? STATUS.warning : v > 0 ? STATUS.serious : INK.muted);

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-sm text-text-primary">{label}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-text-primary">
          {v}%
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${v}%`, background: color }}
        />
      </div>
      {sub && <p className="mt-1 text-xs text-text-secondary/70">{sub}</p>}
    </div>
  );
}

/** Small state chip. Always carries a text label — never colour alone. */
export function StatusChip({ children, tone = 'neutral', icon: Icon }) {
  const { STATUS } = useChartTheme();
  const color = STATUS[tone] || STATUS.neutral;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
    >
      {Icon && <Icon size={11} aria-hidden="true" />}
      {children}
    </span>
  );
}

export default {
  ChartPanel,
  ChartEmpty,
  StatTile,
  TrendChart,
  BarBreakdown,
  DonutSplit,
  MeterRow,
  StatusChip,
};
