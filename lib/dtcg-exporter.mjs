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
