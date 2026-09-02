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
      propertyTypeIssues: [],
    }
    expect(formatLintSummary(audit)).toBe('')
  })

  it('includes the @property type count when issues are present', () => {
    const audit = { propertyTypeIssues: [{}, {}, {}] }
    expect(formatLintSummary(audit)).toBe('3 property types')
  })

  it('renders logical properties with migration ratio when issues are present', () => {
    const audit = {
      logicalProperties: {
        issues: [{ selector: '.a', property: 'left', logicalEquivalent: 'inset-inline-start' }],
        totalPhysicalProperties: 4,
        migratableProperties: 3,
        migrationRatio: 0.75,
      },
    }
    expect(formatLintSummary(audit)).toBe('3/4 logical (75%)')
  })

  it('returns empty for logicalProperties with no issues', () => {
    const audit = {
      logicalProperties: {
        issues: [],
        totalPhysicalProperties: 2,
        migratableProperties: 0,
        migrationRatio: 0,
      },
    }
    expect(formatLintSummary(audit)).toBe('')
  })

  it('returns empty when logicalProperties field is absent', () => {
    expect(formatLintSummary({ brand: 'x' })).toBe('')
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

  it('labels all five categories in a stable order', () => {
    const audit = {
      layoutA11yIssues: [{}],
      modernPracticeIssues: [{}],
      adoptionSuggestions: [{}],
      overflowSafetyIssues: [{}],
      propertyTypeIssues: [{}],
    }
    expect(formatLintSummary(audit)).toBe(
      '1 layout a11y · 1 modern-practice · 1 adoption · 1 overflow · 1 property types'
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
      propertyTypeIssues: [
        { selector: '.btn', reason: 'r', severity: 'warning' },
      ],
    }
    expect(collectLintGroups(audit).map((g) => g.key)).toEqual([
      'layoutA11yIssues',
      'adoptionSuggestions',
      'overflowSafetyIssues',
      'propertyTypeIssues',
    ])
  })

  it('labels the @property category for display', () => {
    const issue = {
      selector: '.button',
      property: 'background-color',
      rule: 'fallback-type-mismatch',
      severity: 'warning',
      reason: '`<color>` property has a `<length>` fallback',
      declaredSyntax: '<color>',
    }
    expect(collectLintGroups({ propertyTypeIssues: [issue] })).toEqual([
      {
        key: 'propertyTypeIssues',
        label: '@property type safety',
        issues: [issue],
      },
    ])
  })

  it('extracts issues from logicalProperties ratio-shaped audit field', () => {
    const issue = {
      selector: '.card',
      property: 'left',
      value: '0',
      logicalEquivalent: 'inset-inline-start',
    }
    const audit = {
      logicalProperties: {
        issues: [issue],
        totalPhysicalProperties: 3,
        migratableProperties: 2,
        migrationRatio: 0.67,
      },
    }
    expect(collectLintGroups(audit)).toEqual([
      {
        key: 'logicalProperties',
        label: 'Logical properties',
        issues: [issue],
      },
    ])
  })
})
