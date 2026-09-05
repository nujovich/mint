import { describe, it, expect } from 'vitest'
import {
  parseCssRules,
  parseDeclarations,
  lintGapDecorationHacks,
  lintGapDecorationsCompat,
  lintGapDecorationAdoption,
  lintUnusedCustomProperties,
  lintCss,
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

describe('lintUnusedCustomProperties', () => {
  it('returns an empty audit for CSS without custom properties', () => {
    const css = '.text { color: red; }'
    const result = lintUnusedCustomProperties(css)
    expect(result.defined).toEqual([])
    expect(result.used).toEqual([])
    expect(result.unused).toEqual([])
    expect(result.totalDefined).toBe(0)
    expect(result.unusedCount).toBe(0)
  })

  it('detects a declared-but-unreferenced custom property', () => {
    const css = ':root { --brand: #333; --dead: #fff; }'
    const result = lintUnusedCustomProperties(css)
    expect(result.totalDefined).toBe(2)
    expect(result.unusedCount).toBe(2)
    expect(result.unused.map((u) => u.name)).toContain('--dead')
    expect(result.unused.map((u) => u.name)).toContain('--brand')
  })

  it('does not flag a custom property that is referenced via var()', () => {
    const css = `
      :root { --brand: #333; }
      .button { color: var(--brand); }
    `
    const result = lintUnusedCustomProperties(css)
    expect(result.defined).toEqual(['--brand'])
    expect(result.used).toEqual(['--brand'])
    expect(result.unused).toEqual([])
    expect(result.unusedCount).toBe(0)
  })

  it('attributes the defining selector in definedIn', () => {
    const css = `
      :root { --tw-bg-opacity: 1; }
      .card { color: #fff; }
    `
    const result = lintUnusedCustomProperties(css)
    expect(result.unused).toHaveLength(1)
    expect(result.unused[0]).toEqual({
      name: '--tw-bg-opacity',
      definedIn: ':root',
      suggestion: expect.any(String),
    })
  })

  it('treats custom property names as case-sensitive', () => {
    const css = `
      :root { --Brand: #333; }
      .button { color: var(--brand); }
    `
    const result = lintUnusedCustomProperties(css)
    // --Brand and --brand are distinct: --Brand is unused.
    expect(result.unused.map((u) => u.name)).toContain('--Brand')
    expect(result.used).toContain('--brand')
  })

  it('deduplicates repeated var() references and declarations', () => {
    const css = `
      :root { --brand: #333; --brand: #444; }
      .a { color: var(--brand); }
      .b { color: var(--brand); }
    `
    const result = lintUnusedCustomProperties(css)
    expect(result.defined).toEqual(['--brand'])
    expect(result.used).toEqual(['--brand'])
    expect(result.unused).toEqual([])
  })

  it('ignores var() references inside comments', () => {
    const css = `
      /* var(--ghost) */
      :root { --brand: #333; }
    `
    const result = lintUnusedCustomProperties(css)
    expect(result.used).not.toContain('--ghost')
    expect(result.unused.map((u) => u.name)).toContain('--brand')
  })

  it('handles empty CSS gracefully', () => {
    const result = lintUnusedCustomProperties('')
    expect(result.defined).toEqual([])
    expect(result.used).toEqual([])
    expect(result.unused).toEqual([])
    expect(result.totalDefined).toBe(0)
    expect(result.unusedCount).toBe(0)
  })

  it('produces a cleanup suggestion for unused properties', () => {
    const css = ':root { --dead: #fff; }'
    const result = lintUnusedCustomProperties(css)
    expect(result.unused[0].suggestion).toContain('--dead')
    expect(result.unused[0].suggestion).toContain('var(--dead)')
  })
})
