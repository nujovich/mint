// WCAG 2.1 contrast ratio calculation for the CSS audit.
// Dependency-free (build-step free) so it can be imported by the CLI and the
// web AuditView without a bundler. Works on hex/rgb()/hsl() literals via
// css-values.mjs, plus a wide-gamut fallback for oklch()/oklab() colors.

import { normalizeColor, hexToRgb } from './css-values.mjs'
import { parseCssRules, parseDeclarations } from './css-lint-rules.mjs'

// WCAG 2.1 minimum contrast ratios for normal-size text.
export const WCAG_AA_NORMAL_TEXT = 4.5

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

// WCAG 2.1 minimum for large text (>= 24px, or >= 18.66px and bold).
export const WCAG_AA_LARGE_TEXT = 3.0

const COLOR_TOKEN_RE = /#[0-9a-f]{3,8}\b|(?:rgba?|hsla?|oklch|oklab)\([^)]*\)/i
const SUPPORTED_COLOR_FUNCTIONS = new Set([
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'oklch',
  'oklab',
])
const VAR_RE = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/i
const UNRESOLVED = '\u0000'

// Replace var(--x[, fallback]). `lookup(name)` returns the value, undefined
// when the property is not declared anywhere (the fallback applies), or null
// when it is ambiguous (the pair is skipped). Unresolvable values yield null.
function resolveVars(value, lookup) {
  let out = value
  for (let i = 0; i < 5 && VAR_RE.test(out); i++) {
    out = out.replace(VAR_RE, (_, name, fallback) => {
      const found = lookup(name)
      if (found === null) return UNRESOLVED
      const resolved = found ?? fallback
      return resolved === undefined ? UNRESOLVED : resolved.trim()
    })
  }
  return VAR_RE.test(out) || out.includes(UNRESOLVED) ? null : out
}

// Pull a single opaque color out of a `color` / `background(-color)` value.
// Skipped (null): gradients, url() images (they change the effective
// background), color functions other than rgb/hsl/oklch/oklab (color-mix,
// light-dark, ...), and named colors, which are not evaluated.
function extractColor(value, lookup, { allowImage = true } = {}) {
  if (!value) return null
  const resolved = resolveVars(value, lookup)
  if (!resolved) return null
  if (!allowImage && /url\(/i.test(resolved)) return null
  const stripped = resolved.replace(/url\([^)]*\)/gi, ' ')
  for (const [, fn] of stripped.matchAll(/([a-z-]+)\(/gi)) {
    if (!SUPPORTED_COLOR_FUNCTIONS.has(fn.toLowerCase())) return null
  }
  const token = COLOR_TOKEN_RE.exec(stripped)
  if (!token) return null
  const rgb = parseSrgbColor(token[0])
  if (!rgb) return null
  return (
    '#' +
    [rgb.r, rgb.g, rgb.b].map((n) => n.toString(16).padStart(2, '0')).join('')
  )
}

// em/rem are assumed to be 16px.
function fontSizePx(value) {
  const m = /^([\d.]+)(px|rem|em|pt)$/.exec(String(value || '').trim())
  if (!m) return null
  const n = Number(m[1])
  if (m[2] === 'px') return n
  if (m[2] === 'pt') return (n * 4) / 3
  return n * 16
}

function isBold(weight) {
  if (!weight) return false
  if (weight === 'bold' || weight === 'bolder') return true
  const n = Number(weight)
  return Number.isFinite(n) && n >= 700
}

function isLargeText(decls) {
  const px = fontSizePx(decls.get('font-size'))
  if (px == null) return false
  return px >= 24 || (px >= (14 * 4) / 3 && isBold(decls.get('font-weight')))
}

const ROOT_SELECTORS = new Set([':root', 'html'])

// Round to 2 decimals for display, but never show a failing ratio as if it
// reached the threshold (4.499 -> 4.49, not 4.5).
function displayRatio(ratio, threshold) {
  const rounded = Math.round(ratio * 100) / 100
  return rounded < threshold ? rounded : Math.floor(ratio * 100) / 100
}

// Deterministic WCAG 2.1 AA contrast lint. A pair is only checked when the
// SAME rule declares both a text `color` and a `background(-color)` that
// resolve to opaque literals. Colors from different rules are never combined:
// whether they ever render together depends on the cascade.
//
// var() is resolved conservatively: custom properties declared in a top-level
// `:root`/`html` rule, or in the pair's own rule. A property that is also
// declared elsewhere (other selectors, at-rules such as dark-mode media
// queries) with a different value is ambiguous, so the pair is skipped.
// Named colors, color-mix()/light-dark(), gradients and url() backgrounds
// are not evaluated; em/rem font sizes assume 16px.
//
// Returns { issues: Array<{selector, rule, severity, reason, foreground,
// background, contrastRatio}> } per the shared lint-issue contract.
export function lintContrast(css) {
  if (typeof css !== 'string' || !css) return { issues: [] }
  const parsed = parseCssRules(css).map((rule) => ({
    selector: rule.selector,
    inAtRule: rule.inAtRule,
    decls: parseDeclarations(rule.body),
  }))

  const rootProps = new Map()
  const otherProps = new Map() // name -> Set of values declared elsewhere
  for (const { selector, inAtRule, decls } of parsed) {
    const isRoot =
      !inAtRule &&
      selector.split(',').every((part) => ROOT_SELECTORS.has(part.trim()))
    for (const [prop, value] of decls) {
      if (!prop.startsWith('--')) continue
      if (isRoot) rootProps.set(prop, value)
      else {
        if (!otherProps.has(prop)) otherProps.set(prop, new Set())
        otherProps.get(prop).add(value)
      }
    }
  }

  const issues = []
  for (const { selector, decls } of parsed) {
    const lookup = (name) => {
      if (decls.has(name)) return decls.get(name)
      const others = otherProps.get(name)
      if (!others) return rootProps.get(name)
      const root = rootProps.get(name)
      if (root !== undefined && [...others].every((v) => v === root)) {
        return root
      }
      return null
    }
    const fg = extractColor(decls.get('color'), lookup)
    const bgDecl = decls.has('background-color')
      ? decls.get('background-color')
      : decls.get('background')
    const bg = extractColor(bgDecl, lookup, { allowImage: false })
    if (!fg || !bg) continue
    const ratio = contrastRatio(fg, bg)
    if (ratio == null) continue
    const large = isLargeText(decls)
    const threshold = large ? WCAG_AA_LARGE_TEXT : WCAG_AA_NORMAL_TEXT
    if (ratio >= threshold) continue
    const shown = displayRatio(ratio, threshold)
    issues.push({
      selector,
      rule: 'insufficient-contrast',
      severity: 'warning',
      reason:
        `${fg} on ${bg} is ${shown}:1, below WCAG AA ${threshold}:1 for ` +
        `${large ? 'large' : 'normal'} text`,
      foreground: fg,
      background: bg,
      contrastRatio: shown,
    })
  }
  return { issues }
}
