/**
 * CSS Health Score — metrics calculation engine.
 *
 * Computes structural CSS metrics from raw CSS source strings:
 *   - selectorsPerRule (average)
 *   - declarationsPerRule (average)
 *   - importantRatio (percentage of declarations using !important)
 *   - avgSpecificity (average CSS specificity per selector)
 *   - layerAdoption (percentage of rules inside @layer blocks)
 *
 * All functions are pure: they accept a CSS string and return a metrics object.
 * No external dependencies are required — parsing is done with regex + string
 * manipulation designed for metrics collection (not full AST fidelity).
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute all CSS health metrics from a raw CSS string.
 * @param {string} css - Raw CSS source
 * @returns {{selectorsPerRule: number, declarationsPerRule: number, importantRatio: number, avgSpecificity: number, layerAdoption: number}}
 */
export function computeMetrics(css) {
  const normalized = normalizeCss(css)
  const rules = extractRules(normalized)

  if (rules.length === 0) {
    return {
      selectorsPerRule: 0,
      declarationsPerRule: 0,
      importantRatio: 0,
      avgSpecificity: 0,
      layerAdoption: 0,
    }
  }

  const allSelectors = rules.flatMap((r) => r.selectors)
  const allDeclarations = rules.flatMap((r) => r.declarations)

  const selectorsPerRule = allSelectors.length / rules.length
  const declarationsPerRule = allDeclarations.length / rules.length
  const importantCount = allDeclarations.filter((d) => d.important).length
  const importantRatio =
    allDeclarations.length > 0 ? importantCount / allDeclarations.length : 0
  const specificities = allSelectors.map(calculateSpecificity)
  const avgSpecificity =
    specificities.length > 0 ? averageSpecificity(specificities) : 0
  const layeredRules = rules.filter((r) => r.inLayer).length
  const layerAdoption = layeredRules / rules.length

  return {
    selectorsPerRule: round2(selectorsPerRule),
    declarationsPerRule: round2(declarationsPerRule),
    importantRatio: round4(importantRatio),
    avgSpecificity: round2(avgSpecificity),
    layerAdoption: round4(layerAdoption),
  }
}

/**
 * Calculate CSS specificity for a single selector.
 *
 * Uses a simplified scoring system:
 *   IDs contribute 100 per occurrence
 *   classes / attributes / pseudo-classes contribute 10
 *   elements / pseudo-elements / universal contribute 1
 *
 * @param {string} selector - A single CSS selector
 * @returns {number} Specificity score
 */
export function calculateSpecificity(selector) {
  const s = selector.trim()
  if (s.length === 0) return 0

  const withoutPseudoElements = s.replace(/::[a-z-]+/gi, '')

  const ids = (withoutPseudoElements.match(/#[a-z_][\w-]*/gi) || []).length
  const classes = (withoutPseudoElements.match(/\.\w+/g) || []).length
  const attrs = (withoutPseudoElements.match(/\[[\w-]+[^\]]*\]/g) || []).length
  const pseudoClasses = (
    withoutPseudoElements.match(/(?<!:):(?!:)[a-z-]+/gi) || []
  ).length
  const universal = (withoutPseudoElements.match(/\*/g) || []).length

  const elementPattern = /(?:^|\s|[>+~])\s*([a-z_][\w-]*)/gi
  let elements = 0
  let match
  const cleanSelector = withoutPseudoElements
  while ((match = elementPattern.exec(cleanSelector)) !== null) {
    const start = match.index + match[0].indexOf(match[1])
    const before = cleanSelector[start - 1] || ''
    if (!['.', '#', ':', '['].includes(before)) {
      elements++
    }
  }

  return (
    ids * 100 + (classes + attrs + pseudoClasses) * 10 + elements + universal
  )
}

// ---------------------------------------------------------------------------
// CSS parsing
// ---------------------------------------------------------------------------

/**
 * Normalize CSS for metric extraction: strip comments, collapse whitespace.
 */
function normalizeCss(css) {
  return String(css)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract all CSS rules from normalized CSS.
 *
 * Handles @layer nesting: rules inside @layer { ... } or @layer name { ... }
 * are marked with inLayer = true.
 *
 * @param {string} css - Normalized CSS
 * @returns {Array<{selectors: string[], declarations: Array<{prop: string, value: string, important: boolean}>, inLayer: boolean}>}
 */
function extractRules(css) {
  const rules = []
  let pos = 0

  while (pos < css.length) {
    // Skip whitespace
    while (pos < css.length && css[pos] === ' ') pos++
    if (pos >= css.length) break

    // Check for @layer block
    if (css.startsWith('@layer', pos)) {
      const afterLayer = css.substring(pos + 6).trimStart()
      // @layer { ... } or @layer name { ... }
      const bracePos = css.indexOf('{', pos)
      if (bracePos === -1) break
      const closePos = findMatchingBrace(css, bracePos)
      if (closePos === -1) break
      const innerContent = css.substring(bracePos + 1, closePos)
      // Recursively extract rules from inside the layer
      const innerRules = extractRules(innerContent)
      for (const r of innerRules) {
        r.inLayer = true
      }
      rules.push(...innerRules)
      pos = closePos + 1
      continue
    }

    // Check for other at-rules (@media, @supports, etc.) — recurse into them too
    if (css[pos] === '@') {
      const bracePos = css.indexOf('{', pos)
      if (bracePos === -1) {
        // @import or other directive without braces — skip
        const semiPos = css.indexOf(';', pos)
        pos = semiPos !== -1 ? semiPos + 1 : css.length
        continue
      }
      const closePos = findMatchingBrace(css, bracePos)
      if (closePos === -1) break
      const innerContent = css.substring(bracePos + 1, closePos)
      const innerRules = extractRules(innerContent)
      rules.push(...innerRules)
      pos = closePos + 1
      continue
    }

    // It's a regular CSS rule: selector { ... }
    const openBrace = css.indexOf('{', pos)
    if (openBrace === -1) break

    const selectorText = css.substring(pos, openBrace).trim()
    const closeBrace = findMatchingBrace(css, openBrace)
    if (closeBrace === -1) break

    const ruleContent = css.substring(openBrace + 1, closeBrace)

    if (selectorText.length > 0) {
      const selectors = splitSelectors(selectorText)
      const declarations = parseDeclarations(ruleContent)
      if (selectors.length > 0) {
        rules.push({ selectors, declarations, inLayer: false })
      }
    }

    pos = closeBrace + 1
  }

  return rules
}

/**
 * Find the position of the matching closing brace, respecting nesting.
 * @param {string} css
 * @param {number} openPos - Position of the opening brace
 * @returns {number} Position of the matching closing brace, or -1
 */
function findMatchingBrace(css, openPos) {
  let depth = 1
  for (let i = openPos + 1; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Parse declarations from rule content.
 */
function parseDeclarations(content) {
  const declarations = []
  const declRegex = /([a-z-]+)\s*:\s*([^;]+?)(\s*!important)?\s*(;|$)/gi
  let match

  while ((match = declRegex.exec(content)) !== null) {
    const prop = match[1].trim()
    const value = match[2].trim()
    const important = !!(match[3] && match[3].trim() === '!important')

    if (prop && value) {
      declarations.push({ prop, value, important })
    }
  }

  return declarations
}

/**
 * Split a comma-separated selector list, respecting nested parentheses.
 */
function splitSelectors(text) {
  if (!text.trim()) return []

  const parts = []
  let depth = 0
  let current = ''

  for (const ch of text) {
    if (ch === '(' || ch === '[') {
      depth++
      current += ch
    } else if (ch === ')' || ch === ']') {
      depth--
      current += ch
    } else if (ch === ',' && depth === 0) {
      const trimmed = current.trim()
      if (trimmed) parts.push(trimmed)
      current = ''
    } else {
      current += ch
    }
  }

  const trimmed = current.trim()
  if (trimmed) parts.push(trimmed)

  return parts
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function averageSpecificity(specificities) {
  if (specificities.length === 0) return 0
  return specificities.reduce((a, b) => a + b, 0) / specificities.length
}

function round2(n) {
  return Math.round(n * 100) / 100
}

function round4(n) {
  return Math.round(n * 10000) / 10000
}
