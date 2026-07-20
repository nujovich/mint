// Builds deterministic lookup maps from a DSTokens object. Owns the CSS variable
// naming convention (must match the css-variables export prompt):
//   color base value -> --color-<name>
//   other scale steps -> --color-<name>-<step>
//   spacing           -> --spacing-<key>
//   font family       -> --font-<key>

import {
  normalizeColor,
  parseSpacingPx,
  normalizeFontFamily,
  hexToRgb,
} from './css-values.mjs'

export function buildTokenIndex(tokens) {
  const colorExact = new Map()
  const ambiguousColors = new Set()
  const spacingExact = new Map()
  const fontExact = new Map()

  const setColor = (hex, varName) => {
    if (!hex) return
    if (ambiguousColors.has(hex)) return
    if (colorExact.has(hex) && colorExact.get(hex) !== varName) {
      colorExact.delete(hex)
      ambiguousColors.add(hex)
      return
    }
    colorExact.set(hex, varName)
  }

  for (const color of tokens.colors || []) {
    const base = normalizeColor(color.value)
    setColor(base, `--color-${color.name}`)
    for (const [step, val] of Object.entries(color.scale || {})) {
      if (String(step) === '500') continue // same value as base; base wins
      setColor(normalizeColor(val), `--color-${color.name}-${step}`)
    }
  }

  // Unlike colors (which track ambiguity via `ambiguousColors` and drop the
  // mapping on conflict), spacing and font collisions resolve first-wins: the
  // first key/value seen for a given px or normalized font wins and later
  // duplicates are silently ignored. This is rare in practice (design tokens
  // rarely define two names for the same spacing step or font stack).
  for (const [key, val] of Object.entries(tokens.spacing || {})) {
    const px = parseSpacingPx(val)
    if (px !== null && !spacingExact.has(px)) {
      spacingExact.set(px, `--spacing-${key}`)
    }
  }

  const families = (tokens.typography && tokens.typography.fontFamilies) || {}
  for (const [key, val] of Object.entries(families)) {
    const norm = normalizeFontFamily(val)
    if (norm && !fontExact.has(norm)) fontExact.set(norm, `--font-${key}`)
  }

  const colorList = [...colorExact.entries()].map(([hex, varName]) => ({
    ...hexToRgb(hex),
    varName,
  }))
  const spacingList = [...spacingExact.entries()].map(([px, varName]) => ({
    px,
    varName,
  }))

  return {
    colorExact,
    spacingExact,
    fontExact,
    colorList,
    spacingList,
    ambiguousColors,
  }
}
