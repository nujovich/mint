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
