// CSS lint rules for Mint — static pattern detection.
// These complement the LLM-based audit by catching well-defined
// anti-patterns that can be detected deterministically.

import { createRequire } from 'node:module'

// At-rules whose block holds other rules (flattened by parseCssRules).
const GROUPING_AT_RULES = new Set([
  'media',
  'supports',
  'layer',
  'container',
  'scope',
  'document',
  'starting-style',
])
// At-rules whose block contents are not style rules and are skipped.
const OPAQUE_AT_RULES = /^@(?:-\w+-)?keyframes\b/i

/**
 * Parse raw CSS into an array of rule objects with selectors and body.
 * Each rule: { selector: string, body: string, raw: string, inAtRule: boolean }
 *
 * Grouping at-rules (@media, @supports, @layer, @container, ...) are
 * flattened: their inner rules are returned with clean selectors and
 * `inAtRule: true`. Descriptor at-rules (@font-face, @property, ...) are
 * returned as a rule whose selector is the at-rule prelude. @keyframes blocks
 * and statement at-rules (@import, @charset) are skipped. Nested style rules
 * (CSS nesting) stay inside their parent's body.
 */
export function parseCssRules(css) {
  const rules = []
  const { src, masked } = stripCommentsAndMask(css)

  let depthAtRules = 0 // grouping at-rule blocks currently open
  const open = [] // stack: true when the block is a grouping/opaque container
  let start = 0 // start of the current prelude
  let i = 0
  while (i < masked.length) {
    const ch = masked[i]
    if (ch === ';') {
      start = i + 1
    } else if (ch === '}') {
      if (open.length > 0) {
        const wasContainer = open.pop()
        if (wasContainer === 'group') depthAtRules -= 1
      }
      start = i + 1
    } else if (ch === '{') {
      const prelude = src.slice(start, i).trim()
      const at = prelude.startsWith('@')
        ? prelude.slice(1).split(/[\s(]/)[0].toLowerCase()
        : null
      if (at && GROUPING_AT_RULES.has(at)) {
        open.push('group')
        depthAtRules += 1
        start = i + 1
      } else if (at && OPAQUE_AT_RULES.test(prelude)) {
        i = findBlockEnd(masked, i)
        start = i + 1
      } else {
        const end = findBlockEnd(masked, i)
        const body = src
          .slice(i + 1, end)
          .trim()
          .replace(/;+$/, '')
        if (prelude && body) {
          rules.push({
            selector: prelude,
            body,
            raw: `${prelude} {${src.slice(i + 1, end)}}`,
            inAtRule: depthAtRules > 0,
          })
        }
        i = end
        start = i + 1
      }
    }
    i += 1
  }
  return rules
}

// Remove comments (`/* */` always, `//` line comments) and return both the
// cleaned source and a same-length `masked` copy in which the contents of
// quoted strings and unquoted url(...) are replaced by `_`, so structural
// characters ({ } ;) inside them are never mistaken for syntax. `//` is only
// a comment outside strings and url(), so `url(http://...)` survives.
function stripCommentsAndMask(css) {
  const text = String(css)
  let src = ''
  let masked = ''
  const n = text.length
  let i = 0
  const emit = (chunk, mask) => {
    src += chunk
    masked += mask ? '_'.repeat(chunk.length) : chunk
  }
  while (i < n) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? n : end + 2
      emit(' ', false)
    } else if (ch === '/' && next === '/') {
      while (i < n && text[i] !== '\n') i += 1
      emit(' ', false)
    } else if (ch === '"' || ch === "'") {
      let j = i + 1
      while (j < n && text[j] !== ch) j += text[j] === '\\' ? 2 : 1
      j = Math.min(j + 1, n)
      emit(text.slice(i, j), true)
      i = j
    } else if (
      text.slice(i, i + 4).toLowerCase() === 'url(' &&
      !/^\s*["']/.test(text.slice(i + 4, i + 20))
    ) {
      const end = text.indexOf(')', i + 4)
      const j = end === -1 ? n : end
      emit('url(', false)
      emit(text.slice(i + 4, j), true)
      i = j
    } else {
      emit(ch, false)
      i += 1
    }
  }
  return { src, masked }
}

// Index of the `}` closing the block opened at `openIdx` (or end of input).
function findBlockEnd(src, openIdx) {
  let depth = 0
  for (let j = openIdx; j < src.length; j++) {
    if (src[j] === '{') depth += 1
    else if (src[j] === '}') {
      depth -= 1
      if (depth === 0) return j
    }
  }
  return src.length
}

/**
 * Extract declarations from a CSS rule body as a Map of property → value.
 * Handles shorthand and longhand properties (e.g. "border" and "border-top").
 */
export function parseDeclarations(body) {
  const decls = new Map()
  const declRe = /([a-z0-9_-]+)\s*:\s*([^;]+)/gi
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

const MOTION_PROPERTIES = new Set([
  'animation',
  'animation-name',
  'transition',
  'transition-property',
  'transform',
])

/**
 * Scan CSS for animation/transition declarations that are not wrapped in a
 * `@media (prefers-reduced-motion: reduce)` block.
 *
 * Users who opt into reduced motion should not receive full-strength motion
 * effects. This rule finds every `animation` / `animation-name` / `transition`
 * / `transition-property` / `transform` declaration that sits outside such a
 * wrapper and emits a per-declaration issue with a wrap suggestion.
 *
 * The return shape mirrors the `MotionAccessibilityAudit` interface in
 * `lib/types.ts`.
 *
 * @param {string} css - Raw CSS source
 * @returns {{ totalMotionDeclarations: number, unwrappedCount: number, issues: Array<{ selector: string, property: string, value: string, suggestion: string }> }}
 */
export function lintMotionAccessibility(css) {
  const source = String(css)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')

  const issues = []
  let totalMotionDeclarations = 0
  const declRe = /([a-z-]+)\s*:\s*([^;]+);/gi

  const isReducedMotionMedia = (sel) =>
    /^@media\s*\([^)]*prefers-reduced-motion[^)]*:\s*reduce[^)]*\)\s*$/i.test(
      sel
    )

  // Collect every rule block, tracking whether it sits inside a
  // prefers-reduced-motion media block, so protected declarations can be
  // skipped. `selStart` marks where the current (possibly nested) selector
  // begins; the reduced-motion flag for the enclosing block is pushed/popped
  // alongside braces.
  const rules = []
  let selStart = -1
  const reducedStack = [false]
  const keyframesStack = [false]

  const isKeyframesAtRule = (sel) => /^@(-[a-z]+-)?keyframes\b/i.test(sel)

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') {
      const selector = source.slice(selStart, i).trim()
      const inReduced = reducedStack[reducedStack.length - 1]
      const inKeyframes = keyframesStack[keyframesStack.length - 1]
      const reduced = isReducedMotionMedia(selector)
      const isKeyframes = isKeyframesAtRule(selector)
      let bodyEnd = -1
      let braceDepth = 1
      let j = i + 1
      while (j < source.length && braceDepth > 0) {
        if (source[j] === '{') braceDepth += 1
        else if (source[j] === '}') braceDepth -= 1
        if (braceDepth === 0) bodyEnd = j
        j += 1
      }
      const body = bodyEnd === -1 ? '' : source.slice(i + 1, bodyEnd)
      rules.push({
        selector,
        body,
        reduced,
        inReduced,
        inKeyframes,
        isAtRule: selector.startsWith('@'),
      })
      reducedStack.push(inReduced || reduced)
      keyframesStack.push(inKeyframes || isKeyframes)
      selStart = -1
    } else if (ch === '}') {
      reducedStack.pop()
      keyframesStack.pop()
      selStart = -1
    } else if (selStart === -1 && /\S/.test(ch) && ch !== '{' && ch !== ';') {
      selStart = i
    }
  }

  for (const rule of rules) {
    if (rule.reduced || rule.inReduced || rule.inKeyframes || rule.isAtRule)
      continue
    declRe.lastIndex = 0
    let declMatch
    while ((declMatch = declRe.exec(rule.body)) !== null) {
      const prop = declMatch[1].trim().toLowerCase()
      if (!MOTION_PROPERTIES.has(prop)) continue
      const value = declMatch[2].trim()
      totalMotionDeclarations += 1
      issues.push({
        selector: rule.selector,
        property: prop,
        value,
        suggestion:
          'Wrap this motion declaration in @media (prefers-reduced-motion: reduce) to respect user motion preferences.',
      })
    }
  }

  return {
    totalMotionDeclarations,
    unwrappedCount: issues.length,
    issues,
  }
}

/**
 * Run all lint rules against CSS and return combined findings.
 */
export function lintCss(css, projectDir) {
  const gapResult = lintGapDecorationHacks(css)
  const compatResult = lintGapDecorationsCompat(css, projectDir)
  const motionAccessibility = lintMotionAccessibility(css)
  return {
    findings: [...gapResult.findings, ...compatResult.findings],
    motionAccessibility,
  }
}

/**
 * Physical -> logical property mapping used by `lintLogicalProperties`.
 *
 * Scope is deliberately limited to direction-sensitive (RTL-breaking)
 * mappings: left/right margin, padding, border and inset, plus the four
 * border-radius corners. Block-axis properties (top/bottom) and sizes
 * (width/height) only differ from their logical forms in vertical writing
 * modes, not in RTL, and `overflow-inline`/`overflow-block` lack
 * cross-browser support, so none of those are reported or counted.
 * This module is the single source of truth for the mapping.
 */
export const PHYSICAL_TO_LOGICAL = {
  // Margin
  'margin-left': 'margin-inline-start',
  'margin-right': 'margin-inline-end',
  // Padding
  'padding-left': 'padding-inline-start',
  'padding-right': 'padding-inline-end',
  // Border
  'border-left': 'border-inline-start',
  'border-right': 'border-inline-end',
  'border-left-color': 'border-inline-start-color',
  'border-right-color': 'border-inline-end-color',
  'border-left-style': 'border-inline-start-style',
  'border-right-style': 'border-inline-end-style',
  'border-left-width': 'border-inline-start-width',
  'border-right-width': 'border-inline-end-width',
  // Border radius
  'border-top-left-radius': 'border-start-start-radius',
  'border-top-right-radius': 'border-start-end-radius',
  'border-bottom-left-radius': 'border-end-start-radius',
  'border-bottom-right-radius': 'border-end-end-radius',
  // Inset / positioning
  left: 'inset-inline-start',
  right: 'inset-inline-end',
}

/**
 * Physical value -> logical value mapping for direction-sensitive properties.
 * (`resize: horizontal|vertical` is axis-based, not direction-based, so it is
 * intentionally excluded.)
 */
export const PHYSICAL_VALUE_TO_LOGICAL = {
  'text-align': { left: 'start', right: 'end' },
  float: { left: 'inline-start', right: 'inline-end' },
  clear: { left: 'inline-start', right: 'inline-end' },
}

/**
 * True when a property name contains a horizontal direction keyword
 * (left / right) as a whole word segment. Used to count physical properties
 * that have no logical equivalent yet (e.g. `border-left-image`), so the
 * migration ratio stays honest rather than 1.0. Custom properties and
 * vendor-prefixed names (anything starting with `-`) are never counted.
 */
function isPhysicalProperty(property) {
  if (property.startsWith('-')) return false
  return /(^|-)(left|right)(-|$)/.test(property)
}

/**
 * True when a CSS value contains `keyword` as a whitespace-delimited token.
 */
function valueHasKeyword(value, keyword) {
  return String(value).split(/\s+/).includes(keyword)
}

/**
 * Detect physical-directional CSS properties and suggest flow-relative
 * (logical) equivalents for automatic RTL/LTR and writing-mode support.
 *
 * Emits one issue per physical declaration that has a logical equivalent,
 * carrying the selector, a `rule` ('physical-property' or 'physical-value'),
 * the physical property and the suggested flow-relative replacement.
 * The `stats` object (`totalPhysicalProperties`,
 * `migratableProperties`, `migrationRatio`) quantifies the migration surface.
 *
 * @param {string} css - Raw CSS source
 * @returns {{ issues: Array<{selector, rule, severity, reason, property, value, logicalEquivalent}>, stats: { totalPhysicalProperties: number, migratableProperties: number, migrationRatio: number } }}
 */
export function lintLogicalProperties(css) {
  const issues = []
  const rules = parseCssRules(css)

  let totalPhysicalProperties = 0

  for (const rule of rules) {
    const decls = parseDeclarations(rule.body)

    for (const [property, rawValue] of decls) {
      const value = String(rawValue)
        .replace(/\s*!important\s*$/i, '')
        .trim()
      // 1. Physical property with a direct logical property equivalent.
      if (PHYSICAL_TO_LOGICAL[property]) {
        totalPhysicalProperties += 1
        const logicalEquivalent = PHYSICAL_TO_LOGICAL[property]
        issues.push({
          selector: rule.selector,
          rule: 'physical-property',
          property,
          value,
          logicalEquivalent,
          reason: `'${property}' is a physical property. Use '${logicalEquivalent}' for flow-relative layout that adapts to writing mode and direction.`,
          severity: 'suggestion',
        })
        continue
      }

      // 2. Physical property without a logical equivalent (still counted so
      //    the migration ratio reflects the full physical surface).
      if (isPhysicalProperty(property)) {
        totalPhysicalProperties += 1
        continue
      }

      // 3. Direction-sensitive property with a physical value keyword.
      const valueMap = PHYSICAL_VALUE_TO_LOGICAL[property]
      if (valueMap) {
        const match = Object.entries(valueMap).find(([physicalKeyword]) =>
          valueHasKeyword(value, physicalKeyword)
        )
        if (match) {
          const [physicalKeyword, logicalKeyword] = match
          totalPhysicalProperties += 1
          issues.push({
            selector: rule.selector,
            rule: 'physical-value',
            property,
            value,
            logicalEquivalent: `${property}: ${logicalKeyword}`,
            reason: `'${physicalKeyword}' is a physical value for '${property}'. Use '${logicalKeyword}' for flow-relative layout.`,
            severity: 'suggestion',
          })
        }
      }
    }
  }

  const migratableProperties = issues.length
  const migrationRatio =
    totalPhysicalProperties > 0
      ? migratableProperties / totalPhysicalProperties
      : 0

  return {
    issues,
    stats: { totalPhysicalProperties, migratableProperties, migrationRatio },
  }
}
