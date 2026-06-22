import { describe, it, expect } from 'vitest'
import { computeMetrics, calculateSpecificity } from '../css-health-score.mjs'

describe('calculateSpecificity', () => {
  it('returns 0 for empty selector', () => {
    expect(calculateSpecificity('')).toBe(0)
  })

  it('counts element selectors as 1 each', () => {
    expect(calculateSpecificity('div')).toBe(1)
    expect(calculateSpecificity('body')).toBe(1)
    expect(calculateSpecificity('span')).toBe(1)
  })

  it('counts class selectors as 10 each', () => {
    expect(calculateSpecificity('.foo')).toBe(10)
    expect(calculateSpecificity('.foo.bar')).toBe(20)
  })

  it('counts ID selectors as 100 each', () => {
    expect(calculateSpecificity('#main')).toBe(100)
    expect(calculateSpecificity('#header #nav')).toBe(200)
  })

  it('counts attribute selectors as 10 each', () => {
    expect(calculateSpecificity('[type="text"]')).toBe(10)
    expect(calculateSpecificity('[data-x]')).toBe(10)
  })

  it('counts pseudo-classes as 10 each', () => {
    expect(calculateSpecificity(':hover')).toBe(10)
    expect(calculateSpecificity(':nth-child(2)')).toBe(10)
  })

  it('ignores pseudo-elements in specificity', () => {
    // ::before and ::after match like elements but shouldn't double-count
    const base = calculateSpecificity('div')
    const withBefore = calculateSpecificity('div::before')
    expect(withBefore).toBe(base)
  })

  it('combines selector types correctly', () => {
    // #header .nav li:hover -> 1 ID (100) + 1 class (10) + 1 pseudo-class (10) + 1 element (1) = 121
    expect(calculateSpecificity('#header .nav li:hover')).toBe(121)
  })

  it('counts universal selector as 1', () => {
    expect(calculateSpecificity('*')).toBe(1)
    expect(calculateSpecificity('div *')).toBe(2)
  })

  it('handles combinators correctly', () => {
    expect(calculateSpecificity('div > span')).toBe(2)
    expect(calculateSpecificity('div + span')).toBe(2)
    expect(calculateSpecificity('div ~ span')).toBe(2)
  })

  it('handles comma-separated selectors as a single selector string', () => {
    // The function receives one selector at a time — comma lists are split upstream
    const result = calculateSpecificity('.a, .b')
    // "a, .b" is treated as one selector string; comma is not special here
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThan(0)
  })
})

describe('computeMetrics', () => {
  it('returns zero metrics for empty CSS', () => {
    const m = computeMetrics('')
    expect(m.selectorsPerRule).toBe(0)
    expect(m.declarationsPerRule).toBe(0)
    expect(m.importantRatio).toBe(0)
    expect(m.avgSpecificity).toBe(0)
    expect(m.layerAdoption).toBe(0)
  })

  it('computes basic metrics for a single rule', () => {
    const css = 'body { color: red; font-size: 16px; }'
    const m = computeMetrics(css)
    expect(m.selectorsPerRule).toBe(1)
    expect(m.declarationsPerRule).toBe(2)
    expect(m.importantRatio).toBe(0)
    expect(m.avgSpecificity).toBe(1) // "body" = element = 1
    expect(m.layerAdoption).toBe(0)
  })

  it('computes selectors per rule for multiple rules', () => {
    const css = `
      .a, .b { color: red; }
      .c { margin: 0; }
    `
    const m = computeMetrics(css)
    expect(m.selectorsPerRule).toBe(1.5) // 3 selectors / 2 rules
  })

  it('computes declarations per rule', () => {
    const css = `
      .a { color: red; margin: 0; padding: 0; }
      .b { color: blue; }
    `
    const m = computeMetrics(css)
    expect(m.declarationsPerRule).toBe(2) // 4 declarations / 2 rules
  })

  it('computes !important ratio', () => {
    const css = `
      .a { color: red !important; margin: 0; }
      .b { color: blue; }
      .c { padding: 0; }
    `
    const m = computeMetrics(css)
    // 1 important out of 4 total declarations = 0.25
    expect(m.importantRatio).toBe(0.25)
  })

  it('computes average specificity', () => {
    const css = `
      #header { color: red; }
      .nav { color: blue; }
      body { color: green; }
    `
    const m = computeMetrics(css)
    // Specificities: 100, 10, 1 -> average = 37
    expect(m.avgSpecificity).toBe(37)
  })

  it('computes layer adoption', () => {
    const css = `
      @layer base {
        body { color: red; }
      }
      .extra { margin: 0; }
    `
    const m = computeMetrics(css)
    // 1 rule in layer, 1 outside = 0.5
    expect(m.layerAdoption).toBe(0.5)
  })

  it('handles CSS with no rules', () => {
    const css = '@import url("other.css");'
    const m = computeMetrics(css)
    expect(m.selectorsPerRule).toBe(0)
    expect(m.declarationsPerRule).toBe(0)
  })

  it('handles CSS with comment blocks', () => {
    const css = `
      /* This is a comment with { curly } braces */
      .a { color: red; }
      /* Another comment */
      .b { color: blue; }
    `
    const m = computeMetrics(css)
    expect(m.selectorsPerRule).toBe(1)
    expect(m.declarationsPerRule).toBe(1)
  })

  it('handles nested @layer with named layers', () => {
    const css = `
      @layer base {
        body { color: red; }
        h1 { font-size: 2em; }
      }
      @layer components {
        .card { padding: 1rem; }
      }
    `
    const m = computeMetrics(css)
    // 3 rules total, 3 in layers = 1.0
    expect(m.layerAdoption).toBe(1)
  })

  it('handles @media queries (rules inside are counted, not the media wrapper)', () => {
    const css = `
      @media (max-width: 600px) {
        .a { color: red; }
      }
      .b { color: blue; }
    `
    const m = computeMetrics(css)
    // .a and .b are both rules; @media is not a rule itself
    expect(m.selectorsPerRule).toBe(1)
  })

  it('handles selector lists with nested parens', () => {
    const css = `
      .a, :is(.b, .c), .d { color: red; }
    `
    const m = computeMetrics(css)
    // 3 selectors: ".a", ":is(.b, .c)", ".d"
    expect(m.selectorsPerRule).toBe(3)
  })

  it('all values are numbers', () => {
    const css = 'body { color: red; }'
    const m = computeMetrics(css)
    expect(typeof m.selectorsPerRule).toBe('number')
    expect(typeof m.declarationsPerRule).toBe('number')
    expect(typeof m.importantRatio).toBe('number')
    expect(typeof m.avgSpecificity).toBe('number')
    expect(typeof m.layerAdoption).toBe('number')
  })

  it('handles CSS with only vendor-prefixed declarations', () => {
    const css = `
      .box {
        -webkit-transform: rotate(10deg);
        -moz-transform: rotate(10deg);
        transform: rotate(10deg);
      }
    `
    const m = computeMetrics(css)
    expect(m.declarationsPerRule).toBe(3)
  })
})
