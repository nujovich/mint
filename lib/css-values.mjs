// Pure CSS value normalization helpers. Dependency-free.

function clamp255(n) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function toHex(r, g, b) {
  const h = (n) => clamp255(n).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0,
    g = 0,
    b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

function parseAlpha(a) {
  return a.endsWith('%') ? Number(a.slice(0, -1)) / 100 : Number(a)
}

// Returns a canonical "#rrggbb" for fully-opaque colors, or null when the input
// is not an opaque color literal (alpha < 1, keyword, var(), empty, unsupported).
export function normalizeColor(input) {
  if (typeof input !== 'string') return null
  const str = input.trim().toLowerCase()
  if (!str) return null

  // hex
  let m = /^#([0-9a-f]{3,8})$/.exec(str)
  if (m) {
    const h = m[1]
    if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
    if (h.length === 4) {
      if (h[3] !== 'f') return null // alpha < 1
      return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
    }
    if (h.length === 6) return `#${h}`
    if (h.length === 8) {
      if (h.slice(6) !== 'ff') return null // alpha < 1
      return `#${h.slice(0, 6)}`
    }
    return null
  }

  // rgb()/rgba()
  m =
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+%?))?\s*\)$/.exec(
      str
    )
  if (m) {
    if (m[4] !== undefined && parseAlpha(m[4]) < 1) return null
    return toHex(Number(m[1]), Number(m[2]), Number(m[3]))
  }

  // hsl()/hsla()
  m =
    /^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%(?:[,/\s]+([\d.]+%?))?\s*\)$/.exec(
      str
    )
  if (m) {
    if (m[4] !== undefined && parseAlpha(m[4]) < 1) return null
    const [r, g, b] = hslToRgb(Number(m[1]), Number(m[2]), Number(m[3]))
    return toHex(r, g, b)
  }

  return null
}

// Splits a "#rrggbb" hex string into its r/g/b integer components.
export function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

// Formats a number to a fixed number of decimals, trimming trailing zeros so
// the OKLCH components read cleanly ("62.8" instead of "62.80", "0" for 0).
function fmtFixed(n, decimals) {
  let s = n.toFixed(decimals)
  if (s.includes('.')) {
    s = s.replace(/0+$/, '').replace(/\.$/, '')
  }
  return s
}

// sRGB component (0..1) -> linear-light sRGB (0..1).
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

// Converts an opaque legacy color literal (hex, rgb, hsl) to its OKLCH
// equivalent, e.g. "#ff0000" -> "oklch(62.8% 0.258 29.3)". The conversion is
// dependency-free: sRGB -> linear sRGB -> XYZ (D65) -> Oklab -> Oklch.
//
// Returns null when the input has alpha < 1, is a keyword/var() indirection,
// is already a wide-gamut literal, or is otherwise not a statically
// convertible opaque legacy color.
export function toOklch(input) {
  const hex = normalizeColor(input)
  if (!hex) return null

  const { r, g, b: blue } = hexToRgb(hex)
  const rl = srgbToLinear(r / 255)
  const gl = srgbToLinear(g / 255)
  const bl = srgbToLinear(blue / 255)

  // linear sRGB -> XYZ (D65)
  const x = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl
  const y = 0.2126729 * rl + 0.7151522 * gl + 0.072175 * bl
  const z = 0.0193339 * rl + 0.119192 * gl + 0.9503041 * bl

  // XYZ (D65) -> Oklab
  const l_ = 0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z
  const m_ = 0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z
  const s_ = 0.0482003018 * x + 0.2643662691 * y + 0.633851707 * z
  const l3 = Math.cbrt(l_)
  const m3 = Math.cbrt(m_)
  const s3 = Math.cbrt(s_)

  const L = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3
  const a = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3
  const b = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3

  // Oklab -> Oklch
  const C = Math.sqrt(a * a + b * b)
  const Cfmt = fmtFixed(C, 3)
  // When chroma rounds to zero the color is effectively achromatic; the hue
  // from atan2 on floating-point residuals is meaningless, so pin it to 0.
  let H
  if (Cfmt === '0') {
    H = 0
  } else {
    H = (Math.atan2(b, a) * 180) / Math.PI
    if (H < 0) H += 360
  }

  return `oklch(${fmtFixed(L * 100, 1)}% ${Cfmt} ${fmtFixed(H, 1)})`
}

// Classifies a CSS color literal by its syntactic format.
// Legacy (sRGB-bound) formats: hex, rgb(), hsl().
// Wide-gamut formats: oklch(), oklab(), color(display-p3 ...).
// Returns { format, category } for a recognized color literal, or null for
// anything else (keywords, var(), inherit, empty, unrecognized syntax).
export function detectColorSpace(input) {
  if (typeof input !== 'string') return null
  const str = input.trim().toLowerCase()
  if (!str) return null

  // hex (#rgb, #rgba, #rrggbb, #rrggbbaa)
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(str)) {
    return { format: 'hex', category: 'legacy' }
  }
  // rgb() / rgba()
  if (/^rgba?\(/.test(str)) return { format: 'rgb', category: 'legacy' }
  // hsl() / hsla()
  if (/^hsla?\(/.test(str)) return { format: 'hsl', category: 'legacy' }
  // oklch()
  if (/^oklch\(/.test(str)) return { format: 'oklch', category: 'wide-gamut' }
  // oklab()
  if (/^oklab\(/.test(str)) return { format: 'oklab', category: 'wide-gamut' }
  // color(display-p3 ...)
  if (/^color\(\s*display-p3\b/.test(str)) {
    return { format: 'display-p3', category: 'wide-gamut' }
  }

  return null
}

// Returns the numeric px value, or null when the value is not an explicit px length.
export function parseSpacingPx(input) {
  if (typeof input !== 'string') return null
  const m = /^\s*(-?\d+(?:\.\d+)?)px\s*$/.exec(input)
  return m ? Number(m[1]) : null
}

// Canonical form for comparing font-family declarations: lowercased, unquoted,
// single space after each comma.
export function normalizeFontFamily(input) {
  if (typeof input !== 'string') return ''
  return input
    .split(',')
    .map((part) =>
      part
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .toLowerCase()
    )
    .filter(Boolean)
    .join(', ')
}
