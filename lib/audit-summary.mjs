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
