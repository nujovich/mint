import { describe, it, expect } from 'vitest'
import {
  parseCssRules,
  parseDeclarations,
  lintGapDecorationHacks,
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
      f => f.pattern === 'border-as-gap-line'
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
      f => f.pattern === 'border-as-gap-line'
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
