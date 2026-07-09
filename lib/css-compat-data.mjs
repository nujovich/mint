// CSS compatibility data module for Mint.
// Wraps the web-features npm package to provide Baseline status
// lookups for CSS properties.
//
// Milestone 1 of BUILD #4: Integrate web-features as compatibility data source.

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
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

// ---------------------------------------------------------------------------
// Milestone 2 of BUILD #4: read the project's browserslist target.
// ---------------------------------------------------------------------------

/**
 * Read the project's target browsers from standard browserslist sources.
 *
 * Resolution order (first hit wins):
 *   1. a `browserslist` key in package.json
 *   2. a `.browserslistrc` file (or `browserslist` file) in the project root
 *   3. the browserslist default (`> 0.5%, last 2 versions, Firefox ESR, not dead`)
 *
 * @param {string} [projectDir] - Project root. Defaults to the current working
 *   directory.
 * @returns {{ queries: string[], source: 'package.json'|'.browserslistrc'|'browserslist'|'default' }}
 *   The raw query strings plus which source they came from.
 */
export function getProjectBrowserslist(projectDir = process.cwd()) {
  // 1. package.json `browserslist` key
  const pkgPath = join(projectDir, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      if (pkg.browserslist) {
        const raw = pkg.browserslist
        const queries = Array.isArray(raw) ? raw : (raw.production ?? raw)
        return {
          queries: Array.isArray(queries) ? queries : [String(queries)],
          source: 'package.json',
        }
      }
    } catch {
      // Corrupt package.json — fall through to the next source.
    }
  }

  // 2. .browserslistrc / browserslist file
  for (const name of ['.browserslistrc', 'browserslist']) {
    const rcPath = join(projectDir, name)
    if (existsSync(rcPath)) {
      const text = readFileSync(rcPath, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'))
      if (text.length > 0) {
        return { queries: text, source: name }
      }
    }
  }

  // 3. browserslist default
  return {
    queries: ['> 0.5%', 'last 2 versions', 'Firefox ESR', 'not dead'],
    source: 'default',
  }
}

/**
 * Resolve the project's browserslist target into concrete browser identifiers
 * (e.g. "chrome 120", "safari 17") using the browserslist engine.
 *
 * @param {string} [projectDir] - Project root. Defaults to the current working
 *   directory.
 * @returns {{ browsers: string[], queries: string[], source: string }}
 */
export function getResolvedBrowsers(projectDir = process.cwd()) {
  const { queries, source } = getProjectBrowserslist(projectDir)
  // Lazy require so the package is only loaded when browsers are actually needed.
  const browserslist = require('browserslist')
  return {
    browsers: browserslist(queries),
    queries,
    source,
  }
}
