// Shared, dependency-free helpers for summarizing an AuditReport.
// Imported by the CLI (bin/mint-ds.mjs) and the web AuditView; keep it build-step free.

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
  {
    key: 'logicalProperties',
    shortLabel: 'logical',
    label: 'Logical properties',
    ratio: true,
  },
]

/**
 * Build a one-line summary of the CSS layout-linting findings in an audit.
 * Only non-empty categories are included; returns '' when there are none.
 */
export function formatLintSummary(audit) {
  if (!audit) return ''
  return LINT_CATEGORIES.map(({ key, shortLabel, ratio }) => {
    if (ratio) {
      const val = audit[key]
      if (!val || !val.issues || val.issues.length === 0) return null
      const pct = Math.round(val.migrationRatio * 100)
      return `${val.migratableProperties}/${val.totalPhysicalProperties} ${shortLabel} (${pct}%)`
    }
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
  for (const { key, label, ratio } of LINT_CATEGORIES) {
    const val = audit[key]
    if (!val) continue
    const issues = ratio ? (val.issues ?? []) : (val ?? [])
    if (issues.length > 0) groups.push({ key, label, issues })
  }
  return groups
}
