import { describe, it, expect } from 'vitest'
import { formatLintSummary } from '../audit-summary.mjs'

describe('formatLintSummary', () => {
  it('returns empty string when no linting fields are present', () => {
    const audit = { brand: 'x', chaosScore: 3 }
    expect(formatLintSummary(audit)).toBe('')
  })

  it('returns empty string when all linting arrays are empty', () => {
    const audit = {
      layoutA11yIssues: [],
      modernPracticeIssues: [],
      adoptionSuggestions: [],
      overflowSafetyIssues: [],
    }
    expect(formatLintSummary(audit)).toBe('')
  })

  it('includes the layout a11y count when issues are present', () => {
    const audit = { layoutA11yIssues: [{}, {}] }
    expect(formatLintSummary(audit)).toBe('2 layout a11y')
  })

  it('omits zero-count categories and joins the rest with a middot', () => {
    const audit = {
      layoutA11yIssues: [{}],
      modernPracticeIssues: [],
      adoptionSuggestions: [{}, {}, {}],
      overflowSafetyIssues: [{}, {}],
    }
    expect(formatLintSummary(audit)).toBe(
      '1 layout a11y · 3 adoption · 2 overflow'
    )
  })

  it('labels all four categories in a stable order', () => {
    const audit = {
      layoutA11yIssues: [{}],
      modernPracticeIssues: [{}],
      adoptionSuggestions: [{}],
      overflowSafetyIssues: [{}],
    }
    expect(formatLintSummary(audit)).toBe(
      '1 layout a11y · 1 modern-practice · 1 adoption · 1 overflow'
    )
  })
})
