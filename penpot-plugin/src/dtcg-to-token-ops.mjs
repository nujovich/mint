/**
 * dtcg-to-token-ops — pure transformation core for the Mint Penpot plugin.
 *
 * Converts a W3C DTCG Format Module v1 tokens object into a normalized list of
 * Penpot token-set operations that the plugin glue feeds to the Penpot Plugins
 * API: `penpot.library.local.tokens.addSet({ name })` then
 * `tokenSet.addToken({ type, name, value })`.
 *
 * No Penpot dependency — unit-testable in isolation.
 */

// Map DTCG `$type` values to Penpot `TokenType` values.
// See the TokenType union in @penpot/plugin-types (>= 1.5.0).
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

// Convert a DTCG `$value` into the Penpot token value. Penpot's `addToken`
// always takes the *string* form of a value (numeric types included), except
// `shadow`, whose value is an array of TokenShadowValueString objects.
//
// NOTE: exact value serialization for dimension/shadow tokens must still be
// confirmed against a real Penpot file. See penpot-plugin/README.md.
function toPenpotValue(value, type) {
  if (type === 'shadow') return toShadowValue(value)

  // DTCG dimension: { value: 4, unit: 'px' } -> "4px"
  if (
    value != null &&
    typeof value === 'object' &&
    'value' in value &&
    'unit' in value
  ) {
    return `${value.value}${value.unit}`
  }

  // Penpot stores scalar token values as strings (e.g. font weight 700 -> "700").
  if (typeof value === 'number') return String(value)
  return value
}

// DTCG shadow `$value` (array of layers) -> Penpot TokenShadowValueString[].
// Every field is a string; offsets/blur/spread are plain pixel numbers.
function toShadowValue(value) {
  const layers = Array.isArray(value) ? value : [value]
  return layers.map((layer) => ({
    color: String(layer.color),
    inset: String(layer.inset ?? layer.type === 'innerShadow'),
    offsetX: pxNumber(layer.offsetX),
    offsetY: pxNumber(layer.offsetY),
    blur: pxNumber(layer.blur),
    spread: pxNumber(layer.spread),
  }))
}

// A DTCG dimension (or bare number) -> its plain pixel number as a string.
function pxNumber(dimension) {
  if (
    dimension != null &&
    typeof dimension === 'object' &&
    'value' in dimension
  ) {
    return String(dimension.value)
  }
  return String(dimension ?? 0)
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
    // null (not undefined) marks a DTCG type Penpot has no token type for;
    // the plugin glue skips these and reports them.
    const type = typeOverride ?? DTCG_TYPE_TO_PENPOT[dtcgType] ?? null
    out.push({
      name: path.join('.'),
      type,
      value: toPenpotValue(node.$value, type),
    })
    return
  }

  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue
    walk(child, [...path, key], dtcgType, typeOverride, out)
  }
}
