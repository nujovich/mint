// CSS compatibility data module for Mint.
// Wraps the web-features npm package to provide Baseline status
// lookups for CSS properties.
//
// Milestone 1 of BUILD #4: Integrate web-features as compatibility data source.

import { features } from 'web-features'

/**
 * Build a reverse index: CSS property name -> { featureId, feature, bcdKey }
 * Scans all web-features entries for compat_features that start with
 * "css.properties." and maps the property name to its parent feature.
 *
 * The index is built once at module load time (lazy evaluation via
 * closure). For large datasets this is a one-time O(n * m) scan where
 * n = number of features and m = average compat_features per feature.
 */
function buildPropertyIndex() {
  const index = new Map()
  for (const [featureId, feature] of Object.entries(features)) {
    if (!feature.compat_features || !Array.isArray(feature.compat_features))
      continue
    for (const bcdKey of feature.compat_features) {
      if (!bcdKey.startsWith('css.properties.')) continue
      const property = bcdKey.slice('css.properties.'.length)
      // First match wins — most features have unique property mappings
      if (!index.has(property)) {
        index.set(property, { featureId, feature, bcdKey })
      }
    }
  }
  return index
}

/**
 * Cached property index. Built once per process.
 * @type {Map<string, {featureId: string, feature: object, bcdKey: string}>}
 */
let _propertyIndex = null

function getPropertyIndex() {
  if (!_propertyIndex) {
    _propertyIndex = buildPropertyIndex()
  }
  return _propertyIndex
}

/**
 * Look up the Baseline status for a CSS property.
 *
 * @param {string} property - CSS property name (e.g. "display", "grid-template-rows")
 * @returns {"high"|"low"|false|null} Baseline status, or null if unknown
 */
export function getBaselineStatus(property) {
  const entry = getPropertyIndex().get(property)
  if (!entry) return null
  return entry.feature.status?.baseline ?? null
}

/**
 * Check if a CSS property has reached Baseline (low or high).
 *
 * @param {string} property - CSS property name
 * @returns {boolean} True if the property is Baseline (low or high)
 */
export function isBaseline(property) {
  const status = getBaselineStatus(property)
  return status === 'high' || status === 'low'
}

/**
 * Check if a CSS property is widely available (Baseline high).
 *
 * @param {string} property - CSS property name
 * @returns {boolean} True if the property is Baseline high
 */
export function isWidelyAvailable(property) {
  return getBaselineStatus(property) === 'high'
}

/**
 * Get detailed support information for a CSS property.
 *
 * @param {string} property - CSS property name
 * @returns {{featureId: string, name: string, baseline: string|null, support: object}|null}
 */
export function getSupportInfo(property) {
  const entry = getPropertyIndex().get(property)
  if (!entry) return null
  return {
    featureId: entry.featureId,
    name: entry.feature.name,
    baseline: entry.feature.status?.baseline ?? null,
    baselineLowDate: entry.feature.status?.baseline_low_date ?? null,
    baselineHighDate: entry.feature.status?.baseline_high_date ?? null,
    support: entry.feature.status?.support ?? {},
  }
}

/**
 * List all known CSS properties in the index.
 *
 * @returns {string[]} Array of CSS property names
 */
export function getKnownProperties() {
  return Array.from(getPropertyIndex().keys())
}

/**
 * Get the total number of CSS properties tracked in the index.
 *
 * @returns {number}
 */
export function getPropertyCount() {
  return getPropertyIndex().size
}
