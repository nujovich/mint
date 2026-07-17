// Substitution engine: rewrites raw color/spacing/font values in CSS text to
// reference design-token CSS variables. Operates on the value side of
// `prop: value` declarations only; skips comments, url(), and existing var().

import {
  normalizeColor,
  parseSpacingPx,
  normalizeFontFamily,
} from './css-values.mjs'

const SPACING_PROPS = new Set([
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'margin-block',
  'margin-block-start',
  'margin-block-end',
  'margin-inline',
  'margin-inline-start',
  'margin-inline-end',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'padding-block',
  'padding-block-start',
  'padding-block-end',
  'padding-inline',
  'padding-inline-start',
  'padding-inline-end',
  'gap',
  'row-gap',
  'column-gap',
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'inset-block',
  'inset-block-start',
  'inset-block-end',
  'inset-inline',
  'inset-inline-start',
  'inset-inline-end',
])
const FONT_PROPS = new Set(['font-family'])

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g
const LENGTH_RE = /-?[\d.]+px\b/g
const URL_RE = /url\([^)]*\)/gi
const COMMENT_RE = /\/\*[\s\S]*?\*\//g

// Spans whose contents must never be substituted: comments, url(), and existing var().
const PROTECTED_RE = /\/\*[\s\S]*?\*\/|url\([^)]*\)|var\([^)]*\)/gi

const COLOR_FUZZY_THRESHOLD = 10
const SPACING_FUZZY_THRESHOLD = 2

// Replace comments and url(...) spans with equal-length blanks so their offsets
// are preserved but their contents never match. Returns a masked copy.
function maskProtectedSpans(text) {
  const blank = (m) => ' '.repeat(m.length)
  return text.replace(COMMENT_RE, blank).replace(URL_RE, blank)
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

function nearestColor(hex, colorList) {
  const { r, g, b } = hexToRgb(hex)
  let best = null
  let bestD = Infinity
  for (const c of colorList) {
    const d = Math.sqrt((c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2)
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best && bestD <= COLOR_FUZZY_THRESHOLD ? best : null
}

function nearestSpacing(px, spacingList) {
  let best = null
  let bestD = Infinity
  for (const s of spacingList) {
    const d = Math.abs(s.px - px)
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best && bestD > 0 && bestD <= SPACING_FUZZY_THRESHOLD ? best : null
}

// Split the value into protected spans (copied verbatim) and open segments
// (where raw literals are substituted). Because emitted output — var(...) and
// /* was ... */ comments — is itself protected, re-running is idempotent.
function rewriteValue(value, prop, index, options, edits) {
  let result = ''
  let last = 0
  let m
  PROTECTED_RE.lastIndex = 0
  while ((m = PROTECTED_RE.exec(value)) !== null) {
    result += rewriteOpen(
      value.slice(last, m.index),
      prop,
      index,
      options,
      edits
    )
    result += m[0]
    last = m.index + m[0].length
  }
  result += rewriteOpen(value.slice(last), prop, index, options, edits)
  return result
}

function rewriteOpen(value, prop, index, { fuzzy }, edits) {
  let out = value

  // Colors (any property)
  out = out.replace(COLOR_RE, (token) => {
    const hex = normalizeColor(token)
    if (!hex) return token
    if (index.colorExact.has(hex)) {
      const to = `var(${index.colorExact.get(hex)})`
      edits.push({ kind: 'color', from: token, to, lossy: false })
      return to
    }
    if (fuzzy && !index.ambiguousColors.has(hex)) {
      const near = nearestColor(hex, index.colorList)
      if (near) {
        const to = `var(${near.varName})`
        edits.push({
          kind: 'color',
          from: token,
          to: `${to} /* was ${token} */`,
          lossy: true,
        })
        return `${to} /* was ${token} */`
      }
    }
    return token
  })

  // Spacing (spacing properties only)
  if (SPACING_PROPS.has(prop)) {
    out = out.replace(LENGTH_RE, (token) => {
      const px = parseSpacingPx(token)
      if (px === null || px === 0) return token
      if (index.spacingExact.has(px)) {
        const to = `var(${index.spacingExact.get(px)})`
        edits.push({ kind: 'spacing', from: token, to, lossy: false })
        return to
      }
      if (fuzzy) {
        const near = nearestSpacing(px, index.spacingList)
        if (near) {
          const to = `var(${near.varName})`
          edits.push({
            kind: 'spacing',
            from: token,
            to: `${to} /* was ${token} */`,
            lossy: true,
          })
          return `${to} /* was ${token} */`
        }
      }
      return token
    })
  }

  // Font family (font-family only), whole-value match
  if (FONT_PROPS.has(prop)) {
    const norm = normalizeFontFamily(out)
    if (index.fontExact.has(norm)) {
      const to = `var(${index.fontExact.get(norm)})`
      edits.push({ kind: 'font', from: value.trim(), to, lossy: false })
      const lead = value.match(/^\s*/)[0]
      const trail = value.match(/\s*$/)[0]
      out = `${lead}${to}${trail}`
    }
  }

  return out
}

export function applyCodemod(source, index, options = {}) {
  const { fuzzy = false } = options
  const edits = []
  const masked = maskProtectedSpans(source)

  // Find declarations `prop: value` inside rule bodies. Value ends at ; or }.
  const DECL_RE = /([{;]\s*)([-\w]+)(\s*:\s*)([^;{}]+)/g
  let output = ''
  let cursor = 0
  let m
  while ((m = DECL_RE.exec(masked)) !== null) {
    const rawProp = m[2]
    const rawValue = m[4]
    const prop = rawProp.toLowerCase()
    const valueStart = m.index + m[1].length + m[2].length + m[3].length
    const valueEnd = valueStart + rawValue.length
    output += source.slice(cursor, valueStart)
    output += rewriteValue(
      source.slice(valueStart, valueEnd),
      prop,
      index,
      { fuzzy },
      edits
    )
    cursor = valueEnd
  }
  output += source.slice(cursor)
  return { output, edits }
}
