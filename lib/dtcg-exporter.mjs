/**
 * DTCG v1 Exporter — deterministic converter from mint-ds.tokens.json
 * to DTCG Format Module v1 JSON.
 *
 * Spec: https://www.designtokens.org/TR/2025.10/format/
 */

/**
 * Parse a CSS dimension string like "4px", "1.5rem", "0" into a DTCG
 * dimension object { value: number, unit: string }.
 */
function parseDimension(raw) {
  if (typeof raw === 'number') {
    return { value: raw, unit: 'px' }
  }
  const s = String(raw).trim()
  if (s === '0') return { value: 0, unit: 'px' }
  const m = s.match(
    /^(-?\d+(?:\.\d+)?)\s*(px|rem|em|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)$/
  )
  if (m) {
    return { value: parseFloat(m[1]), unit: m[2] }
  }
  // Fallback: treat as pixel value
  const num = parseFloat(s)
  if (!isNaN(num)) return { value: num, unit: 'px' }
  return { value: 0, unit: 'px' }
}

/**
 * Test if a value is a CSS dimension string with an explicit unit.
 */
function isDimensionString(raw) {
  if (typeof raw !== 'string') return false
  const s = raw.trim()
  return /^(-?\d+(?:\.\d+)?)\s*(px|rem|em|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)$/i.test(
    s
  )
}

/**
 * Format duration value into DTCG duration string (e.g. '150ms', '1s').
 */
function formatDuration(raw) {
  if (typeof raw === 'number') {
    return `${raw}ms`
  }
  const s = String(raw).trim()
  if (/^\d+(\.\d+)?(ms|s)$/.test(s)) {
    return s
  }
  const num = parseFloat(s)
  if (!isNaN(num)) {
    return `${num}ms`
  }
  return s
}

const NAMED_EASINGS = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
}

/**
 * Parse a CSS easing string or array into a DTCG cubicBezier array [x1, y1, x2, y2].
 */
function parseCubicBezier(raw) {
  if (
    Array.isArray(raw) &&
    raw.length === 4 &&
    raw.every((n) => typeof n === 'number')
  ) {
    return raw
  }
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase()
    if (NAMED_EASINGS[s]) {
      return [...NAMED_EASINGS[s]]
    }
    const m = s.match(
      /^cubic-bezier\(\s*(-?\d*(?:\.\d+)?)\s*,\s*(-?\d*(?:\.\d+)?)\s*,\s*(-?\d*(?:\.\d+)?)\s*,\s*(-?\d*(?:\.\d+)?)\s*\)$/i
    )
    if (m) {
      return [
        parseFloat(m[1]),
        parseFloat(m[2]),
        parseFloat(m[3]),
        parseFloat(m[4]),
      ]
    }
  }
  return raw
}

/**
 * Convert an rgba() color string to #RRGGBBAA hex format.
 * Falls back to the original string if not parseable.
 */
function rgbaToHex(raw) {
  const s = String(raw).trim()
  const m = s.match(
    /^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i
  )
  if (!m) return raw
  const r = parseInt(m[1], 10)
  const g = parseInt(m[2], 10)
  const b = parseInt(m[3], 10)
  const a = m[4] !== undefined ? Math.round(parseFloat(m[4]) * 255) : 255
  const toHex = (n) =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${a === 255 ? '' : toHex(a)}`
}

/**
 * Parse a CSS box-shadow value into a DTCG shadow array.
 * Handles single shadows like "0 2px 4px rgba(0,0,0,0.1)".
 */
function parseShadow(raw) {
  const s = String(raw).trim()
  // Split on commas that are NOT inside rgba()
  const parts = []
  let depth = 0
  let current = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) parts.push(current.trim())

  return parts.map((part) => {
    const shadowStr = part.trim()

    // Extract the color function (rgb/rgba/hsl) if present
    const colorMatch = shadowStr.match(
      /(rgba?\s*\([^)]+\)|hsla?\s*\([^)]+\)|#[0-9a-fA-F]{3,8}|transparent|currentColor|inherit)/i
    )
    let color = '#000000'
    let numericPart = shadowStr
    if (colorMatch) {
      color = rgbaToHex(colorMatch[1])
      numericPart = shadowStr.replace(colorMatch[1], '').trim()
    }

    // Parse numeric values: offsetX, offsetY, blur, spread
    const tokens = numericPart.split(/\s+/).filter(Boolean)
    const result = {
      offsetX: { value: 0, unit: 'px' },
      offsetY: { value: 0, unit: 'px' },
      blur: { value: 0, unit: 'px' },
      spread: { value: 0, unit: 'px' },
      color,
    }

    let pos = 0
    const consumed = [false, false, false, false] // offsetX, offsetY, blur, spread

    for (const token of tokens) {
      const dim = parseDimension(token)
      if (!consumed[0]) {
        result.offsetX = dim
        consumed[0] = true
      } else if (!consumed[1]) {
        result.offsetY = dim
        consumed[1] = true
      } else if (!consumed[2]) {
        result.blur = dim
        consumed[2] = true
      } else if (!consumed[3]) {
        result.spread = dim
        consumed[3] = true
      }
    }

    return result
  })
}

/**
 * Convert mint-ds.tokens.json to DTCG v1 format.
 *
 * @param {object} tokens - Mint internal tokens object (mint-ds.tokens.json)
 * @returns {object} DTCG v1 compliant tokens object
 */
export function convertTokensToDTCG(tokens) {
  const result = {}

  // Colors → color group with $type: color
  if (
    tokens.colors &&
    Array.isArray(tokens.colors) &&
    tokens.colors.length > 0
  ) {
    result.color = { $type: 'color' }
    for (const c of tokens.colors) {
      result.color[c.name] = {}
      if (c.scale && typeof c.scale === 'object') {
        for (const [step, hex] of Object.entries(c.scale)) {
          result.color[c.name][step] = { $value: String(hex) }
        }
      }
    }
  }

  // Spacing → spacing group with $type: dimension
  if (
    tokens.spacing &&
    typeof tokens.spacing === 'object' &&
    Object.keys(tokens.spacing).length > 0
  ) {
    result.spacing = { $type: 'dimension' }
    for (const [key, value] of Object.entries(tokens.spacing)) {
      result.spacing[key] = { $value: parseDimension(value) }
    }
  }

  // Border radius → border-radius group with $type: dimension
  if (
    tokens.borderRadius &&
    typeof tokens.borderRadius === 'object' &&
    Object.keys(tokens.borderRadius).length > 0
  ) {
    result['border-radius'] = { $type: 'dimension' }
    for (const [key, value] of Object.entries(tokens.borderRadius)) {
      result['border-radius'][key] = { $value: parseDimension(value) }
    }
  }

  // Shadows → shadow group with $type: shadow
  if (
    tokens.shadows &&
    typeof tokens.shadows === 'object' &&
    Object.keys(tokens.shadows).length > 0
  ) {
    result.shadow = { $type: 'shadow' }
    for (const [key, value] of Object.entries(tokens.shadows)) {
      result.shadow[key] = { $value: parseShadow(String(value)) }
    }
  }

  // Typography
  if (tokens.typography && typeof tokens.typography === 'object') {
    result.typography = {}

    // Font families → typography.font-family group
    if (
      tokens.typography.fontFamilies &&
      typeof tokens.typography.fontFamilies === 'object' &&
      Object.keys(tokens.typography.fontFamilies).length > 0
    ) {
      result.typography['font-family'] = { $type: 'fontFamily' }
      for (const [key, value] of Object.entries(
        tokens.typography.fontFamilies
      )) {
        result.typography['font-family'][key] = { $value: String(value) }
      }
    }

    // Font weights → typography.font-weight group
    if (
      tokens.typography.fontWeights &&
      typeof tokens.typography.fontWeights === 'object' &&
      Object.keys(tokens.typography.fontWeights).length > 0
    ) {
      result.typography['font-weight'] = { $type: 'fontWeight' }
      for (const [key, value] of Object.entries(
        tokens.typography.fontWeights
      )) {
        result.typography['font-weight'][key] = { $value: value }
      }
    }

    // Font sizes → typography.font-size group
    if (
      tokens.typography.fontSizes &&
      typeof tokens.typography.fontSizes === 'object' &&
      Object.keys(tokens.typography.fontSizes).length > 0
    ) {
      result.typography['font-size'] = { $type: 'dimension' }
      for (const [key, value] of Object.entries(tokens.typography.fontSizes)) {
        result.typography['font-size'][key] = {
          $value: parseDimension(value),
        }
      }
    }

    // Line heights → typography.line-height group
    if (
      tokens.typography.lineHeights &&
      typeof tokens.typography.lineHeights === 'object' &&
      Object.keys(tokens.typography.lineHeights).length > 0
    ) {
      const allDimensions = Object.values(tokens.typography.lineHeights).every(
        (val) => isDimensionString(val)
      )
      const groupType = allDimensions ? 'dimension' : 'number'
      result.typography['line-height'] = { $type: groupType }
      for (const [key, value] of Object.entries(
        tokens.typography.lineHeights
      )) {
        if (isDimensionString(value)) {
          const dim = parseDimension(value)
          result.typography['line-height'][key] =
            groupType === 'dimension'
              ? { $value: dim }
              : { $type: 'dimension', $value: dim }
        } else {
          const num = typeof value === 'number' ? value : parseFloat(value)
          result.typography['line-height'][key] =
            groupType === 'number'
              ? { $value: num }
              : { $type: 'number', $value: num }
        }
      }
    }

    if (Object.keys(result.typography).length === 0) {
      delete result.typography
    }
  }

  // Motion
  const typoMotion =
    tokens.typography &&
    typeof tokens.typography === 'object' &&
    tokens.typography.motion &&
    typeof tokens.typography.motion === 'object'
      ? tokens.typography.motion
      : null
  const rootMotion =
    tokens.motion && typeof tokens.motion === 'object' ? tokens.motion : null
  const motion =
    typoMotion && rootMotion
      ? {
          durations: {
            ...(rootMotion.durations || {}),
            ...(typoMotion.durations || {}),
          },
          easings: {
            ...(rootMotion.easings || {}),
            ...(typoMotion.easings || {}),
          },
        }
      : typoMotion || rootMotion

  if (motion && typeof motion === 'object') {
    const motionGroup = {}

    // Durations → motion.duration group with $type: duration
    if (
      motion.durations &&
      typeof motion.durations === 'object' &&
      Object.keys(motion.durations).length > 0
    ) {
      motionGroup.duration = { $type: 'duration' }
      for (const [key, value] of Object.entries(motion.durations)) {
        motionGroup.duration[key] = { $value: formatDuration(value) }
      }
    }

    // Easings → motion.easing group with $type: cubicBezier
    if (
      motion.easings &&
      typeof motion.easings === 'object' &&
      Object.keys(motion.easings).length > 0
    ) {
      motionGroup.easing = { $type: 'cubicBezier' }
      for (const [key, value] of Object.entries(motion.easings)) {
        motionGroup.easing[key] = { $value: parseCubicBezier(value) }
      }
    }

    if (Object.keys(motionGroup).length > 0) {
      result.motion = motionGroup
    }
  }

  return result
}

/**
 * Custom JSON serializer that ensures $type, $value, and other
 * DTCG reserved properties appear first in every object so the
 * output matches canonical golden-fixture ordering.
 */
function serializeDTCG(obj, indent = 0) {
  const pad = '  '.repeat(indent)
  const padInner = '  '.repeat(indent + 1)
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    const items = obj.map((v) => padInner + serializeDTCG(v, indent + 1))
    return '[\n' + items.join(',\n') + '\n' + pad + ']'
  }
  if (obj && typeof obj === 'object') {
    const keys = Object.keys(obj)
    // Move $ keys to the front, preserve insertion order for the rest
    const dollarKeys = keys.filter((k) => k.startsWith('$'))
    const regularKeys = keys.filter((k) => !k.startsWith('$'))
    const sortedKeys = [...dollarKeys, ...regularKeys]
    if (sortedKeys.length === 0) return '{}'
    const pairs = sortedKeys.map((k) => {
      const val = serializeDTCG(obj[k], indent + 1)
      return padInner + JSON.stringify(k) + ': ' + val
    })
    return '{\n' + pairs.join(',\n') + '\n' + pad + '}'
  }
  return JSON.stringify(obj)
}

export { serializeDTCG }
