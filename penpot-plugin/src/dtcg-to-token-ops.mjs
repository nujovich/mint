/**
 * dtcg-to-token-ops — pure transformation core for the Mint Penpot plugin.
 *
 * Converts a W3C DTCG Format Module v1 tokens object into a normalized list of
 * Penpot token-set operations that the plugin glue feeds to the Penpot Plugins
 * API (`penpot.tokens.createSet(name)` then `set.createToken({ name, type, value })`).
 *
 * No Penpot dependency — unit-testable in isolation.
 */

// Map DTCG `$type` values to Penpot Plugins API TokenType values.
// See https://doc.plugins.penpot.app/types/TokenType/
const DTCG_TYPE_TO_PENPOT = {
  color: 'color',
  shadow: 'shadow',
  fontFamily: 'fontFamilies',
  fontWeight: 'fontWeights',
}

// DTCG's `dimension` type is ambiguous for Penpot, which distinguishes
// `spacing`, `borderRadius`, `sizing`, etc. Disambiguate by top-level category.
const CATEGORY_TYPE_OVERRIDE = {
  spacing: 'spacing',
  'border-radius': 'borderRadius',
}

function isLeaf(node) {
  return node != null && typeof node === 'object' && '$value' in node
}

// Convert a DTCG `$value` into the Penpot token value representation.
//
// NOTE: the exact serialization Penpot's Plugins API expects for dimension and
// shadow tokens is not part of the published type docs; the shapes below are
// DTCG-faithful and must be confirmed by the manual verification step
// (importing into a real Penpot file). See penpot-plugin/README.md.
function toPenpotValue(value) {
  if (Array.isArray(value)) return value.map(toPenpotValue)

  if (value != null && typeof value === 'object') {
    // DTCG dimension: { value: 4, unit: 'px' } -> "4px"
    if ('value' in value && 'unit' in value)
      return `${value.value}${value.unit}`
    // Composite value (e.g. a shadow layer): normalize each property.
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = toPenpotValue(v)
    return out
  }

  // Penpot stores scalar token values as strings (e.g. font weight 700 -> "700").
  if (typeof value === 'number') return String(value)
  return value
}

/**
 * @param {object} dtcg DTCG v1 tokens object (top-level keys are token groups).
 * @returns {Array<{ name: string, tokens: Array<{ name: string, type: string, value: * }> }>}
 */
export function dtcgToTokenOps(dtcg) {
  const sets = []

  for (const [setName, group] of Object.entries(dtcg)) {
    const tokens = []
    walk(group, [], group?.$type, CATEGORY_TYPE_OVERRIDE[setName], tokens)
    sets.push({ name: setName, tokens })
  }

  return sets
}

function walk(node, path, inheritedType, typeOverride, out) {
  if (node == null || typeof node !== 'object') return

  const dtcgType = node.$type ?? inheritedType

  if (isLeaf(node)) {
    out.push({
      name: path.join('.'),
      // null (not undefined) marks a DTCG type Penpot has no token type for;
      // the plugin glue skips these and reports them.
      type: typeOverride ?? DTCG_TYPE_TO_PENPOT[dtcgType] ?? null,
      value: toPenpotValue(node.$value),
    })
    return
  }

  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue
    walk(child, [...path, key], dtcgType, typeOverride, out)
  }
}
