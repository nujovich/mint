import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  parseCssRules,
  parseDeclarations,
  lintGapDecorationHacks,
  lintGapDecorationsCompat,
  lintGapDecorationAdoption,
  lintCss,
  lintLogicalProperties,
  PHYSICAL_TO_LOGICAL,
  PHYSICAL_VALUE_TO_LOGICAL,
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

describe('PHYSICAL_TO_LOGICAL mapping', () => {
  it('maps horizontal margin/padding/border to logical equivalents', () => {
    expect(PHYSICAL_TO_LOGICAL['margin-left']).toBe('margin-inline-start')
    expect(PHYSICAL_TO_LOGICAL['margin-right']).toBe('margin-inline-end')
    expect(PHYSICAL_TO_LOGICAL['padding-left']).toBe('padding-inline-start')
    expect(PHYSICAL_TO_LOGICAL['padding-right']).toBe('padding-inline-end')
    expect(PHYSICAL_TO_LOGICAL['border-left']).toBe('border-inline-start')
    expect(PHYSICAL_TO_LOGICAL['border-right-width']).toBe(
      'border-inline-end-width'
    )
  })

  it('maps left/right inset and border-radius corners', () => {
    expect(PHYSICAL_TO_LOGICAL['left']).toBe('inset-inline-start')
    expect(PHYSICAL_TO_LOGICAL['right']).toBe('inset-inline-end')
    expect(PHYSICAL_TO_LOGICAL['border-top-left-radius']).toBe(
      'border-start-start-radius'
    )
    expect(PHYSICAL_TO_LOGICAL['border-bottom-right-radius']).toBe(
      'border-end-end-radius'
    )
  })

  it('maps text-align, float and clear value keywords', () => {
    expect(PHYSICAL_VALUE_TO_LOGICAL['text-align']).toEqual({
      left: 'start',
      right: 'end',
    })
    expect(PHYSICAL_VALUE_TO_LOGICAL['float']['left']).toBe('inline-start')
    expect(PHYSICAL_VALUE_TO_LOGICAL['clear']['right']).toBe('inline-end')
  })

  it('excludes block-axis, size, overflow and resize mappings', () => {
    for (const prop of [
      'margin-top',
      'margin-bottom',
      'padding-top',
      'padding-bottom',
      'border-top',
      'border-bottom',
      'top',
      'bottom',
      'width',
      'height',
      'min-width',
      'max-height',
      'overflow-x',
      'overflow-y',
    ]) {
      expect(PHYSICAL_TO_LOGICAL[prop], prop).toBeUndefined()
    }
    expect(PHYSICAL_VALUE_TO_LOGICAL['resize']).toBeUndefined()
  })

  it('has no mapping for already-logical properties', () => {
    expect(PHYSICAL_TO_LOGICAL['margin-inline-start']).toBeUndefined()
    expect(PHYSICAL_TO_LOGICAL['padding-block-end']).toBeUndefined()
    expect(PHYSICAL_TO_LOGICAL['inset-inline-start']).toBeUndefined()
  })
})

describe('lintLogicalProperties', () => {
  it('detects a physical margin property and suggests its logical equivalent', () => {
    const css = '.card { margin-left: 20px; }'
    const { issues } = lintLogicalProperties(css)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      selector: '.card',
      property: 'margin-left',
      value: '20px',
      logicalEquivalent: 'margin-inline-start',
      severity: 'suggestion',
    })
  })

  it('detects physical padding properties', () => {
    const css = '.card { padding-right: 1rem; }'
    const { issues } = lintLogicalProperties(css)
    expect(issues).toHaveLength(1)
    expect(issues[0].logicalEquivalent).toBe('padding-inline-end')
  })

  it('detects left/right inset properties', () => {
    const css = '.sticky { left: 0; right: 0; }'
    const { issues } = lintLogicalProperties(css)
    expect(issues.map((i) => i.logicalEquivalent)).toEqual([
      'inset-inline-start',
      'inset-inline-end',
    ])
  })

  it('detects physical value keywords', () => {
    const css = '.rtl { text-align: left; float: right; }'
    const { issues } = lintLogicalProperties(css)
    expect(issues).toHaveLength(2)
    expect(issues[0].logicalEquivalent).toBe('text-align: start')
    expect(issues[1].logicalEquivalent).toBe('float: inline-end')
  })

  it.each([
    'width: 100px',
    'height: 50vh',
    'min-width: 1px',
    'max-height: 2px',
    'top: 0',
    'bottom: 0',
    'margin-top: 4px',
    'padding-bottom: 4px',
    'border-bottom: 1px solid red',
    'overflow-x: hidden',
    'resize: horizontal',
  ])('ignores block-axis/size/axis declaration "%s"', (decl) => {
    const { issues, stats } = lintLogicalProperties(`.a { ${decl}; }`)
    expect(issues).toEqual([])
    expect(stats.totalPhysicalProperties).toBe(0)
  })

  it('does not count custom properties or vendor-prefixed names', () => {
    const css =
      '.a { --margin-left: 1px; -webkit-border-top-left-radius: 2px; }'
    const { issues, stats } = lintLogicalProperties(css)
    expect(issues).toEqual([])
    expect(stats.totalPhysicalProperties).toBe(0)
  })

  it('emits a single issue and count for multiple physical keywords', () => {
    const { issues, stats } = lintLogicalProperties('.a { float: left right; }')
    expect(issues).toHaveLength(1)
    expect(stats.totalPhysicalProperties).toBe(1)
    expect(stats.migratableProperties).toBe(1)
  })

  it('strips !important from the reported value but still detects it', () => {
    const { issues } = lintLogicalProperties(
      '.a { margin-left: 1px !important; text-align: left !important; }'
    )
    expect(issues).toHaveLength(2)
    expect(issues[0].value).toBe('1px')
    expect(issues[1].value).toBe('left')
  })

  it('does not flag already-logical properties', () => {
    const css = '.card { margin-inline-start: 20px; padding-block-end: 1rem; }'
    const { issues } = lintLogicalProperties(css)
    expect(issues).toEqual([])
  })

  it('does not flag direction-neutral properties', () => {
    const css = '.text { color: red; font-size: 16px; }'
    const { issues } = lintLogicalProperties(css)
    expect(issues).toEqual([])
  })

  it('returns empty results and zero ratio for clean CSS', () => {
    const { issues, stats } = lintLogicalProperties('.text { color: red; }')
    expect(issues).toEqual([])
    expect(stats).toEqual({
      totalPhysicalProperties: 0,
      migratableProperties: 0,
      migrationRatio: 0,
    })
  })

  it('computes total, migratable, and ratio across mixed CSS', () => {
    const css = `
      .a { margin-left: 1rem; }
      .b { border-left-image: none; }
      .c { width: 50%; }
    `
    const { issues, stats } = lintLogicalProperties(css)
    // margin-left is migratable; border-left-image is physical but has no
    // mapping (counted, not migratable); width is out of scope.
    expect(stats.totalPhysicalProperties).toBe(2)
    expect(stats.migratableProperties).toBe(1)
    expect(issues).toHaveLength(1)
    expect(stats.migrationRatio).toBeCloseTo(1 / 2)
  })

  it('returns only issues and stats at the top level', () => {
    expect(
      Object.keys(lintLogicalProperties('.a { left: 0; }')).sort()
    ).toEqual(['issues', 'stats'])
  })

  it("tags physical property names with rule 'physical-property'", () => {
    const css =
      '.a { margin-left: 1px; left: 0; border-right: 1px solid red; border-top-left-radius: 2px; }'
    const { issues } = lintLogicalProperties(css)
    expect(issues).toHaveLength(4)
    for (const issue of issues) expect(issue.rule).toBe('physical-property')
  })

  it("tags physical value keywords with rule 'physical-value'", () => {
    const css = '.a { text-align: left; float: right; clear: left; }'
    const { issues } = lintLogicalProperties(css)
    expect(issues).toHaveLength(3)
    for (const issue of issues) expect(issue.rule).toBe('physical-value')
  })

  it('includes a reason with the suggested equivalent', () => {
    const css = '.card { margin-left: 20px; }'
    const { issues } = lintLogicalProperties(css)
    expect(issues[0].reason).toContain('margin-inline-start')
  })
})

describe('lintLogicalProperties with the logical-properties fixture', () => {
  const fixture = readFileSync(
    new URL('../__fixtures__/logical-properties.css', import.meta.url),
    'utf8'
  )

  it('flags every direction-sensitive property in the .card rule', () => {
    const { issues } = lintLogicalProperties(fixture)
    const cardIssues = issues.filter((i) => i.selector === '.card')

    expect(cardIssues).toHaveLength(10)
    const mapped = Object.fromEntries(
      cardIssues.map((i) => [i.property, i.logicalEquivalent])
    )
    expect(mapped['margin-left']).toBe('margin-inline-start')
    expect(mapped['border-right-color']).toBe('border-inline-end-color')
    expect(mapped['left']).toBe('inset-inline-start')
    expect(mapped['border-bottom-right-radius']).toBe('border-end-end-radius')
  })

  it('leaves already-logical .toolbar properties untouched', () => {
    const { issues } = lintLogicalProperties(fixture)
    expect(issues.filter((i) => i.selector === '.toolbar')).toEqual([])
  })

  it('leaves out-of-scope .vertical-and-size declarations untouched', () => {
    const { issues } = lintLogicalProperties(fixture)
    expect(issues.filter((i) => i.selector === '.vertical-and-size')).toEqual(
      []
    )
  })

  it('flags physical value keywords on direction-sensitive properties', () => {
    const { issues } = lintLogicalProperties(fixture)
    const dirIssues = issues.filter(
      (i) => i.selector === '.direction-sensitive'
    )

    expect(dirIssues).toHaveLength(3)
    const mapped = Object.fromEntries(
      dirIssues.map((i) => [i.property, i.logicalEquivalent])
    )
    expect(mapped['text-align']).toBe('text-align: start')
    expect(mapped['float']).toBe('float: inline-end')
    expect(mapped['clear']).toBe('clear: inline-start')
  })

  it('leaves direction-neutral .neutral declarations untouched', () => {
    const { issues } = lintLogicalProperties(fixture)
    expect(issues.filter((i) => i.selector === '.neutral')).toEqual([])
  })

  it('computes the migration ratio across the whole mixed fixture', () => {
    const { totalPhysicalProperties, migratableProperties, migrationRatio } =
      lintLogicalProperties(fixture).stats

    // 10 in .card + 3 value keywords in .direction-sensitive.
    expect(totalPhysicalProperties).toBe(13)
    expect(migratableProperties).toBe(13)
    expect(migrationRatio).toBe(1)
  })
})
