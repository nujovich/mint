// WCAG 2.1 contrast ratio calculation for the CSS audit.
// Dependency-free (build-step free) so it can be imported by the CLI and the
// web AuditView without a bundler. Works on hex/rgb()/hsl() literals via
// css-values.mjs, plus a wide-gamut fallback for oklch()/oklab() colors.

import { normalizeColor, hexToRgb } from './css-values.mjs'

// WCAG 2.1 minimum contrast ratios for normal-size text.
export const WCAG_AA_NORMAL_TEXT = 4.5
export const WCAG_AAA_NORMAL_TEXT = 7.0

function clamp01(n) {
  return Math.max(0, Math.min(1, n))
}

function clamp255(n) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

// Convert a single 0-255 sRGB channel to its linear-light value.
function channelToLinear(c) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

// Convert a linear-light sRGB channel to the 0-255 gamma-encoded value.
function channelToSrgb(c) {
  const s = clamp01(c)
  const g = s <= 0.0031308 ? 12.92 * s : 1.055 * Math.pow(s, 1 / 2.4) - 0.055
  return clamp255(g * 255)
}

// OKLab -> sRGB (CSS Color 4 reference conversion). Out-of-gamut channels are
// clamped to the sRGB cube, which is the documented wide-gamut fallback for
// contrast purposes.
function oklabToSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_
  const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  return {
    r: channelToSrgb(rLin),
    g: channelToSrgb(gLin),
    b: channelToSrgb(bLin),
  }
}

function parseOklch(str) {
  const m =
    /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(deg|rad|grad|turn)?\s*(?:\/\s*[\d.]+%?\s*)?\)$/.exec(
      str
    )
  if (!m) return null
  const L = Number(m[1]) / (m[2] === '%' ? 100 : 1)
  const C = Number(m[3])
  let H = Number(m[4])
  const unit = m[5] || 'deg'
  if (unit === 'rad') H = (H * 180) / Math.PI
  else if (unit === 'grad') H = H * 0.9
  else if (unit === 'turn') H = H * 360
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  return oklabToSrgb(L, a, b)
}

function parseOklab(str) {
  const m =
    /^oklab\(\s*([\d.]+)(%?)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*(?:\/\s*[\d.]+%?\s*)?\)$/.exec(
      str
    )
  if (!m) return null
  const L = Number(m[1]) / (m[2] === '%' ? 100 : 1)
  return oklabToSrgb(L, Number(m[3]), Number(m[4]))
}

// Parse a CSS color literal into an sRGB { r, g, b } triple (integers 0-255).
// Returns null for anything that is not an opaque color literal (keywords,
// var(), alpha < 1, unknown formats).
export function parseSrgbColor(input) {
  if (typeof input !== 'string') return null
  const str = input.trim().toLowerCase()
  if (!str) return null
  const hex = normalizeColor(str)
  if (hex) return hexToRgb(hex)
  return parseOklch(str) || parseOklab(str)
}

// WCAG 2.1 relative luminance of an sRGB { r, g, b } triple (0-255).
export function relativeLuminance(rgb) {
  if (!rgb) return null
  const { r, g, b } = rgb
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  )
}

function toRgb(color) {
  if (
    color &&
    typeof color === 'object' &&
    'r' in color &&
    'g' in color &&
    'b' in color
  ) {
    return color
  }
  return parseSrgbColor(color)
}

// WCAG 2.1 contrast ratio between two colors. Accepts a CSS color string or an
// sRGB { r, g, b } triple. Returns null when either color cannot be parsed.
export function contrastRatio(fg, bg) {
  const f = toRgb(fg)
  const b = toRgb(bg)
  if (!f || !b) return null
  const L1 = relativeLuminance(f)
  const L2 = relativeLuminance(b)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

// Compute the contrast ratio (rounded to 2 decimals) and WCAG AA/AAA pass
// flags for a foreground/background pair. Returns null when unparseable.
export function evaluateContrast(fg, bg) {
  const ratio = contrastRatio(fg, bg)
  if (ratio == null) return null
  return {
    contrastRatio: Math.round(ratio * 100) / 100,
    failsWCAG: {
      aa: ratio < WCAG_AA_NORMAL_TEXT,
      aaa: ratio < WCAG_AAA_NORMAL_TEXT,
    },
  }
}

const BACKGROUND_ROLES = new Set(['background', 'surface'])

// Annotate each color cluster with its contrast ratio and WCAG pass flags
// against the detected background (the first cluster whose suggestedName is
// `background` or `surface`, defaulting to white when none is found). The
// background cluster itself and any unparseable color are left untouched.
export function annotateColorClusters(clusters) {
  if (!Array.isArray(clusters) || clusters.length === 0) return clusters
  const bgCluster =
    clusters.find((c) => c.suggestedName === 'background') ||
    clusters.find((c) => BACKGROUND_ROLES.has(c.suggestedName))
  const bgColor = bgCluster?.representative || '#ffffff'
  return clusters.map((cluster) => {
    if (cluster === bgCluster) return cluster
    const result = evaluateContrast(cluster.representative, bgColor)
    if (!result) return cluster
    return { ...cluster, ...result }
  })
}

// Build the failing contrast pairs report for an AuditReport. Pairs every
// non-background color cluster against the detected background and emits one
// ContrastPairIssue per cluster that fails WCAG AA or AAA, each with a
// contrast-color() migration suggestion. Returns [] when there is no cluster
// to evaluate or none fails.
export function buildContrastPairs(clusters) {
  if (!Array.isArray(clusters) || clusters.length === 0) return []
  const bgCluster =
    clusters.find((c) => c.suggestedName === 'background') ||
    clusters.find((c) => BACKGROUND_ROLES.has(c.suggestedName))
  const bgColor = bgCluster?.representative || '#ffffff'

  const pairs = []
  for (const cluster of clusters) {
    if (cluster === bgCluster) continue
    const result = evaluateContrast(cluster.representative, bgColor)
    if (!result) continue
    if (!result.failsWCAG.aa && !result.failsWCAG.aaa) continue
    pairs.push({
      foregroundName: cluster.suggestedName,
      foreground: cluster.representative,
      background: bgColor,
      contrastRatio: result.contrastRatio,
      failsAA: result.failsWCAG.aa,
      failsAAA: result.failsWCAG.aaa,
      suggestion: contrastMigrationSuggestion(cluster, bgColor, result),
    })
  }
  return pairs
}

// One-sentence migration hint for a failing foreground/background pair. AA
// failures recommend contrast-color(), which auto-picks black or white for
// maximum contrast; AAA-only failures need a manual darken/lighten.
function contrastMigrationSuggestion(cluster, bgColor, result) {
  if (result.failsWCAG.aa) {
    return (
      `Use contrast-color(${bgColor}) for the foreground of ` +
      `"${cluster.suggestedName}" to guarantee WCAG AA, or adjust ` +
      `${cluster.representative} to at least 4.5:1 against ${bgColor}.`
    )
  }
  return (
    `"${cluster.suggestedName}" (${cluster.representative}) passes AA but not AAA; ` +
    `darken or lighten it to reach at least 7:1 against ${bgColor}.`
  )
}
