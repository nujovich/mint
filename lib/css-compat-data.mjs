// CSS compatibility data module for Mint.
// Wraps the web-features npm package to provide Baseline status
// lookups for CSS properties.
//
// Milestone 1 of BUILD #4: Integrate web-features as compatibility data source.

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { features } from 'web-features'

// browserslist is a CommonJS package; load it via createRequire so it works
// from this ESM module.
const require = createRequire(import.meta.url)
const browserslist = require('browserslist')

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
  return {
    browsers: browserslist(queries),
    queries,
    source,
  }
}

// ---------------------------------------------------------------------------
// Milestone 3 of BUILD #4: static Interop-2026 adoption rules.
// ---------------------------------------------------------------------------

/**
 * Parse raw CSS into an array of rule objects with selectors and body.
 * Each rule: { selector: string, body: string, declarations: Map }
 *
 * Comments are stripped first so they cannot masquerade as selectors or
 * declarations. Block nesting is flattened (the outer selector is kept with
 * its body). Only rules with both a selector and a non-empty body are kept.
 */
function parseCssRules(css) {
  const rules = []
  const stripped = String(css)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')

  const ruleRe = /([^{]+)\{([^}]*)\}/g
  let match
  while ((match = ruleRe.exec(stripped)) !== null) {
    const selector = match[1].trim()
    const body = match[2].trim().replace(/;+$/, '')
    if (!selector || !body) continue
    const declarations = new Map()
    const declRe = /([a-z-]+)\s*:\s*([^;]+)/gi
    let dm
    while ((dm = declRe.exec(body)) !== null) {
      const prop = dm[1].trim().toLowerCase()
      declarations.set(prop, dm[2].trim())
    }
    rules.push({ selector, body, declarations })
  }
  return rules
}

/**
 * Interop 2026 score (0-100) for a CSS property, from the web-features
 * `status.interop` field. Returns null when the data source has no interop
 * figure for the property.
 *
 * @param {string} property - CSS property name
 * @returns {number|null}
 */
export function getInteropScore(property) {
  const entry = getPropertyIndex().get(property)
  if (!entry) return null
  const interop = entry.feature.status?.interop
  return typeof interop === 'number' ? interop : null
}

/**
 * Determine which of the project's resolved target browsers do NOT support a
 * property whose web-features support map lists it as unavailable.
 *
 * The web-features `support` map is keyed by BCD browser identifiers
 * (e.g. "chrome", "safari", "firefox_android"). A target browser is
 * considered unsupported when it is absent from the property's support map
 * (meaning web-features does not list it as supported). Returns the list of
 * resolved browser identifiers (e.g. "safari 17") that lack support.
 *
 * @param {string} property - CSS property name
 * @param {string} [projectDir] - Project directory to read browserslist from
 * @returns {string[]} Unsupported target browser identifiers
 */
export function checkPropertySupportAgainstTargets(property, projectDir) {
  const entry = getPropertyIndex().get(property)
  if (!entry) return []
  const support = entry.feature.status?.support ?? {}
  const { browsers } = getResolvedBrowsers(projectDir)
  const unsupported = []
  for (const browser of browsers) {
    const name = browser.split(' ')[0]
    if (!(name in support)) {
      unsupported.push(browser)
    }
  }
  return unsupported
}

/**
 * Rule: property-not-supported.
 *
 * Warns (severity "warning") when a CSS declaration uses a property that is
 * below Baseline (status is false or "low") AND the property's support map
 * does not cover at least one of the project's resolved target browsers
 * (i.e. the target needs that feature but the feature is not Baseline).
 *
 * A property is "not supported" for the project when it is below Baseline and
 * at least one resolved target browser is missing from the web-features
 * support map. The finding reports which target browsers lack support so the
 * user gets a concrete fallback hint.
 *
 * @param {string} css - Raw CSS source
 * @param {string} [projectDir] - Project directory to read browserslist from
 * @returns {{ findings: Array<{property, pattern, message, severity, unsupportedBrowsers: string[]}> }}
 */
export function lintPropertyNotSupported(css, projectDir) {
  const findings = []
  const rules = parseCssRules(css)
  for (const rule of rules) {
    for (const [prop] of rule.declarations) {
      const status = getBaselineStatus(prop)
      if (status === 'high' || status === 'low') continue
      const unsupported = checkPropertySupportAgainstTargets(prop, projectDir)
      if (unsupported.length === 0) continue
      findings.push({
        property: prop,
        pattern: 'property-not-supported',
        message:
          'Property "' +
          prop +
          '" is below Baseline and is not supported in ' +
          unsupported.length +
          ' of the project target browsers (' +
          unsupported.join(', ') +
          '). Consider a fallback or a polyfill ' +
          'before shipping to this audience.',
        severity: 'warning',
        unsupportedBrowsers: unsupported,
      })
    }
  }
  return { findings }
}

/**
 * Rule: property-experimental.
 *
 * Informs (severity "info") when a CSS declaration uses a property whose
 * Interop 2026 score is below the given threshold (default 90). These features
 * are shipping or partially shipping but interop across engines is still low,
 * so early adopters should expect rough edges and watch the baseline timeline.
 *
 * @param {string} css - Raw CSS source
 * @param {{ interopThreshold?: number }} [opts] - Threshold (0-100); default 90
 * @returns {{ findings: Array<{property, pattern, message, severity, interop: number|null}> }}
 */
export function lintPropertyExperimental(css, opts = {}) {
  const threshold = opts.interopThreshold ?? 90
  const findings = []
  const rules = parseCssRules(css)
  for (const rule of rules) {
    for (const [prop] of rule.declarations) {
      // Prefer the explicit Interop 2026 score when the data source has it.
      // When that figure is missing, fall back to Baseline status: a property
      // that is Baseline "low" (widely available in some engines but not yet
      // "high") is treated as experimental for the same early-adopter warning.
      let interop = getInteropScore(prop)
      let basis = 'interop'
      if (interop === null) {
        const status = getBaselineStatus(prop)
        if (status === 'low') {
          interop = threshold - 1
          basis = 'baseline-low'
        } else {
          continue
        }
      }
      if (interop >= threshold) continue
      findings.push({
        property: prop,
        pattern: 'property-experimental',
        message:
          'Property "' +
          prop +
          '" is experimental (Interop 2026 score ' +
          interop +
          '%, below threshold ' +
          threshold +
          '%). It is shipping ' +
          'or partially shipping but engine interop is still low; expect ' +
          'rough edges and watch the Baseline timeline before relying on it.',
        severity: 'info',
        interop,
        basis,
      })
    }
  }
  return { findings }
}

// ---------------------------------------------------------------------------
// Milestone 4 of BUILD #4: CLI output for the adoption rules.
// ---------------------------------------------------------------------------

/**
 * Build a concrete fallback suggestion for a flagged property.
 *
 * Pulls the human-readable feature name from web-features so the CLI can tell
 * the user which feature the property belongs to (e.g. "Anchor positioning"),
 * and surfaces the Baseline status. Callers compose this into the warning text
 * so the developer gets a named feature to go look up rather than a bare
 * property name.
 *
 * @param {string} property - CSS property name
 * @returns {{ featureId: string|null, name: string|null, baseline: string|null }}
 */
export function getFeatureSuggestion(property) {
  const entry = getPropertyIndex().get(property)
  if (!entry) return { featureId: null, name: null, baseline: null }
  return {
    featureId: entry.featureId,
    name: entry.feature.name ?? null,
    baseline: entry.feature.status?.baseline ?? null,
  }
}

/**
 * Format the adoption-rule findings into a structured, CLI-ready report.
 *
 * Each finding gains a `feature` (human name from web-features) and a
 * `suggestion` line with a concrete next step and, for experimental findings,
 * the Interop 2026 percentage. The rule findings from M3 already carry the
 * data; this renderer just attaches the named feature and a suggested action
 * so the CLI can print actionable warnings.
 *
 * @param {Array<object>} findings - Results from lintPropertyNotSupported /
 *   lintPropertyExperimental ({ findings: [...] }).
 * @returns {Array<object>} Findings enriched with `feature` and `suggestion`.
 */
export function formatCompatFindings(findings) {
  return findings.map((f) => {
    const suggestion = getFeatureSuggestion(f.property)
    let hint
    if (f.pattern === 'property-not-supported') {
      const browsers = (f.unsupportedBrowsers || []).join(', ')
      hint =
        'Feature: ' +
        (suggestion.name || f.property) +
        '. Add an @supports fallback or a polyfill before shipping to: ' +
        (browsers || 'the project target browsers') +
        '.'
    } else {
      const pct = typeof f.interop === 'number' ? f.interop + '%' : 'unknown'
      hint =
        'Feature: ' +
        (suggestion.name || f.property) +
        ' (Interop 2026 ' +
        pct +
        '). Prefer a progressive-enhancement approach and watch the Baseline timeline.'
    }
    return { ...f, feature: suggestion.name, suggestion: hint }
  })
}

/**
 * Run both adoption rules against a CSS source and return the formatted,
 * CLI-ready findings (M4 entry point for the `mint-ds compat` command).
 *
 * @param {string} css - Raw CSS source
 * @param {object} [opts] - { projectDir?, interopThreshold? }
 * @returns {{ findings: Array<object> }}
 */
export function checkCompat(css, opts = {}) {
  const notSupported = lintPropertyNotSupported(css, opts.projectDir)
  const experimental = lintPropertyExperimental(css, {
    interopThreshold: opts.interopThreshold,
  })
  const all = [...notSupported.findings, ...experimental.findings]
  return { findings: formatCompatFindings(all) }
}
