// CSS lint rules for Mint — static pattern detection.
// These complement the LLM-based audit by catching well-defined
// anti-patterns that can be detected deterministically.

import { createRequire } from 'node:module'

/**
 * Parse raw CSS into an array of rule objects with selectors and body.
 * Each rule: { selector: string, body: string, raw: string }
 *
 * Handles nested media/container queries by flattening them
 * (the selector is preserved with its outer scope for analysis).
 */
export function parseCssRules(css) {
  const rules = []
  // Remove comments so they don't interfere with parsing
  const stripped = String(css)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')

  // Match rule blocks: selector { ...body... }
  const ruleRe = /([^{]+)\{([^}]*)\}/g
  let match
  while ((match = ruleRe.exec(stripped)) !== null) {
    const selector = match[1].trim()
    const body = match[2].trim().replace(/;+$/, '')
    if (selector && body) {
      rules.push({ selector, body, raw: match[0] })
    }
  }
  return rules
}

/**
 * Extract declarations from a CSS rule body as a Map of property → value.
 * Handles shorthand and longhand properties (e.g. "border" and "border-top").
 */
export function parseDeclarations(body) {
  const decls = new Map()
  const declRe = /([a-z-]+)\s*:\s*([^;]+)/gi
  let match
  while ((match = declRe.exec(body)) !== null) {
    const prop = match[1].trim().toLowerCase()
    const value = match[2].trim().toLowerCase()
    decls.set(prop, value)
  }
  return decls
}

/**
 * Check if a selector targets grid/flex children.
 * Detects patterns like:
 *   .container > *    (direct children)
 *   .container > .item (direct children)
 *   .container .item  (descendant)
 *   .container > :nth-child(...)
 */
function selectorTargetsChildrenOf(childSelector, containerSelectors) {
  for (const containerSel of containerSelectors) {
    // Direct child combinator: container > child
    if (childSelector.includes(containerSel + ' >')) return true
    // Descendant combinator: container child (when not using >)
    if (childSelector.startsWith(containerSel + ' ')) return true
    // Universal direct children: container > *
    const gtIndex = childSelector.indexOf(' > ')
    if (gtIndex !== -1) {
      const parentPart = childSelector.slice(0, gtIndex).trim()
      if (parentPart === containerSel) return true
    }
  }
  return false
}

/**
 * Detect manual gap-decoration hacks in CSS.
 *
 * Chrome 149 introduced native gap-rule-color, gap-rule-style, and
 * gap-rule-width for drawing lines between grid/flex tracks. This rule
 * detects hand-rolled workarounds and suggests migrating to the native
 * properties.
 *
 * Patterns detected:
 *   1. border on grid/flex children simulating gap lines
 *   2. ::before / ::after pseudo-elements used to decorate gaps
 *   3. background used alongside gap to simulate track lines
 *
 * @param {string} css - Raw CSS source
 * @returns {{ findings: Array<{selector, pattern, message, severity}> }}
 */
export function lintGapDecorationHacks(css) {
  const findings = []
  const rules = parseCssRules(css)

  // Pass 1: identify grid/flex container selectors
  const containerSelectors = []
  for (const rule of rules) {
    const decls = parseDeclarations(rule.body)
    const display = decls.get('display')
    if (
      display === 'grid' ||
      display === 'flex' ||
      display === 'inline-grid' ||
      display === 'inline-flex'
    ) {
      // Split compound selectors; use the first meaningful one as container
      const parts = rule.selector.split(',').map((s) => s.trim())
      for (const part of parts) {
        // Strip pseudo-classes like :hover, :focus for comparison
        const base = part.replace(/::?[a-z-]+(\s*\([^)]*\))?/g, '').trim()
        if (base && !containerSelectors.includes(base)) {
          containerSelectors.push(base)
        }
      }
    }
  }

  if (containerSelectors.length === 0) return { findings }

  // Pass 2: detect hacks in rules targeting children of those containers
  const seenSelectors = new Set()

  for (const rule of rules) {
    const decls = parseDeclarations(rule.body)

    // Split compound selectors
    const parts = rule.selector.split(',').map((s) => s.trim())
    for (const part of parts) {
      if (seenSelectors.has(part)) continue
      const targetsChild = selectorTargetsChildrenOf(part, containerSelectors)

      // Pattern 1: border on direct children simulating gap lines
      // Skip pseudo-elements: they're handled by pattern 2
      if (targetsChild && !part.includes('::')) {
        const borderProps = []
        for (const [prop, value] of decls) {
          if (
            (prop.startsWith('border-') && !prop.includes('radius')) ||
            prop === 'border'
          ) {
            // Skip borders that are explicitly none/0 or are radius
            if (value === 'none' || value === '0') continue
            // Gap-line hacks typically use bottom or top border only
            if (
              prop.includes('-bottom') ||
              prop.includes('-top') ||
              (prop === 'border' && value !== 'none' && value !== '0')
            ) {
              borderProps.push(`${prop}: ${value}`)
            }
          }
        }
        if (borderProps.length > 0) {
          seenSelectors.add(part)
          findings.push({
            selector: part,
            pattern: 'border-as-gap-line',
            message:
              `Border properties (${borderProps.join(', ')}) may be simulating gap lines. ` +
              'Consider using native gap-rule-color, gap-rule-style, and gap-rule-width instead.',
            severity: 'warning',
          })
        }
      }

      // Pattern 2: ::before / ::after used for gap decoration
      if (
        (part.includes('::before') || part.includes('::after')) &&
        targetsChild
      ) {
        const hasDecorativeProps =
          decls.has('content') &&
          (decls.has('background') ||
            decls.has('background-color') ||
            decls.has('border') ||
            decls.has('height') ||
            decls.has('width'))

        if (hasDecorativeProps) {
          seenSelectors.add(part)
          findings.push({
            selector: part,
            pattern: 'pseudo-element-gap-decoration',
            message:
              'Pseudo-element appears to be used as a gap decoration. ' +
              'Native gap-rule-* properties can replace this workaround.',
            severity: 'warning',
          })
        }
      }

      // Pattern 3: background used alongside gap to simulate track lines
      if (targetsChild) {
        const hasBackground =
          decls.has('background') || decls.has('background-color')
        const hasGap =
          decls.has('gap') || decls.has('column-gap') || decls.has('row-gap')

        if (hasBackground && hasGap) {
          // Only flag if we haven't already flagged this selector
          const alreadyFlagged = findings.some((f) => f.selector === part)
          if (!alreadyFlagged) {
            seenSelectors.add(part)
            findings.push({
              selector: part,
              pattern: 'background-with-gap',
              message:
                'Using background alongside gap may be a workaround for missing gap decorations. ' +
                'Chrome 149+ supports native gap-rule-color, gap-rule-style, and gap-rule-width.',
              severity: 'info',
            })
          }
        }
      }
    }
  }

  return { findings }
}

/**
 * Minimum browser versions that support CSS gap decorations
 * (gap-rule-color, gap-rule-style, gap-rule-width).
 *
 * Chrome 149+ (Jun 2026), Firefox 132+, Edge 149+ (Chromium).
 * Safari has no stable support as of mid-2026.
 */
const GAP_DECORATIONS_MIN_VERSIONS = {
  chrome: 149,
  edge: 149,
  firefox: 132,
  opera: 149,
  and_chr: 149,
  and_ff: 132,
  samsung: 149,
  // Safari, ios_saf, kaios, ie, baidu, bb, op_mini, op_mob, and_qq, and_uc
  // have no known support yet
}

/**
 * Detect usage of native gap-rule-* properties and warn if the project's
 * browserslist target does not support them.
 *
 * Gap decorations (gap-rule-color, gap-rule-style, gap-rule-width) are
 * supported in Chrome 149+, Firefox 132+, and Edge 149+. If the CSS uses
 * these properties but the target browsers include unsupported versions,
 * this rule emits a warning with a compatibility fallback suggestion.
 *
 * @param {string} css - Raw CSS source
 * @param {string} [projectDir] - Optional project directory to read browserslist from
 * @returns {{ findings: Array<{selector, pattern, message, severity, unsupportedBrowsers: string[]}> }}
 */
export function lintGapDecorationsCompat(css, projectDir) {
  const findings = []
  const rules = parseCssRules(css)

  // Pass 1: find rules that use gap-rule-* properties
  const gapRuleSelectors = []
  for (const rule of rules) {
    const decls = parseDeclarations(rule.body)
    const hasGapRule =
      decls.has('gap-rule-color') ||
      decls.has('gap-rule-style') ||
      decls.has('gap-rule-width')
    if (hasGapRule) {
      gapRuleSelectors.push(rule.selector)
    }
  }

  if (gapRuleSelectors.length === 0) return { findings }

  // Pass 2: read browserslist and check support
  const unsupported = getUnsupportedBrowsers(projectDir)
  if (unsupported.length === 0) return { findings }

  // Pass 3: generate findings for each selector using gap-rule-*
  for (const selector of gapRuleSelectors) {
    findings.push({
      selector,
      pattern: 'gap-decorations-compat',
      message:
        `Uses native gap-rule-* properties but the project's browserslist ` +
        `targets ${unsupported.length} browser(s) that do not support them: ` +
        `${unsupported.join(', ')}. ` +
        'Consider using a fallback (border or pseudo-element gap styling) for ' +
        'unsupported browsers, or narrowing the browserslist to Chrome 149+ / Firefox 132+.',
      severity: 'warning',
      unsupportedBrowsers: unsupported,
    })
  }

  return { findings }
}

/**
 * Parse browserslist from a project directory and determine which browsers
 * in the target list do not support CSS gap decorations.
 *
 * @param {string} [projectDir] - Project directory (defaults to cwd)
 * @returns {string[]} - List of unsupported browser identifiers (e.g. 'chrome 145')
 */
function getUnsupportedBrowsers(projectDir) {
  let browsers
  try {
    const require = createRequire(import.meta.url)
    const browserslist = require('browserslist')
    browsers = browserslist(undefined, { path: projectDir || process.cwd() })
  } catch {
    // If browserslist is not available, assume no compatibility check needed
    return []
  }

  const unsupported = []
  for (const browser of browsers) {
    const parts = browser.split(' ')
    const name = parts[0]
    const version = parts[1]

    const minVersion = GAP_DECORATIONS_MIN_VERSIONS[name]
    if (minVersion === undefined) {
      // Unknown browser or no known support — flag as unsupported
      unsupported.push(browser)
      continue
    }

    // Handle ranged versions like '18.5-18.7'
    const major = parseFloat(version)
    if (isNaN(major) || major < minVersion) {
      unsupported.push(browser)
    }
  }

  // Deduplicate: if all the same browser family is unsupported, show once
  return unsupported
}

/**
 * Estimate adoption of manual gap-decoration hacks across a stylesheet.
 *
 * Builds on the per-rule detection in `lintGapDecorationHacks` to produce an
 * aggregate "Modern CSS Opportunities" report: how many of the project's
 * stylesheets contain hacks that native gap-rule-* properties (Chrome 149+,
 * Firefox 132+) could replace, broken down by hack pattern.
 *
 * The `files` argument lets callers count stylesheets (a stylesheet is
 * "affected" if it contains at least one hack finding). When omitted, the
 * report reflects a single combined CSS blob.
 *
 * @param {string} css - Raw CSS source
 * @param {{ stylesheetCount?: number }} [opts] - Optional context
 * @returns {{ adoption: { stylesheetsScanned, stylesheetsWithHacks, hacksTotal, byPattern } }}
 */
export function lintGapDecorationAdoption(css, opts = {}) {
  const { findings } = lintGapDecorationHacks(css)

  const byPattern = {}
  let hacksTotal = 0
  for (const f of findings) {
    byPattern[f.pattern] = (byPattern[f.pattern] || 0) + 1
    hacksTotal += 1
  }

  const stylesheetsScanned = opts.stylesheetCount ?? 1
  const stylesheetsWithHacks = findings.length > 0 ? 1 : 0

  return {
    adoption: {
      stylesheetsScanned,
      stylesheetsWithHacks,
      hacksTotal,
      byPattern,
    },
  }
}

/**
 * Run all lint rules against CSS and return combined findings.
 */
export function lintCss(css, projectDir) {
  const gapResult = lintGapDecorationHacks(css)
  const compatResult = lintGapDecorationsCompat(css, projectDir)
  return {
    findings: [...gapResult.findings, ...compatResult.findings],
  }
}
