import { describe, it, expect } from 'vitest'
import { formatLintSummary, collectLintGroups } from '../audit-summary.mjs'

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

describe('collectLintGroups', () => {
  it('returns an empty array when no linting fields are present', () => {
    expect(collectLintGroups({ brand: 'x' })).toEqual([])
  })

  it('returns an empty array when every category is empty', () => {
    const audit = {
      layoutA11yIssues: [],
      modernPracticeIssues: [],
      adoptionSuggestions: [],
      overflowSafetyIssues: [],
    }
    expect(collectLintGroups(audit)).toEqual([])
  })

  it('returns a labeled group carrying the raw issues for a category', () => {
    const issue = {
      selector: '.nav-item',
      property: 'order',
      value: '-1',
      reason: 'Visual order differs from DOM order',
      severity: 'warning',
    }
    const groups = collectLintGroups({ layoutA11yIssues: [issue] })
    expect(groups).toEqual([
      {
        key: 'layoutA11yIssues',
        label: 'Layout accessibility',
        issues: [issue],
      },
    ])
  })

  it('includes only non-empty categories, in a stable order', () => {
    const audit = {
      overflowSafetyIssues: [
        { selector: '.nav', reason: 'r', severity: 'warning' },
      ],
      layoutA11yIssues: [{ selector: '.a', reason: 'r', severity: 'warning' }],
      modernPracticeIssues: [],
      adoptionSuggestions: [{ selector: '', reason: 'r', severity: 'info' }],
    }
    expect(collectLintGroups(audit).map((g) => g.key)).toEqual([
      'layoutA11yIssues',
      'adoptionSuggestions',
      'overflowSafetyIssues',
    ])
  })
})
