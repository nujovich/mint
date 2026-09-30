import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  computeMetrics,
  calculateSpecificity,
  computeWeightedScore,
  mergeWeights,
  DEFAULT_WEIGHTS,
  benchmarkAgainstWallace,
  valuePercentile,
  WALLACE_2026,
  buildHealthReport,
  renderHealthReport,
  METRIC_LABELS,
  DEFAULT_SEVERITY_THRESHOLDS,
  severityFor,
  lintComplexityMetrics,
  DEFAULT_COMPLEXITY_THRESHOLDS,
  buildComplexityReport,
  renderComplexityReport,
  renderComplexityMarkdown,
} from '../css-health-score.mjs'

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

describe('configurable weighting (M2)', () => {
  it('exposes DEFAULT_WEIGHTS that sum to 1', () => {
    const total = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('gives a healthy stylesheet a high score with default weights', () => {
    const css = `
      @layer base {
        a { color: blue; }
        p { margin: 0; }
      }
    `
    const metrics = computeMetrics(css)
    const score = computeWeightedScore(metrics)
    expect(score).toBeGreaterThan(80)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('penalizes pathological CSS with a low score', () => {
    const css = `
      #app #main #nav .item.item.item {
        color: red !important;
        font-size: 12px !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
      }
    `
    const metrics = computeMetrics(css)
    const score = computeWeightedScore(metrics)
    expect(score).toBeLessThan(50)
  })

  it('honors custom weight overrides that rebalance the score', () => {
    const css = `
      .widget { color: red !important; background: blue !important; }
    `
    const metrics = computeMetrics(css)
    const importantHeavy = computeWeightedScore(metrics, {
      importantRatio: 0.9,
    })
    const importantLight = computeWeightedScore(metrics, {
      importantRatio: 0.05,
      selectorsPerRule: 0.45,
      declarationsPerRule: 0.45,
      avgSpecificity: 0.05,
    })
    // Shifting weight onto importantRatio must lower the score for this
    // !important-heavy stylesheet.
    expect(importantHeavy).toBeLessThan(importantLight)
  })

  it('mergeWeights fills missing keys from defaults and drops junk', () => {
    const merged = mergeWeights({
      avgSpecificity: 0.5,
      bogus: 9,
      selectorsPerRule: -1,
    })
    expect(merged.avgSpecificity).toBe(0.5)
    expect(merged.bogus).toBeUndefined()
    expect(merged.selectorsPerRule).toBe(DEFAULT_WEIGHTS.selectorsPerRule)
    expect(merged.layerAdoption).toBe(DEFAULT_WEIGHTS.layerAdoption)
  })

  it('respects inverted layerAdoption (higher is healthier)', () => {
    const low = computeWeightedScore({ layerAdoption: 0.0 })
    const high = computeWeightedScore({ layerAdoption: 0.6 })
    expect(high).toBeGreaterThan(low)
  })
})

describe('benchmark against Project Wallace 2026 (M3)', () => {
  it('exposes WALLACE_2026 percentile anchors for every metric', () => {
    const metrics = [
      'selectorsPerRule',
      'declarationsPerRule',
      'importantRatio',
      'avgSpecificity',
      'layerAdoption',
    ]
    for (const m of metrics) {
      expect(WALLACE_2026[m]).toBeDefined()
      const d = WALLACE_2026[m]
      expect(d.p25).toBeLessThanOrEqual(d.p50)
      expect(d.p50).toBeLessThanOrEqual(d.p75)
      expect(d.p75).toBeLessThanOrEqual(d.p90)
      expect(d.p90).toBeLessThanOrEqual(d.p99)
      expect(typeof d.lowerIsHealthier).toBe('boolean')
    }
  })

  it('valuePercentile clamps below the lowest anchor to 0 and above to 100', () => {
    expect(valuePercentile(-5, WALLACE_2026.avgSpecificity)).toBe(0)
    expect(valuePercentile(100000, WALLACE_2026.avgSpecificity)).toBe(100)
    // At the median anchor the raw percentile is exactly 50
    expect(valuePercentile(30, WALLACE_2026.avgSpecificity)).toBe(50)
  })

  it('valuePercentile interpolates linearly between anchors', () => {
    // p25=12, p50=30 -> value 21 (midpoint) -> ~37.5
    expect(valuePercentile(21, WALLACE_2026.avgSpecificity)).toBeCloseTo(
      37.5,
      1
    )
  })

  it('scores a tidy stylesheet as healthier than most real-world CSS', () => {
    const css = `
      @layer base {
        a { color: blue; }
        p { margin: 0; }
      }
      @layer components {
        .card { padding: 1rem; }
      }
    `
    const metrics = computeMetrics(css)
    const result = benchmarkAgainstWallace(metrics)
    expect(result.overallPercentile).toBeGreaterThan(75)
    expect(result.summary).toMatch(/Project Wallace 2026/)
    // Every metric should carry a verdict
    for (const m of Object.keys(WALLACE_2026)) {
      expect(result.metrics[m].verdict).toBeDefined()
      expect(result.metrics[m].healthPercentile).toBeGreaterThanOrEqual(0)
      expect(result.metrics[m].healthPercentile).toBeLessThanOrEqual(100)
    }
  })

  it('scores pathological CSS as worse than the median', () => {
    const css = `
      #app #main #nav .item.item.item {
        color: red !important;
        font-size: 12px !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
      }
    `
    const metrics = computeMetrics(css)
    const result = benchmarkAgainstWallace(metrics)
    expect(result.overallPercentile).toBeLessThan(50)
    expect(result.metrics.importantRatio.verdict).toBe('worse')
    expect(result.metrics.avgSpecificity.verdict).toBe('worse')
  })

  it('inverts layerAdoption so higher adoption is healthier', () => {
    const low = benchmarkAgainstWallace({ layerAdoption: 0.0 })
    const high = benchmarkAgainstWallace({ layerAdoption: 0.6 })
    expect(high.metrics.layerAdoption.healthPercentile).toBeGreaterThan(
      low.metrics.layerAdoption.healthPercentile
    )
  })

  it('honors a caller-supplied benchmark distribution', () => {
    const custom = {
      avgSpecificity: {
        p25: 5,
        p50: 10,
        p75: 20,
        p90: 40,
        p99: 80,
        lowerIsHealthier: true,
      },
    }
    const result = benchmarkAgainstWallace({ avgSpecificity: 10 }, custom)
    expect(result.metrics.avgSpecificity.healthPercentile).toBe(50)
  })
})

describe('CLI health-score report (M4)', () => {
  it('builds a report with a 0-100 score and one row per metric', () => {
    const css = `
      @layer base {
        a { color: blue; }
        p { margin: 0; }
      }
      @layer components {
        .card { padding: 1rem; }
      }
    `
    const metrics = computeMetrics(css)
    const report = buildHealthReport(metrics)
    expect(report.score).toBeGreaterThan(0)
    expect(report.score).toBeLessThanOrEqual(100)
    expect(report.metrics).toHaveLength(Object.keys(METRIC_LABELS).length)
    // Every row carries a value, a health percentile, and a verdict.
    for (const m of report.metrics) {
      expect(m.label).toBeTruthy()
      expect(typeof m.value).toBe('string')
      expect(m.healthPercentile).toBeGreaterThanOrEqual(0)
      expect(m.healthPercentile).toBeLessThanOrEqual(100)
      expect(['better', 'typical', 'worse']).toContain(m.verdict)
    }
  })

  it('lowers the score and flags worse for pathological CSS', () => {
    const css = `
      #app #main #nav .item.item.item {
        color: red !important;
        font-size: 12px !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
      }
    `
    const metrics = computeMetrics(css)
    const report = buildHealthReport(metrics)
    expect(report.score).toBeLessThan(50)
    expect(report.benchmark.overallPercentile).toBeLessThan(50)
    expect(report.metrics.find((m) => m.key === 'importantRatio').verdict).toBe(
      'worse'
    )
  })

  it('exposes the Project Wallace summary in the report', () => {
    const css = '.a { color: red; }'
    const report = buildHealthReport(computeMetrics(css))
    expect(report.benchmark.summary).toMatch(/Project Wallace 2026/)
  })

  it('renders a plain-text report containing the score and every metric label', () => {
    const css = `
      @layer base {
        a { color: blue; }
        p { margin: 0; }
      }
    `
    const text = renderHealthReport(computeMetrics(css))
    expect(text).toMatch(/CSS Health Score: \d+\/100/)
    for (const label of Object.values(METRIC_LABELS)) {
      expect(text).toContain(label)
    }
    expect(text).toContain('Per-metric breakdown:')
  })

  it('formats ratios as percentages in the rendering', () => {
    const css = '.a.w { color: red !important; }'
    const text = renderHealthReport(computeMetrics(css))
    expect(text).toMatch(/!important ratio: 100\.0%/)
  })
})

describe('configurable warning/error thresholds (M5)', () => {
  it('exposes DEFAULT_SEVERITY_THRESHOLDS seeded from Wallace verdicts', () => {
    expect(DEFAULT_SEVERITY_THRESHOLDS.error).toBe(25)
    expect(DEFAULT_SEVERITY_THRESHOLDS.warning).toBe(50)
  })

  it('severityFor classifies by health percentile (ok/warning/error)', () => {
    expect(severityFor(90)).toBe('ok')
    expect(severityFor(50)).toBe('warning')
    expect(severityFor(25)).toBe('error')
    expect(severityFor(10)).toBe('error')
  })

  it('severityFor honors caller overrides', () => {
    // hp=40, error=20, warning=30 -> above warning bound -> ok
    expect(severityFor(40, { error: 20, warning: 30 })).toBe('ok')
    // hp=40, error=20, warning=60 -> above error, within warning -> warning
    expect(severityFor(40, { error: 20, warning: 60 })).toBe('warning')
    // hp=40, error=50, warning=90 -> at/below error bound -> error
    expect(severityFor(40, { error: 50, warning: 90 })).toBe('error')
    // hp=20, error=25, warning=50 -> at/below error bound -> error
    expect(severityFor(20, { error: 25, warning: 50 })).toBe('error')
  })

  it('flags pathological CSS as error with default thresholds', () => {
    const css = `
      #app #main #nav .item.item.item {
        color: red !important;
        font-size: 12px !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
      }
    `
    const report = buildHealthReport(computeMetrics(css))
    expect(report.status).toBe('error')
    expect(report.exitCode).toBe(2)
    // The !important-heavy, ID-nested stylesheet trips error on specificity,
    // important ratio, and layer adoption at minimum.
    expect(report.errors).toBeGreaterThanOrEqual(3)
    // Every row carries a severity field.
    for (const m of report.metrics) {
      expect(['ok', 'warning', 'error']).toContain(m.severity)
    }
  })

  it('reports ok status for tidy layered CSS and exit code 0', () => {
    const css = `
      @layer base {
        a { color: blue; }
        p { margin: 0; }
      }
      @layer components {
        .card { padding: 1rem; }
      }
    `
    const report = buildHealthReport(computeMetrics(css))
    expect(report.status).toBe('ok')
    expect(report.exitCode).toBe(0)
    expect(report.errors).toBe(0)
    expect(report.warnings).toBe(0)
  })

  it('tighter thresholds never improve a report status', () => {
    // Raising the thresholds can only make a stylesheet look worse, never
    // better: the per-metric severity is a non-decreasing function of the
    // bounds, so the aggregate status can only move ok -> warning -> error.
    const css = `
      @layer base {
        a { color: blue; }
        p { margin: 0; }
      }
      @layer components {
        .card { padding: 1rem; }
      }
    `
    const rank = { ok: 0, warning: 1, error: 2 }
    const loose = buildHealthReport(computeMetrics(css))
    const tight = buildHealthReport(computeMetrics(css), {
      error: 90,
      warning: 99,
    })
    expect(rank[tight.status]).toBeGreaterThanOrEqual(rank[loose.status])
  })

  it('renderHealthReport shows per-metric severity and a status line', () => {
    const css = `
      #app #main #nav .item.item.item {
        color: red !important;
        font-size: 12px !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
      }
    `
    const text = renderHealthReport(computeMetrics(css))
    // Each per-metric row carries its severity after the verdict.
    expect(text).toMatch(/\(worse, error\)/)
    expect(text).toMatch(/Status: ERROR/)
  })
})

describe('lintComplexityMetrics (CI complexity)', () => {
  it('returns zero metrics for empty CSS', () => {
    const { metrics } = lintComplexityMetrics('')
    expect(metrics.selectorCount).toBe(0)
    expect(metrics.declarationCount).toBe(0)
    expect(metrics.avgSpecificity).toBe(0)
    expect(metrics.importDepth).toBe(0)
    expect(metrics.nestingDepth).toBe(0)
    expect(metrics.chaosScore).toBeGreaterThanOrEqual(0)
    expect(metrics.chaosScore).toBeLessThanOrEqual(10)
  })

  it('counts selectors, declarations, and specificity for a simple rule', () => {
    const { metrics } = lintComplexityMetrics(
      'body { color: red; font-size: 16px; }'
    )
    expect(metrics.selectorCount).toBe(1)
    expect(metrics.declarationCount).toBe(2)
    expect(metrics.avgSpecificity).toBe(1) // body = element = 1
    expect(metrics.importDepth).toBe(0)
    expect(metrics.nestingDepth).toBe(1)
  })

  it('counts each selector in a comma-separated list', () => {
    const { metrics } = lintComplexityMetrics('.a, .b, .c { color: red; }')
    expect(metrics.selectorCount).toBe(3)
  })

  it('averages specificity across all selectors', () => {
    const css =
      '#header { color: red; } .nav { color: blue; } body { color: green; }'
    const { metrics } = lintComplexityMetrics(css)
    // Specificities 100, 10, 1 -> average 37.
    expect(metrics.avgSpecificity).toBe(37)
  })

  it('reports import depth 1 for a top-level @import', () => {
    const { metrics } = lintComplexityMetrics(
      '@import url("x.css"); .a { color: red; }'
    )
    expect(metrics.importDepth).toBe(1)
    expect(metrics.selectorCount).toBe(1)
  })

  it('reports import depth 2 for an @import nested in an at-rule', () => {
    const css =
      '@media (min-width: 1px) { @import url("x.css"); .a { color: red; } }'
    const { metrics } = lintComplexityMetrics(css)
    expect(metrics.importDepth).toBe(2)
  })

  it('measures structural nesting depth for rules inside at-rules', () => {
    const css = '@media (min-width: 1px) { .a { color: red; } }'
    const { metrics } = lintComplexityMetrics(css)
    expect(metrics.nestingDepth).toBe(2)
  })

  it('measures selector nesting depth for native CSS nesting', () => {
    const css = '.a { .b { color: red; } }'
    const { metrics } = lintComplexityMetrics(css)
    expect(metrics.nestingDepth).toBe(2)
  })

  it('ignores @import and braces inside strings', () => {
    const css = '.a { content: "@import { }"; }'
    const { metrics } = lintComplexityMetrics(css)
    expect(metrics.importDepth).toBe(0)
    expect(metrics.nestingDepth).toBe(1)
  })

  it('exposes a deterministic 0-10 chaos score', () => {
    const { metrics } = lintComplexityMetrics('.a { color: red; }')
    expect(metrics.chaosScore).toBeGreaterThanOrEqual(0)
    expect(metrics.chaosScore).toBeLessThanOrEqual(10)
  })

  it('does not exceed thresholds for a small stylesheet', () => {
    const { exceeded } = lintComplexityMetrics('.a { color: red; }')
    expect(exceeded.maxSelectors).toBe(false)
    expect(exceeded.maxSpecificity).toBe(false)
  })

  it('flags exceeded thresholds with custom bounds', () => {
    const css = '#a #b #c { color: red; }' // avgSpecificity = 300
    const r = lintComplexityMetrics(css, {
      maxSelectors: 0,
      maxSpecificity: 200,
    })
    expect(r.exceeded.maxSelectors).toBe(true) // 1 selector > 0
    expect(r.exceeded.maxSpecificity).toBe(true) // 300 > 200
  })

  it('exposes default thresholds', () => {
    expect(DEFAULT_COMPLEXITY_THRESHOLDS.maxSelectors).toBe(1000)
    expect(DEFAULT_COMPLEXITY_THRESHOLDS.maxSpecificity).toBe(200)
  })
})

describe('buildComplexityReport (CI complexity report)', () => {
  it('reports pass and exitCode 0 when thresholds are met', () => {
    const report = buildComplexityReport('.a { color: red; }')
    expect(report.status).toBe('pass')
    expect(report.exitCode).toBe(0)
    expect(report.exceeded.maxSelectors).toBe(false)
    expect(report.exceeded.maxSpecificity).toBe(false)
  })

  it('reports fail and exitCode 1 when a threshold is exceeded', () => {
    const report = buildComplexityReport('#a #b #c { color: red; }', {
      maxSelectors: 0,
      maxSpecificity: 200,
    })
    expect(report.status).toBe('fail')
    expect(report.exitCode).toBe(1)
    expect(report.exceeded.maxSelectors).toBe(true)
    expect(report.exceeded.maxSpecificity).toBe(true)
  })

  it('carries metrics and effective thresholds through to the report', () => {
    const report = buildComplexityReport('.a, .b { color: red; }')
    expect(report.metrics.selectorCount).toBe(2)
    expect(report.thresholds.maxSelectors).toBe(1000)
    expect(report.thresholds.maxSpecificity).toBe(200)
  })
})

describe('renderComplexityReport', () => {
  it('prints a PASS status line for a clean stylesheet', () => {
    const text = renderComplexityReport(
      buildComplexityReport('.a { color: red; }')
    )
    expect(text).toContain('CSS Complexity Metrics:')
    expect(text).toContain('Status: PASS')
  })

  it('prints a FAIL status line when a threshold is exceeded', () => {
    const text = renderComplexityReport(
      buildComplexityReport('#a #b #c { color: red; }', {
        maxSelectors: 0,
        maxSpecificity: 200,
      })
    )
    expect(text).toContain('Status: FAIL')
    expect(text).toContain('(exceeded)')
  })
})

describe('renderComplexityMarkdown', () => {
  it('renders a Markdown table with every metric row', () => {
    const md = renderComplexityMarkdown(
      buildComplexityReport('.a { color: red; }')
    )
    expect(md).toContain('## CSS Complexity Metrics')
    expect(md).toContain('| Metric | Value | Threshold | Status |')
    expect(md).toContain('| Selectors |')
    expect(md).toContain('| Avg specificity |')
    expect(md).toContain('**Status:** PASS')
  })

  it('marks exceeded thresholds and a FAIL status', () => {
    const md = renderComplexityMarkdown(
      buildComplexityReport('#a #b #c { color: red; }', {
        maxSelectors: 0,
        maxSpecificity: 200,
      })
    )
    expect(md).toContain('| exceeded |')
    expect(md).toContain('**Status:** FAIL')
  })
})

describe('complexity reference benchmark (M4)', () => {
  const css = readFileSync(
    new URL('../__fixtures__/complexity-reference.css', import.meta.url),
    'utf8'
  )
  const reference = JSON.parse(
    readFileSync(
      new URL('../__fixtures__/complexity-reference.json', import.meta.url),
      'utf8'
    )
  )

  it('loads a reference dataset with a cssFile and expected metrics', () => {
    expect(reference.cssFile).toBe('complexity-reference.css')
    expect(reference.expected).toBeDefined()
    expect(typeof reference.expected.selectorCount).toBe('number')
  })

  it('matches the reference selector and declaration counts', () => {
    const { metrics } = lintComplexityMetrics(css)
    expect(metrics.selectorCount).toBe(reference.expected.selectorCount)
    expect(metrics.declarationCount).toBe(reference.expected.declarationCount)
  })

  it('matches the reference average specificity', () => {
    const { metrics } = lintComplexityMetrics(css)
    expect(metrics.avgSpecificity).toBeCloseTo(
      reference.expected.avgSpecificity,
      5
    )
  })

  it('matches the reference import and nesting depths', () => {
    const { metrics } = lintComplexityMetrics(css)
    expect(metrics.importDepth).toBe(reference.expected.importDepth)
    expect(metrics.nestingDepth).toBe(reference.expected.nestingDepth)
  })

  it('matches the reference chaos score', () => {
    const { metrics } = lintComplexityMetrics(css)
    expect(metrics.chaosScore).toBeCloseTo(reference.expected.chaosScore, 5)
    expect(metrics.chaosScore).toBeGreaterThanOrEqual(0)
    expect(metrics.chaosScore).toBeLessThanOrEqual(10)
  })
})
