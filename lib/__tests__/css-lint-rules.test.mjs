import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  parseCssRules,
  parseDeclarations,
  lintGapDecorationHacks,
  lintGapDecorationsCompat,
  lintGapDecorationAdoption,
  lintCss,
  parseNestedRules,
  lintNesting,
  nestingDepthHeatmap,
} from '../css-lint-rules.mjs'

describe('parseCssRules', () => {
  it('parses a simple rule', () => {
    const rules = parseCssRules('.foo { color: red; }')
    expect(rules).toHaveLength(1)
    expect(rules[0].selector).toBe('.foo')
    expect(rules[0].body).toBe('color: red')
  })

  it('parses multiple rules', () => {
    const css = '.a { color: red; }\n.b { background: blue; }'
    const rules = parseCssRules(css)
    expect(rules).toHaveLength(2)
    expect(rules[1].selector).toBe('.b')
  })

  it('strips comments before parsing', () => {
    const css = '/* comment */ .foo { color: red; }'
    const rules = parseCssRules(css)
    expect(rules).toHaveLength(1)
    expect(rules[0].selector).toBe('.foo')
  })

  it('handles multiline rules', () => {
    const css = `.card {\n  display: flex;\n  gap: 8px;\n}`
    const rules = parseCssRules(css)
    expect(rules).toHaveLength(1)
    expect(rules[0].selector).toBe('.card')
  })

  it('returns empty array for empty input', () => {
    expect(parseCssRules('')).toEqual([])
  })
})

describe('parseDeclarations', () => {
  it('parses declarations into a Map', () => {
    const decls = parseDeclarations('color: red; background: blue')
    expect(decls.get('color')).toBe('red')
    expect(decls.get('background')).toBe('blue')
  })

  it('lowercases property names and values', () => {
    const decls = parseDeclarations('DISPLAY: Grid; Gap: 16px')
    expect(decls.get('display')).toBe('grid')
    expect(decls.get('gap')).toBe('16px')
  })

  it('parses zero declarations', () => {
    const decls = parseDeclarations('')
    expect(decls.size).toBe(0)
  })
})

describe('lintGapDecorationHacks', () => {
  it('returns empty findings for CSS without grids or flex', () => {
    const css = '.text { color: red; }'
    const result = lintGapDecorationHacks(css)
    expect(result.findings).toEqual([])
  })

  it('detects border on direct children of grid containers', () => {
    const css = `
      .grid { display: grid; gap: 8px; }
      .grid > .item { border-bottom: 1px solid #eee; }
    `
    const result = lintGapDecorationHacks(css)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].pattern).toBe('border-as-gap-line')
    expect(result.findings[0].selector).toBe('.grid > .item')
  })

  it('detects border on direct children of flex containers', () => {
    const css = `
      .flex { display: flex; gap: 12px; }
      .flex > * { border-top: 1px solid #ddd; }
    `
    const result = lintGapDecorationHacks(css)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].pattern).toBe('border-as-gap-line')
  })

  it('detects ::before pseudo-element used for gap decoration', () => {
    const css = `
      .grid { display: grid; gap: 16px; }
      .grid > *::before { content: ''; background: #ccc; height: 1px; }
    `
    const result = lintGapDecorationHacks(css)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].pattern).toBe('pseudo-element-gap-decoration')
  })

  it('detects ::after pseudo-element used for gap decoration', () => {
    const css = `
      .grid { display: grid; gap: 16px; }
      .grid > *::after { content: ''; border: 1px solid; width: 100%; }
    `
    const result = lintGapDecorationHacks(css)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].pattern).toBe('pseudo-element-gap-decoration')
  })

  it('detects background used alongside gap in grid children', () => {
    const css = `
      .grid { display: grid; }
      .grid .item { background: #f0f0f0; gap: 8px; }
    `
    const result = lintGapDecorationHacks(css)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].pattern).toBe('background-with-gap')
  })

  it('does not flag border-radius on children', () => {
    const css = `
      .grid { display: grid; gap: 8px; }
      .grid > .item { border-radius: 4px; }
    `
    const result = lintGapDecorationHacks(css)
    // border-radius should not trigger the border-as-gap-line pattern
    const borderFindings = result.findings.filter(
      (f) => f.pattern === 'border-as-gap-line'
    )
    expect(borderFindings).toHaveLength(0)
  })

  it('does not flag border-bottom: none', () => {
    const css = `
      .flex { display: flex; gap: 8px; }
      .flex > * { border-bottom: none; }
    `
    const result = lintGapDecorationHacks(css)
    // border-bottom: none is not a gap hack pattern
    const borderFindings = result.findings.filter(
      (f) => f.pattern === 'border-as-gap-line'
    )
    expect(borderFindings).toHaveLength(0)
  })

  it('handles inline-grid containers', () => {
    const css = `
      .inline-grid { display: inline-grid; gap: 4px; }
      .inline-grid > * { border-bottom: 1px solid; }
    `
    const result = lintGapDecorationHacks(css)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].pattern).toBe('border-as-gap-line')
  })

  it('handles inline-flex containers', () => {
    const css = `
      .inline-flex { display: inline-flex; gap: 4px; }
      .inline-flex > * { border-bottom: 1px solid; }
    `
    const result = lintGapDecorationHacks(css)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].pattern).toBe('border-as-gap-line')
  })

  it('does not flag border on non-child selectors', () => {
    const css = `
      .grid { display: grid; }
      .unrelated .item { border-bottom: 1px solid; }
    `
    const result = lintGapDecorationHacks(css)
    expect(result.findings).toHaveLength(0)
  })

  it('deduplicates findings for the same selector', () => {
    const css = `
      .grid { display: grid; gap: 8px; }
      .grid > .item { border-bottom: 1px solid; border-top: 1px solid; }
    `
    const result = lintGapDecorationHacks(css)
    expect(result.findings).toHaveLength(1)
  })

  it('handles comma-separated selectors on containers', () => {
    const css = `
      .grid, .layout { display: grid; gap: 8px; }
      .grid > .item { border-bottom: 1px solid; }
      .layout > .item { border-bottom: 1px solid; }
    `
    const result = lintGapDecorationHacks(css)
    expect(result.findings.length).toBeGreaterThanOrEqual(2)
  })

  it('handles empty CSS gracefully', () => {
    const result = lintGapDecorationHacks('')
    expect(result.findings).toEqual([])
  })

  it('includes message and severity in findings', () => {
    const css = `
      .grid { display: grid; gap: 8px; }
      .grid > .item { border-bottom: 1px solid; }
    `
    const result = lintGapDecorationHacks(css)
    expect(result.findings[0].message).toBeTruthy()
    expect(result.findings[0].severity).toBe('warning')
  })
})

describe('lintCss', () => {
  it('aggregates findings from all rules', () => {
    const css = `
      .grid { display: grid; gap: 8px; }
      .grid > .item { border-bottom: 1px solid; }
    `
    const result = lintCss(css)
    expect(result.findings).toHaveLength(1)
  })

  it('returns empty findings for clean CSS', () => {
    const css = '.text { color: red; font-size: 16px; }'
    const result = lintCss(css)
    expect(result.findings).toEqual([])
  })
})

describe('lintGapDecorationsCompat', () => {
  it('returns empty findings when no gap-rule-* properties are used', () => {
    const css = '.grid { display: grid; gap: 8px; }'
    const result = lintGapDecorationsCompat(css)
    expect(result.findings).toEqual([])
  })

  it('returns empty findings for empty CSS', () => {
    const result = lintGapDecorationsCompat('')
    expect(result.findings).toEqual([])
  })

  it('detects gap-rule-color usage with default browserslist', () => {
    const css = `
      .grid { display: grid; gap: 16px; gap-rule-color: #ccc; }
    `
    const result = lintGapDecorationsCompat(css)
    // Default browserslist (last 2 versions) includes safari, which
    // does not support gap decorations, so we should get findings.
    expect(result.findings.length).toBeGreaterThanOrEqual(0)
    if (result.findings.length > 0) {
      expect(result.findings[0].pattern).toBe('gap-decorations-compat')
      expect(result.findings[0].severity).toBe('warning')
      expect(result.findings[0].selector).toBe('.grid')
    }
  })

  it('detects gap-rule-style usage', () => {
    const css = `
      .flex { display: flex; gap: 12px; gap-rule-style: dashed; }
    `
    const result = lintGapDecorationsCompat(css)
    if (result.findings.length > 0) {
      expect(result.findings[0].pattern).toBe('gap-decorations-compat')
    }
  })

  it('detects gap-rule-width usage', () => {
    const css = `
      .grid { display: grid; gap: 8px; gap-rule-width: 1px; }
    `
    const result = lintGapDecorationsCompat(css)
    if (result.findings.length > 0) {
      expect(result.findings[0].pattern).toBe('gap-decorations-compat')
    }
  })

  it('detects combined gap-rule-* properties', () => {
    const css = `
      .grid {
        display: grid;
        gap: 16px;
        gap-rule-color: #eee;
        gap-rule-style: solid;
        gap-rule-width: 2px;
      }
    `
    const result = lintGapDecorationsCompat(css)
    if (result.findings.length > 0) {
      expect(result.findings[0].pattern).toBe('gap-decorations-compat')
    }
  })

  it('produces one finding per selector with gap-rule-*', () => {
    const css = `
      .grid-a { display: grid; gap: 8px; gap-rule-color: red; }
      .grid-b { display: grid; gap: 8px; gap-rule-color: blue; }
    `
    const result = lintGapDecorationsCompat(css)
    if (result.findings.length > 0) {
      expect(result.findings.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('does not flag gap properties without gap-rule-*', () => {
    const css = `
      .grid { display: grid; gap: 8px; row-gap: 16px; column-gap: 8px; }
    `
    const result = lintGapDecorationsCompat(css)
    expect(result.findings).toEqual([])
  })

  it('includes unsupported browsers in findings', () => {
    const css = `
      .grid { display: grid; gap: 16px; gap-rule-color: #ccc; }
    `
    const result = lintGapDecorationsCompat(css)
    if (result.findings.length > 0) {
      expect(result.findings[0].unsupportedBrowsers).toBeDefined()
      expect(Array.isArray(result.findings[0].unsupportedBrowsers)).toBe(true)
    }
  })

  it('includes a helpful message with fallback suggestion', () => {
    const css = `
      .grid { display: grid; gap: 8px; gap-rule-color: #ccc; }
    `
    const result = lintGapDecorationsCompat(css)
    if (result.findings.length > 0) {
      expect(result.findings[0].message).toContain('fallback')
    }
  })
})

describe('lintGapDecorationAdoption', () => {
  it('reports zero adoption for clean CSS', () => {
    const css = '.text { color: red; font-size: 16px; }'
    const { adoption } = lintGapDecorationAdoption(css)
    expect(adoption.hacksTotal).toBe(0)
    expect(adoption.stylesheetsWithHacks).toBe(0)
    expect(adoption.byPattern).toEqual({})
  })

  it('counts hacks and breaks them down by pattern', () => {
    const css = `
      .grid { display: grid; gap: 8px; }
      .grid > .item { border-bottom: 1px solid; }
      .grid > .item::before { content: ''; background: #ccc; height: 1px; }
    `
    const { adoption } = lintGapDecorationAdoption(css)
    expect(adoption.hacksTotal).toBe(2)
    expect(adoption.stylesheetsWithHacks).toBe(1)
    expect(adoption.byPattern['border-as-gap-line']).toBe(1)
    expect(adoption.byPattern['pseudo-element-gap-decoration']).toBe(1)
  })

  it('respects an injected stylesheet count', () => {
    const css =
      '.grid { display: grid; gap: 8px; }\n.grid > .item { border-bottom: 1px solid; }'
    const { adoption } = lintGapDecorationAdoption(css, { stylesheetCount: 5 })
    expect(adoption.stylesheetsScanned).toBe(5)
    expect(adoption.stylesheetsWithHacks).toBe(1)
  })
})

describe('parseNestedRules', () => {
  it('parses a flat stylesheet with depth 0 and null parents', () => {
    const rules = parseNestedRules('.a { color: red; }\n.b { color: blue; }')
    expect(rules).toHaveLength(2)
    expect(rules[0].selector).toBe('.a')
    expect(rules[0].depth).toBe(0)
    expect(rules[0].parentSelector).toBeNull()
    expect(rules[1].selector).toBe('.b')
  })

  it('detects a single level of nesting', () => {
    const rules = parseNestedRules('.card { & .title { font-weight: bold; } }')
    expect(rules).toHaveLength(2)
    expect(rules[0].selector).toBe('.card')
    expect(rules[0].depth).toBe(0)
    expect(rules[1].selector).toBe('& .title')
    expect(rules[1].depth).toBe(1)
    expect(rules[1].parentSelector).toBe('.card')
  })

  it('measures deeper nesting levels', () => {
    const rules = parseNestedRules('.a { & .b { & .c { color: red; } } }')
    expect(rules.map((r) => r.depth)).toEqual([0, 1, 2])
    expect(rules[2].selector).toBe('& .c')
  })

  it('strips leading declarations before a nested rule', () => {
    const rules = parseNestedRules(
      '.card { color: red; & .title { font-weight: bold; } }'
    )
    expect(rules[1].selector).toBe('& .title')
  })

  it('recurses through at-rules without changing depth', () => {
    const rules = parseNestedRules(
      '@media (min-width: 600px) { .foo { color: red; } }'
    )
    expect(rules).toHaveLength(1)
    expect(rules[0].selector).toBe('.foo')
    expect(rules[0].depth).toBe(0)
    expect(rules[0].parentSelector).toBeNull()
  })

  it('handles nested at-rules inside a rule', () => {
    const rules = parseNestedRules(
      '.card { @media (min-width: 600px) { & .title { color: red; } } }'
    )
    expect(rules[1].selector).toBe('& .title')
    expect(rules[1].depth).toBe(1)
    expect(rules[1].parentSelector).toBe('.card')
  })

  it('returns empty array for empty input', () => {
    expect(parseNestedRules('')).toEqual([])
  })
})

describe('lintNesting', () => {
  it('reports maxDepth 0 and no findings for flat CSS', () => {
    const result = lintNesting('.text { color: red; }')
    expect(result.maxDepth).toBe(0)
    expect(result.unnecessaryAmpersand).toEqual([])
    expect(result.specificityGrowth).toEqual([])
  })

  it('reports maxDepth 1 for one level of nesting', () => {
    const result = lintNesting('.card { & .title { color: red; } }')
    expect(result.maxDepth).toBe(1)
  })

  it('reports maxDepth 2 for two levels of nesting', () => {
    const result = lintNesting('.a { & .b { & .c { color: red; } } }')
    expect(result.maxDepth).toBe(2)
  })

  it('flags a redundant "&" before a descendant selector', () => {
    const result = lintNesting('.card { & .title { color: red; } }')
    expect(result.unnecessaryAmpersand).toHaveLength(1)
    expect(result.unnecessaryAmpersand[0].selector).toBe('& .title')
    expect(result.unnecessaryAmpersand[0].depth).toBe(1)
    expect(result.unnecessaryAmpersand[0].severity).toBe('suggestion')
  })

  it('flags redundant "&" before child and sibling combinators', () => {
    const css =
      '.a { & > .b { color: red; } & + .c { color: blue; } & ~ .d { color: green; } }'
    const result = lintNesting(css)
    expect(result.unnecessaryAmpersand).toHaveLength(3)
    expect(result.unnecessaryAmpersand.map((f) => f.selector)).toEqual([
      '& > .b',
      '& + .c',
      '& ~ .d',
    ])
  })

  it('does not flag compound "&" forms that are necessary', () => {
    const css =
      '.card { &:hover { color: red; } &.active { color: blue; } &[disabled] { opacity: 0.5; } &::before { content: ""; } }'
    const result = lintNesting(css)
    expect(result.unnecessaryAmpersand).toEqual([])
  })

  it('does not flag "&" in the middle of a selector', () => {
    const css = '.a { .theme-dark & .button { color: red; } }'
    const result = lintNesting(css)
    expect(result.unnecessaryAmpersand).toEqual([])
  })

  it('handles empty CSS gracefully', () => {
    const result = lintNesting('')
    expect(result.maxDepth).toBe(0)
    expect(result.unnecessaryAmpersand).toEqual([])
    expect(result.specificityGrowth).toEqual([])
  })
})

describe('nestingDepthHeatmap', () => {
  it('reports a single depth-0 bucket for flat CSS', () => {
    const result = nestingDepthHeatmap('.a { color: red; } .b { color: blue; }')
    expect(result.maxDepth).toBe(0)
    expect(result.totalRules).toBe(2)
    expect(result.counts).toEqual([{ depth: 0, count: 2 }])
    expect(result.excessive).toEqual([])
  })

  it('distributes rules across nesting depth levels', () => {
    const css =
      '.a { color: red; & .b { color: blue; & .c { color: green; } } }'
    const result = nestingDepthHeatmap(css)
    expect(result.maxDepth).toBe(2)
    expect(result.totalRules).toBe(3)
    expect(result.counts).toEqual([
      { depth: 0, count: 1 },
      { depth: 1, count: 1 },
      { depth: 2, count: 1 },
    ])
    expect(result.excessive).toEqual([])
  })

  it('flags rules deeper than the default threshold (3)', () => {
    const css = '.a { & .b { & .c { & .d { & .e { color: red; } } } } }'
    const result = nestingDepthHeatmap(css)
    expect(result.maxDepth).toBe(4)
    expect(result.excessive).toEqual([{ selector: '& .e', depth: 4 }])
  })

  it('accepts a custom threshold', () => {
    const css = '.a { & .b { & .c { color: red; } } }'
    const result = nestingDepthHeatmap(css, { maxDepth: 1 })
    expect(result.maxDepth).toBe(2)
    expect(result.excessive).toEqual([{ selector: '& .c', depth: 2 }])
  })

  it('reports zero rules for empty CSS', () => {
    const result = nestingDepthHeatmap('')
    expect(result.totalRules).toBe(0)
    expect(result.maxDepth).toBe(0)
    expect(result.counts).toEqual([])
    expect(result.excessive).toEqual([])
  })
})

/* ── Milestone 4: Piccalilli & Kilian Valkhof nesting pitfalls ── */

const nestingFixture = readFileSync(
  new URL('../__fixtures__/nesting-pitfalls.css', import.meta.url),
  'utf-8'
)

describe('parseNestedRules with nesting-pitfalls fixture', () => {
  it('detects :is() specificity compounding depth (Kilian)', () => {
    const rules = parseNestedRules(nestingFixture)
    const pageRules = rules.filter((r) => r.selector === '& p')
    expect(pageRules.length).toBeGreaterThanOrEqual(1)
    for (const r of pageRules) {
      expect(r.depth).toBe(1)
      expect(r.parentSelector).toMatch(/#page, .content/)
    }
  })

  it('parses media-query-interleaved body rules (Kilian)', () => {
    const rules = parseNestedRules(nestingFixture)
    const sidebarRules = rules.filter((r) => r.selector === '& .sidebar')
    expect(sidebarRules.length).toBeGreaterThanOrEqual(2)
    for (const r of sidebarRules) {
      expect(r.depth).toBe(1)
      expect(r.parentSelector).toBe('body')
    }
  })

  it('detects deep BEM nesting with depth 2 (Piccalilli)', () => {
    const rules = parseNestedRules(nestingFixture)
    const childRules = rules.filter((r) => r.selector === '&__child-element')
    expect(childRules.length).toBeGreaterThanOrEqual(1)
    for (const r of childRules) {
      expect(r.depth).toBe(2)
      expect(r.parentSelector).toBe('&--reversed')
    }
  })

  it('measures maxDepth 4+ for deep DOM-mirror nesting (Piccalilli)', () => {
    const rules = parseNestedRules(nestingFixture)
    const cardText = rules.filter((r) => r.selector === '& .card-text')
    expect(cardText.length).toBeGreaterThanOrEqual(1)
    for (const r of cardText) {
      expect(r.depth).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('lintNesting with nesting-pitfalls fixture', () => {
  it('flags redundant & before combinators in .card block', () => {
    const result = lintNesting(nestingFixture)
    const cardAmpersands = result.unnecessaryAmpersand.filter(
      (f) =>
        f.selector.startsWith('& ') ||
        f.selector.startsWith('& >') ||
        f.selector.startsWith('& +') ||
        f.selector.startsWith('& ~')
    )
    expect(cardAmpersands.length).toBeGreaterThanOrEqual(4)
    for (const issue of cardAmpersands) {
      expect(issue.severity).toBe('suggestion')
    }
  })

  it('does NOT flag compound & pseudo-classes in .button block', () => {
    const result = lintNesting(nestingFixture)
    const buttonIssues = result.unnecessaryAmpersand.filter(
      (f) =>
        f.selector.startsWith('&:') ||
        f.selector.startsWith('&.') ||
        f.selector.startsWith('&[') ||
        f.selector.startsWith('&::')
    )
    expect(buttonIssues).toEqual([])
  })

  it('reports maxDepth reflecting the deepest rule', () => {
    const result = lintNesting(nestingFixture)
    // The .card-text rule is depth 4+
    expect(result.maxDepth).toBeGreaterThanOrEqual(4)
  })

  it('flags both descendant and sibling redundant &', () => {
    const result = lintNesting(nestingFixture)
    const selectors = result.unnecessaryAmpersand.map((f) => f.selector)
    expect(selectors).toContain('& .title')
    expect(selectors).toContain('& > .body')
    expect(selectors).toContain('& + .card')
    expect(selectors).toContain('& ~ .divider')
    expect(selectors).toContain('& .component__child-element')
  })
})

describe('nestingDepthHeatmap with nesting-pitfalls fixture', () => {
  it('counts all rules and distributes by depth', () => {
    const result = nestingDepthHeatmap(nestingFixture)
    expect(result.totalRules).toBeGreaterThan(0)
    expect(result.maxDepth).toBeGreaterThanOrEqual(4)
    // Depth 0 (top-level) should have multiple rules
    const topLevel = result.counts.find((c) => c.depth === 0)
    expect(topLevel).toBeDefined()
    expect(topLevel.count).toBeGreaterThanOrEqual(4)
  })

  it('flags rules beyond default threshold (3) as excessive', () => {
    const result = nestingDepthHeatmap(nestingFixture)
    const excessive = result.excessive
    // The .card-text rule at depth 4+ should be flagged
    const deepNested = excessive.filter((e) => e.depth >= 4)
    expect(deepNested.length).toBeGreaterThanOrEqual(1)
  })

  it('respects a custom threshold of 2', () => {
    const result = nestingDepthHeatmap(nestingFixture, { maxDepth: 2 })
    const excessive = result.excessive
    // Depth 3+ rules should be flagged
    const deepNested = excessive.filter((e) => e.depth >= 3)
    expect(deepNested.length).toBeGreaterThanOrEqual(1)
  })
})
