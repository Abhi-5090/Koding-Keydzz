/**
 * Validate a categorical / sequential chart palette against the surface it is
 * drawn on.
 *
 * WHY THIS LIVES IN THE REPO
 * --------------------------
 * A palette is only valid against ONE surface. When the light theme's card
 * moved from pure white to a warm cream (#FCF8F2) two slots silently dropped
 * under the 3:1 floor — a 2px line in them becomes invisible, and nothing in a
 * screenshot review would catch it. Anyone changing a chart colour or a card
 * colour needs to be able to re-run these checks, so they are committed rather
 * than living in whatever tool happened to be open.
 *
 * USAGE
 *   node scripts/validate-palette.mjs "#hex,#hex,..." --surface "#FCF8F2" [--mode light|dark] [--pairs adjacent|all] [--ordinal]
 *
 * CHECKS
 *   lightness band      every slot sits in the mode's readable L range
 *   chroma floor        nothing so grey it reads as "no data"
 *   CVD separation      pairs stay distinguishable for protan/deutan/tritan
 *   normal-vision floor pairs are distinguishable for full-colour vision
 *   surface contrast    every mark clears 3:1 against its own card (1.4.11)
 *
 * `--ordinal` swaps in the sequential-ramp rules instead: one hue, monotone
 * lightness, visible steps, and a pale end that still clears 2:1.
 */

/* ---------- colour space ---------- */
const hex2rgb = (h) => {
  const s = h.replace('#', '');
  const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
};
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linRgb = (h) => hex2rgb(h).map(toLinear);

/** sRGB -> OKLab (Björn Ottosson). Perceptually uniform, so ΔE is meaningful. */
function oklab(h) {
  const [r, g, b] = linRgb(h);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const chroma = (h) => { const [, a, b] = oklab(h); return Math.hypot(a, b); };
const hueDeg = (h) => { const [, a, b] = oklab(h); return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360; };
const lightness = (h) => oklab(h)[0];

/** WCAG relative luminance + contrast. */
const relLum = (h) => { const [r, g, b] = linRgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

/**
 * Colour-vision-deficiency simulation (Viénot, Brettel & Mollon 1999 —
 * the linear-RGB matrices for full dichromacy).
 */
const CVD = {
  protan: [[0.1121, 0.8853, -0.0005], [0.1127, 0.8897, -0.0001], [0.0045, 0.0085, 1.0]],
  deutan: [[0.292, 0.7054, -0.0003], [0.2934, 0.7089, 0.0001], [-0.0195, 0.0333, 1.0]],
  tritan: [[1.0, 0.1273, -0.1073], [0.0, 0.8739, 0.1264], [-0.0042, 0.0555, 0.9483]],
};
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const rgb2hex = (rgb) =>
  '#' + rgb.map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('');

function simulate(h, kind) {
  const M = CVD[kind];
  const lin = linRgb(h);
  const out = M.map((row) => row.reduce((acc, k, i) => acc + k * lin[i], 0));
  return rgb2hex(out.map((v) => toSrgb(clamp01(v))));
}

/** ΔE in OKLab, scaled ×100 so the numbers read like CIE ΔE. */
function deltaE(a, b) {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 100;
}

/* ---------- thresholds ---------- */
const BAND = { light: [0.43, 0.77], dark: [0.55, 0.88] };
const CHROMA_FLOOR = 0.1;
const CVD_TARGET = 8;      // >= 8 is the target
const CVD_FLOOR = 6;       // 6-8 legal ONLY with secondary encoding
const NORMAL_FLOOR = 15;   // below this, full-colour vision cannot separate them
const MARK_CONTRAST = 3;   // WCAG 1.4.11 for a non-text mark
const ORDINAL_LIGHT_END = 2;
const ORDINAL_STEP = 0.06;

/* ---------- checks ---------- */
function pairs(list, mode) {
  const out = [];
  if (mode === 'all') {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]);
  } else {
    for (let i = 1; i < list.length; i++) out.push([list[i - 1], list[i]]);
  }
  return out;
}

function validateCategorical(palette, { mode, surface, pairMode }) {
  const report = [];
  const [lo, hi] = BAND[mode];

  const outOfBand = palette.filter((c) => lightness(c) < lo || lightness(c) > hi);
  report.push(['Lightness band', outOfBand.length === 0,
    outOfBand.length ? outOfBand.map((c) => `${c}:${lightness(c).toFixed(2)}`).join(' ') : `all ${palette.length} inside L ${lo}-${hi}`]);

  const grey = palette.filter((c) => chroma(c) < CHROMA_FLOOR);
  report.push(['Chroma floor', grey.length === 0,
    grey.length ? grey.map((c) => `${c}:${chroma(c).toFixed(3)}`).join(' ') : `all >= ${CHROMA_FLOOR}`]);

  let worstCvd = { d: Infinity };
  for (const [a, b] of pairs(palette, pairMode)) {
    for (const kind of Object.keys(CVD)) {
      const d = deltaE(simulate(a, kind), simulate(b, kind));
      if (d < worstCvd.d) worstCvd = { d, a, b, kind };
    }
  }
  report.push(['CVD separation', worstCvd.d >= CVD_FLOOR,
    `worst ${worstCvd.a}<->${worstCvd.b} dE ${worstCvd.d.toFixed(1)} (${worstCvd.kind})` +
    (worstCvd.d < CVD_TARGET ? ' — in the 6-8 floor band: needs secondary encoding' : '')]);

  let worstNormal = { d: Infinity };
  for (const [a, b] of pairs(palette, pairMode)) {
    const d = deltaE(a, b);
    if (d < worstNormal.d) worstNormal = { d, a, b };
  }
  report.push(['Normal-vision floor', worstNormal.d >= NORMAL_FLOOR,
    `worst ${worstNormal.a}<->${worstNormal.b} dE ${worstNormal.d.toFixed(1)}`]);

  const lowContrast = palette.filter((c) => contrast(c, surface) < MARK_CONTRAST);
  report.push(['Contrast vs surface', lowContrast.length === 0,
    lowContrast.length
      ? lowContrast.map((c) => `${c}:${contrast(c, surface).toFixed(2)}`).join(' ')
      : `all >= ${MARK_CONTRAST}:1`]);

  return report;
}

function validateOrdinal(palette, { surface }) {
  const report = [];
  const ls = palette.map(lightness);
  const monotone = ls.every((v, i) => i === 0 || v > ls[i - 1]) || ls.every((v, i) => i === 0 || v < ls[i - 1]);
  report.push(['Lightness monotone', monotone, monotone ? 'steps read in one direction' : `L: ${ls.map((v) => v.toFixed(2)).join(' ')}`]);

  const gaps = ls.slice(1).map((v, i) => Math.abs(v - ls[i]));
  const tight = gaps.filter((g) => g < ORDINAL_STEP);
  report.push(['Adjacent dL', tight.length === 0, tight.length ? `gaps too small: ${tight.map((g) => g.toFixed(3)).join(' ')}` : `all gaps >= ${ORDINAL_STEP}`]);

  const pale = palette.reduce((a, b) => (contrast(a, surface) < contrast(b, surface) ? a : b));
  const paleC = contrast(pale, surface);
  report.push(['Light-end contrast', paleC >= ORDINAL_LIGHT_END, `${pale} at ${paleC.toFixed(2)}:1 vs surface`]);

  const hues = palette.map(hueDeg);
  const spread = Math.max(...hues) - Math.min(...hues);
  report.push(['Single hue', spread <= 40, `hue spread ${spread.toFixed(0)} deg`]);

  return report;
}

/* ---------- CLI ---------- */
const args = process.argv.slice(2);
let positional = null;
const opts = { mode: 'light', pairs: 'adjacent', ordinal: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--mode' || a === '--surface' || a === '--pairs') opts[a.slice(2)] = args[++i];
  else if (a === '--ordinal') opts.ordinal = true;
  else if (a.startsWith('--')) { console.error(`unknown flag: ${a}`); process.exit(2); }
  else positional = a;
}
if (!positional) {
  console.error('usage: node scripts/validate-palette.mjs "#hex,#hex,..." --surface "#hex" [--mode light|dark] [--pairs adjacent|all] [--ordinal]');
  process.exit(2);
}
const palette = positional.split(',').map((s) => s.trim()).filter(Boolean);
const surface = opts.surface || (opts.mode === 'dark' ? '#04212E' : '#FFFFFF');

const report = opts.ordinal
  ? validateOrdinal(palette, { surface })
  : validateCategorical(palette, { mode: opts.mode, surface, pairMode: opts.pairs });

console.log(`\nPalette (${opts.mode}, surface ${surface}, ${opts.ordinal ? 'ordinal' : opts.pairs + ' pairs'}): ${palette.length} slots`);
let ok = true;
for (const [name, pass, detail] of report) {
  if (!pass) ok = false;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name.padEnd(22)} ${detail}`);
}
console.log(ok ? '\n  -> ALL CHECKS PASS' : '\n  -> FAILED — fix the marked checks');
process.exit(ok ? 0 : 1);
