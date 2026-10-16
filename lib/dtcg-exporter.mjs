/**
 * DTCG v1 Exporter — deterministic converter from mint-ds.tokens.json
 * to DTCG Format Module v1 JSON.
 *
 * Spec: https://www.designtokens.org/TR/2025.10/format/
 */

const NUM_PATTERN = '-?(?:\\d+\\.?\\d*|\\.\\d+)'

function warnSkipped(
  category,
  key,
  value,
  reason = 'unparseable or unsupported value'
) {
  console.warn(
    `[dtcg-exporter] Skipping ${category} token "${key}": ${reason} (${JSON.stringify(value)})`
  )
}

/**
 * Parse a CSS dimension string like "4px", "1.5rem", "0" into a DTCG
 * dimension object { value: number, unit: 'px' | 'rem' }.
 * Per DTCG §8.2, units may only be 'px' or 'rem'.
 * Returns null for unparseable/unsupported values (e.g. clamp(), calc(), var(), em, %).
 */
function parseDimension(raw) {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null
    return { value: raw, unit: 'px' }
  }
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (s === '0') return { value: 0, unit: 'px' }

  const m = s.match(new RegExp(`^(${NUM_PATTERN})\\s*(px|rem)$`, 'i'))
  if (m) {
    const val = parseFloat(m[1])
    if (!Number.isFinite(val)) return null
    return { value: val, unit: m[2].toLowerCase() }
  }

  // Bare number string (e.g. "16") defaults to px
  if (new RegExp(`^${NUM_PATTERN}$`).test(s)) {
    const val = parseFloat(s)
    if (!Number.isFinite(val)) return null
    return { value: val, unit: 'px' }
  }

  return null
}

/**
 * Parse a line-height value into either:
 * - { type: 'number', value: number } (for unitless numbers, %, and em)
 * - { type: 'dimension', value: { value: number, unit: 'px' | 'rem' } } (for px and rem)
 * Returns null for unparseable/non-numeric values (e.g. 'normal', 'var(--lh)', negative values).
 */
function parseLineHeight(raw) {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return null
    return { type: 'number', value: raw }
  }
  if (typeof raw !== 'string') return null
  const s = raw.trim()

  // 1. Percentage: 150% -> 1.5
  const pctMatch = s.match(new RegExp(`^(${NUM_PATTERN})%$`))
  if (pctMatch) {
    const val = parseFloat(pctMatch[1]) / 100
    if (!Number.isFinite(val) || val < 0) return null
    return { type: 'number', value: val }
  }

  // 2. em: 1.5em -> 1.5
  const emMatch = s.match(new RegExp(`^(${NUM_PATTERN})\\s*em$`, 'i'))
  if (emMatch) {
    const val = parseFloat(emMatch[1])
    if (!Number.isFinite(val) || val < 0) return null
    return { type: 'number', value: val }
  }

  // 3. DTCG dimension units (px and rem): 24px -> { value: 24, unit: 'px' }
  const dimMatch = s.match(new RegExp(`^(${NUM_PATTERN})\\s*(px|rem)$`, 'i'))
  if (dimMatch) {
    const val = parseFloat(dimMatch[1])
    if (!Number.isFinite(val) || val < 0) return null
    return {
      type: 'dimension',
      value: { value: val, unit: dimMatch[2].toLowerCase() },
    }
  }

  // 4. Bare unitless number string: "1.5" -> 1.5
  if (new RegExp(`^${NUM_PATTERN}$`).test(s)) {
    const val = parseFloat(s)
    if (!Number.isFinite(val) || val < 0) return null
    return { type: 'number', value: val }
  }

  return null
}

/**
 * Parse a duration value into DTCG duration object { value: number, unit: 'ms' | 's' }.
 * Per DTCG §8.5, duration must be non-negative and unit must be 'ms' or 's'.
 * Returns null for unparseable or negative values.
 */
function parseDuration(raw) {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return null
    return { value: raw, unit: 'ms' }
  }
  if (typeof raw === 'object' && raw !== null) {
    if (
      typeof raw.value === 'number' &&
      Number.isFinite(raw.value) &&
      raw.value >= 0 &&
      typeof raw.unit === 'string'
    ) {
      const u = raw.unit.toLowerCase()
      if (u === 'ms' || u === 's') {
        return { value: raw.value, unit: u }
      }
    }
    return null
  }
  if (typeof raw !== 'string') return null
  const s = raw.trim()

  const m = s.match(new RegExp(`^(${NUM_PATTERN})\\s*(ms|s)$`, 'i'))
  if (m) {
    const val = parseFloat(m[1])
    if (!Number.isFinite(val) || val < 0) return null
    return { value: val, unit: m[2].toLowerCase() }
  }

  // Bare number string (e.g. "150") defaults to ms
  if (new RegExp(`^${NUM_PATTERN}$`).test(s)) {
    const val = parseFloat(s)
    if (!Number.isFinite(val) || val < 0) return null
    return { value: val, unit: 'ms' }
  }

  return null
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
 * Per DTCG §8.6, x1 and x2 MUST be in the range [0, 1].
 * Returns null for unparseable or out-of-range values (steps(), var(), malformed cubic-bezier, etc.).
 */
function parseCubicBezier(raw) {
  if (
    Array.isArray(raw) &&
    raw.length === 4 &&
    raw.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    raw[0] >= 0 &&
    raw[0] <= 1 &&
    raw[2] >= 0 &&
    raw[2] <= 1
  ) {
    return [...raw]
  }
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase()
    if (NAMED_EASINGS[s]) {
      return [...NAMED_EASINGS[s]]
    }
    const re = new RegExp(
      `^cubic-bezier\\(\\s*(${NUM_PATTERN})\\s*,\\s*(${NUM_PATTERN})\\s*,\\s*(${NUM_PATTERN})\\s*,\\s*(${NUM_PATTERN})\\s*\\)$`,
      'i'
    )
    const m = s.match(re)
    if (m) {
      const nums = [
        parseFloat(m[1]),
        parseFloat(m[2]),
        parseFloat(m[3]),
        parseFloat(m[4]),
      ]
      if (
        nums.every(Number.isFinite) &&
        nums[0] >= 0 &&
        nums[0] <= 1 &&
        nums[2] >= 0 &&
        nums[2] <= 1
      ) {
        return nums
      }
    }
  }
  return null
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
      if (dim === null) continue
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
    const spacingGroup = {}
    for (const [key, value] of Object.entries(tokens.spacing)) {
      const dim = parseDimension(value)
      if (dim !== null) {
        spacingGroup[key] = { $value: dim }
      } else {
        warnSkipped('spacing', key, value)
      }
    }
    if (Object.keys(spacingGroup).length > 0) {
      result.spacing = { $type: 'dimension', ...spacingGroup }
    }
  }

  // Border radius → border-radius group with $type: dimension
  if (
    tokens.borderRadius &&
    typeof tokens.borderRadius === 'object' &&
    Object.keys(tokens.borderRadius).length > 0
  ) {
    const radiusGroup = {}
    for (const [key, value] of Object.entries(tokens.borderRadius)) {
      const dim = parseDimension(value)
      if (dim !== null) {
        radiusGroup[key] = { $value: dim }
      } else {
        warnSkipped('borderRadius', key, value)
      }
    }
    if (Object.keys(radiusGroup).length > 0) {
      result['border-radius'] = { $type: 'dimension', ...radiusGroup }
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
      const fontSizes = {}
      for (const [key, value] of Object.entries(tokens.typography.fontSizes)) {
        const dim = parseDimension(value)
        if (dim !== null) {
          fontSizes[key] = { $value: dim }
        } else {
          warnSkipped('fontSizes', key, value)
        }
      }
      if (Object.keys(fontSizes).length > 0) {
        result.typography['font-size'] = { $type: 'dimension', ...fontSizes }
      }
    }

    // Line heights → typography.line-height group
    if (
      tokens.typography.lineHeights &&
      typeof tokens.typography.lineHeights === 'object' &&
      Object.keys(tokens.typography.lineHeights).length > 0
    ) {
      const parsedEntries = []
      for (const [key, value] of Object.entries(
        tokens.typography.lineHeights
      )) {
        const parsed = parseLineHeight(value)
        if (parsed !== null) {
          parsedEntries.push([key, parsed])
        } else {
          warnSkipped('lineHeights', key, value)
        }
      }

      if (parsedEntries.length > 0) {
        const allDimensions = parsedEntries.every(
          ([, item]) => item.type === 'dimension'
        )
        const groupType = allDimensions ? 'dimension' : 'number'
        result.typography['line-height'] = { $type: groupType }
        for (const [key, item] of parsedEntries) {
          if (item.type === groupType) {
            result.typography['line-height'][key] = { $value: item.value }
          } else {
            result.typography['line-height'][key] = {
              $type: item.type,
              $value: item.value,
            }
          }
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
      const durations = {}
      for (const [key, value] of Object.entries(motion.durations)) {
        const dur = parseDuration(value)
        if (dur !== null) {
          durations[key] = { $value: dur }
        } else {
          warnSkipped('motion.durations', key, value)
        }
      }
      if (Object.keys(durations).length > 0) {
        motionGroup.duration = { $type: 'duration', ...durations }
      }
    }

    // Easings → motion.easing group with $type: cubicBezier
    if (
      motion.easings &&
      typeof motion.easings === 'object' &&
      Object.keys(motion.easings).length > 0
    ) {
      const easings = {}
      for (const [key, value] of Object.entries(motion.easings)) {
        const parsed = parseCubicBezier(value)
        if (parsed !== null) {
          easings[key] = { $value: parsed }
        } else {
          warnSkipped('motion.easings', key, value)
        }
      }
      if (Object.keys(easings).length > 0) {
        motionGroup.easing = { $type: 'cubicBezier', ...easings }
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
