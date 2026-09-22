import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { lintDeadCss } from '../css-lint-rules.mjs'

const css = readFileSync(
  new URL('../__fixtures__/dead-css-reference.css', import.meta.url),
  'utf8'
)

const reference = JSON.parse(
  readFileSync(
    new URL('../__fixtures__/dead-css-reference.json', import.meta.url),
    'utf8'
  )
)

function findingKey(finding) {
  return `${finding.rule}|${finding.selector}|${finding.property || ''}`
}

function countByKey(findings) {
  const counts = new Map()
  for (const finding of findings) {
    const key = findingKey(finding)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return counts
}

function flattenFindings(audit) {
  return [
    ...audit.overriddenDeclarations,
    ...audit.zeroSpecificitySelectors,
    ...audit.duplicateSelectors,
  ]
}

function evaluate(audit, manifest) {
  const findings = flattenFindings(audit)
  const found = countByKey(findings)
  const totalFindings = findings.length

  let truePositives = 0
  let expectedPositives = 0

  for (const pattern of manifest.deadPatterns) {
    const key = `${pattern.rule}|${pattern.selector}|${pattern.property || ''}`
    const expectedCount = pattern.count || 1
    expectedPositives += expectedCount
    const foundCount = found.get(key) || 0
    truePositives += Math.min(foundCount, expectedCount)
  }

  const falsePositives = totalFindings - truePositives
  const falseNegatives = expectedPositives - truePositives
  const precision = totalFindings === 0 ? 0 : truePositives / totalFindings
  const recall = expectedPositives === 0 ? 0 : truePositives / expectedPositives

  return {
    totalFindings,
    expectedPositives,
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
  }
}

describe('dead CSS benchmark against the real-world reference dataset', () => {
  it('detects every ground-truth dead pattern (recall)', () => {
    const audit = lintDeadCss(css)
    const metrics = evaluate(audit, reference)

    expect(metrics.falseNegatives).toBe(0)
    expect(metrics.recall).toBe(1)
  })

  it('keeps precision above the documented threshold', () => {
    const audit = lintDeadCss(css)
    const metrics = evaluate(audit, reference)

    // The only expected false positive is the universal box-sizing reset.
    expect(metrics.falsePositives).toBe(1)
    expect(metrics.precision).toBe(
      metrics.truePositives / metrics.totalFindings
    )
    expect(metrics.precision).toBeGreaterThanOrEqual(0.75)
  })

  it('attributes the sole false positive to the universal reset', () => {
    const audit = lintDeadCss(css)
    const findings = flattenFindings(audit)
    const known = reference.knownFalsePositives[0]

    const matched = findings.filter((finding) => {
      const key = findingKey(finding)
      const expectedKey = `${known.rule}|${known.selector}|${known.property || ''}`
      return key === expectedKey
    })

    expect(matched).toHaveLength(known.count || 1)
    expect(matched[0].selector).toBe('*')
    expect(matched[0].rule).toBe('zero-specificity')
  })
})
