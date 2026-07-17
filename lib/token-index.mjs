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
} from './css-values.mjs'

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

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
