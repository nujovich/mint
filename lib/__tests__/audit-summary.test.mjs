import { describe, it, expect } from 'vitest'
import {
  formatLintSummary,
  collectLintGroups,
  collectModernFeatures,
} from '../audit-summary.mjs'

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
})

describe('collectModernFeatures', () => {
  it('returns an empty array when modernFeatures is absent', () => {
    expect(collectModernFeatures({ brand: 'x' })).toEqual([])
  })

  it('returns an empty array when modernFeatures is an empty object', () => {
    expect(collectModernFeatures({ modernFeatures: {} })).toEqual([])
  })

  it('returns all eight features in a stable order with labels', () => {
    const features = collectModernFeatures({
      modernFeatures: {
        property: { used: true },
        layer: { used: false },
        container: { used: false },
        supports: { used: true },
        nesting: { used: false },
        'color-mix': { used: false },
        scope: { used: false },
        has: { used: true },
      },
    })
    expect(features.map((f) => f.id)).toEqual([
      'property',
      'layer',
      'container',
      'supports',
      'nesting',
      'color-mix',
      'scope',
      'has',
    ])
    expect(features.map((f) => f.label)).toEqual([
      '@property',
      '@layer',
      '@container',
      '@supports',
      'Nesting',
      'color-mix()',
      '@scope',
      ':has()',
    ])
  })

  it('normalizes used to a boolean and carries suggestion only when not used', () => {
    const features = collectModernFeatures({
      modernFeatures: {
        property: { used: true, suggestion: 'should be ignored' },
        layer: {
          used: false,
          suggestion: 'Consider @layer to organize the cascade',
        },
      },
    })
    expect(features[0]).toEqual({
      id: 'property',
      label: '@property',
      used: true,
      suggestion: 'should be ignored',
    })
    expect(features[1]).toEqual({
      id: 'layer',
      label: '@layer',
      used: false,
      suggestion: 'Consider @layer to organize the cascade',
    })
  })

  it('defaults a missing feature entry to unused without a suggestion', () => {
    const features = collectModernFeatures({
      modernFeatures: { property: { used: true } },
    })
    const layer = features.find((f) => f.id === 'layer')
    expect(layer).toEqual({
      id: 'layer',
      label: '@layer',
      used: false,
      suggestion: undefined,
    })
  })
})
