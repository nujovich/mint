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
 * Find the closing brace matching the open brace at `openIdx`.
 * Handles nested braces; does not handle CSS string literals.
 * @param {string} src
 * @param {number} openIdx
 * @returns {number} index of matching '}', or -1 if not found
 */
function findMatchingBrace(src, openIdx) {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Scan @layer at-rule declarations (both statements and blocks) and extract
 * layer names and block spans for rules-outside-layers detection.
 *
 * Handle three forms:
 *   1. @layer name, name2;        → statement, declares order only
 *   2. @layer name { ... }        → block, defines rules inside a layer
 *   3. @layer { ... }             → anonymous block, no name
 *
 * Names are validated as CSS identifiers.
 * @param {string} src
 * @returns {{ names: string[], isBlock: boolean, start?: number, end?: number }[]}
 */
function scanAtLayers(src) {
  const results = []
  const RE_VALID_NAME = /^-?[_a-zA-Z][\w-]*$/
  const re = /@layer\b/gi
  let m
  while ((m = re.exec(src)) !== null) {
    const tail = src.slice(m.index + m[0].length)
    const nameMatch = /^\s*([^{};]*)/.exec(tail)
    if (!nameMatch) continue
    const nameStr = nameMatch[1].trim()
    // Find the indicator: '{' (block) or ';' (statement)
    const delimRe = /^\s*([{;])/
    const afterPhrase = tail.slice(nameMatch[0].length)
    const delimM = delimRe.exec(afterPhrase)

    if (!delimM) continue

    if (delimM[1] === ';') {
      // Statement form: @layer reset, base;
      const names = nameStr
        .split(',')
        .map((s) => s.trim())
        .filter((n) => RE_VALID_NAME.test(n))
      if (names.length > 0) {
        results.push({ names, isBlock: false, index: m.index })
      }
    } else if (delimM[1] === '{') {
      // Block form: @layer reset { ... }
      const openBraceIdx =
        m.index + m[0].length + nameMatch[0].length + delimM.index
      const closeIdx = findMatchingBrace(src, openBraceIdx)
      if (closeIdx === -1) continue
      const names = nameStr
        .split(',')
        .map((s) => s.trim())
        .filter((n) => RE_VALID_NAME.test(n))
      results.push({
        names,
        isBlock: true,
        index: m.index,
        start: openBraceIdx,
        end: closeIdx,
      })
      re.lastIndex = closeIdx + 1
    }
  }
  return results
}

/**
 * Find style rules (selectors followed by '{') at brace-depth 0 whose open
 * brace does not fall inside any @layer block span. These are rules declared
 * outside any @layer — unlayered styles that override all layers.
 *
 * @param {string} src
 * @param {{ start: number, end: number }[]} layerSpans
 * @returns {{ selector: string, index: number, body: string }[]}
 */
function findUnlayeredRules(src, layerSpans) {
  const rules = []
  let depth = 0
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '{') {
      if (depth === 0) {
        // Read back from 'i' to the preceding '}', ';', or start-of-string
        // to capture the full selector text.
        let k = i - 1
        while (k >= 0) {
          if (src[k] === '}' || src[k] === ';') break
          k -= 1
        }
        const selector = src.slice(k + 1, i).trim()
        if (selector && !selector.startsWith('@')) {
          const insideLayer = layerSpans.some(
            (span) => i > span.start && i < span.end
          )
          if (!insideLayer) {
            const close = findMatchingBrace(src, i)
            rules.push({
              selector,
              index: i,
              body: close === -1 ? '' : src.slice(i + 1, close),
            })
          }
        }
      }
      depth += 1
    } else if (src[i] === '}') {
      depth -= 1
      if (depth < 0) depth = 0
    }
  }
  return rules
}

/**
 * Find style rules directly inside a named @layer block. Selectors and bodies
 * are returned so callers can both group rules by layer and inspect their
 * declarations for anti-patterns (e.g. !important). Rules nested deeper than
 * one level (e.g. inside an @media query) are skipped; at-rules are ignored.
 *
 * @param {string} src
 * @param {number} start - index of the @layer block's opening brace
 * @param {number} end - index of the @layer block's closing brace
 * @returns {{ selector: string, body: string }[]}
 */
function findRulesInLayer(src, start, end) {
  const rules = []
  let depth = 0
  for (let i = start; i <= end; i++) {
    if (src[i] === '{') {
      if (depth === 1) {
        let k = i - 1
        while (
          k >= start &&
          src[k] !== '}' &&
          src[k] !== ';' &&
          src[k] !== '{'
        ) {
          k -= 1
        }
        const selector = src.slice(k + 1, i).trim()
        if (selector && !selector.startsWith('@')) {
          const close = findMatchingBrace(src, i)
          rules.push({
            selector,
            body: close === -1 ? '' : src.slice(i + 1, close),
          })
        }
      }
      depth += 1
    } else if (src[i] === '}') {
      depth -= 1
    }
  }
  return rules
}

/**
 * Detect CSS Cascade Layers (@layer) structure: ordered layer names and rules
 * declared outside any layer (unlayered styles override all layers).
 *
 * @param {string} css - Raw CSS source
 * @returns {import('../lib/types.ts').CascadeLayerAudit}
 */
export function lintCascadeLayers(css) {
  const src = String(css).replace(/\/\*[\s\S]*?\*\//g, ' ')
  const declarations = scanAtLayers(src)

  // Build ordered, deduped layer name list preserving first-seen order.
  const layerSet = new Set()
  const layers = []
  for (const d of declarations) {
    for (const name of d.names) {
      if (!layerSet.has(name)) {
        layerSet.add(name)
        layers.push(name)
      }
    }
  }

  // Collect block spans for rules-outside-layers check.
  const layerSpans = declarations
    .filter((d) => d.isBlock)
    .map((d) => ({ start: d.start, end: d.end }))

  const unlayered = findUnlayeredRules(src, layerSpans)

  const hasLayers = declarations.length > 0
  const firstLayerIndex = hasLayers
    ? Math.min(...declarations.map((d) => d.index))
    : -1

  // Unlayered rules are a suggestion; unlayered rules that also carry high
  // specificity and appear after the layer order is established are flagged as
  // a more specific anti-pattern (post-layer specificity).
  const issues = unlayered.map(({ selector, index, body }) => {
    const highSpecificity = selector.includes('#') || /!important/i.test(body)
    if (hasLayers && index > firstLayerIndex && highSpecificity) {
      return {
        selector,
        rule: 'post-layer-specificity',
        severity: 'warning',
        reason:
          'Unlayered rule with high specificity declared after @layer blocks. Unlayered styles already override every layer regardless of specificity, so the extra specificity is misleading and likely an attempt to out-specify the layer cascade. Move this rule into the intended @layer (or drop the specificity) instead.',
      }
    }
    return {
      selector,
      rule: 'rules-outside-layers',
      severity: 'suggestion',
      reason:
        'Rule declared outside any @layer block. Unlayered styles take precedence over all layers, which can make layer ordering ineffective. Consider placing this rule inside a @layer block.',
    }
  })

  // Milestone 2: group rules by layer and detect !important inside layers.
  const rulesByLayer = {}
  for (const d of declarations) {
    if (!d.isBlock || d.names.length === 0) continue
    const layerName = d.names[0]
    const rules = findRulesInLayer(src, d.start, d.end)
    if (!(layerName in rulesByLayer)) rulesByLayer[layerName] = []
    for (const rule of rules) {
      rulesByLayer[layerName].push(rule.selector)
      if (/!important/i.test(rule.body)) {
        issues.push({
          selector: rule.selector,
          rule: 'important-in-layer',
          severity: 'warning',
          layer: layerName,
          reason: `Uses !important inside @layer "${layerName}". !important reverses layer priority: an !important declaration in an earlier layer outranks normal declarations in later layers and unlayered styles, which can make low-priority layers like resets unexpectedly win. Prefer moving the declaration to the appropriate layer instead.`,
        })
      }
    }
  }

  // Milestone 3: layer hierarchy + implicit/explicit ordering detection.
  const explicitNames = new Set()
  for (const d of declarations) {
    if (!d.isBlock) {
      for (const name of d.names) explicitNames.add(name)
    }
  }
  const orderExplicit = declarations.some(
    (d) => !d.isBlock && d.names.length > 0
  )
  const hierarchy = layers.map((name, rank) => ({
    name,
    rank,
    order: explicitNames.has(name) ? 'explicit' : 'implicit',
    rulesCount: (rulesByLayer[name] || []).length,
  }))

  return {
    layers,
    layerCount: layers.length,
    rulesOutsideLayers: unlayered.length,
    rulesByLayer,
    issues,
    orderExplicit,
    hierarchy,
  }
}

/**
 * Run all lint rules against CSS and return combined findings.
 */
export function lintCss(css, projectDir) {
  const gapResult = lintGapDecorationHacks(css)
  const compatResult = lintGapDecorationsCompat(css, projectDir)
  const cascadeLayers = lintCascadeLayers(css)
  return {
    findings: [...gapResult.findings, ...compatResult.findings],
    cascadeLayers,
  }
}
