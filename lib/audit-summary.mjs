// Shared, dependency-free helpers for summarizing an AuditReport.
// Imported by the CLI (bin/mint-ds.mjs) and the web AuditView; keep it build-step free.

const MODERN_FEATURES = [
  { id: 'property', label: '@property' },
  { id: 'layer', label: '@layer' },
  { id: 'container', label: '@container' },
  { id: 'supports', label: '@supports' },
  { id: 'nesting', label: 'Nesting' },
  { id: 'color-mix', label: 'color-mix()' },
  { id: 'scope', label: '@scope' },
  { id: 'has', label: ':has()' },
]

const LINT_CATEGORIES = [
  {
    key: 'layoutA11yIssues',
    shortLabel: 'layout a11y',
    label: 'Layout accessibility',
  },
  {
    key: 'modernPracticeIssues',
    shortLabel: 'modern-practice',
    label: 'Modern best practices',
  },
  {
    key: 'adoptionSuggestions',
    shortLabel: 'adoption',
    label: 'Feature adoption',
  },
  {
    key: 'overflowSafetyIssues',
    shortLabel: 'overflow',
    label: 'Overflow & wrap safety',
  },
  {
    key: 'propertyTypeIssues',
    shortLabel: 'property types',
    label: '@property type safety',
  },
]

/**
 * Build a one-line summary of the CSS layout-linting findings in an audit.
 * Only non-empty categories are included; returns '' when there are none.
 */
export function formatLintSummary(audit) {
  if (!audit) return ''
  return LINT_CATEGORIES.map(({ key, shortLabel }) => {
    const count = audit[key]?.length ?? 0
    return count > 0 ? `${count} ${shortLabel}` : null
  })
    .filter(Boolean)
    .join(' · ')
}

/**
 * Group the CSS layout-linting findings for display. Returns one entry per
 * non-empty category ({ key, label, issues }) in a stable order; [] when none.
 */
export function collectLintGroups(audit) {
  if (!audit) return []
  const groups = []
  for (const { key, label } of LINT_CATEGORIES) {
    const issues = audit[key] ?? []
    if (issues.length > 0) groups.push({ key, label, issues })
  }
  return groups
}

/**
 * Normalize the `modernFeatures` object into a stable, display-ready list.
 * Returns one entry per feature ({ id, label, used, suggestion }) in a fixed
 * order; [] when the audit carries no modernFeatures data.
 */
export function collectModernFeatures(audit) {
  if (!audit?.modernFeatures) return []
  if (Object.keys(audit.modernFeatures).length === 0) return []
  return MODERN_FEATURES.map(({ id, label }) => {
    const status = audit.modernFeatures[id] ?? { used: false }
    return {
      id,
      label,
      used: Boolean(status.used),
      suggestion: status.suggestion,
    }
  })
}
