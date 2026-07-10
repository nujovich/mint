// Shared, dependency-free helpers for summarizing an AuditReport.
// Imported by the CLI (bin/mint-ds.mjs); keep it build-step free.

const LINT_CATEGORIES = [
  { key: 'layoutA11yIssues', label: 'layout a11y' },
  { key: 'modernPracticeIssues', label: 'modern-practice' },
  { key: 'adoptionSuggestions', label: 'adoption' },
  { key: 'overflowSafetyIssues', label: 'overflow' },
]

/**
 * Build a one-line summary of the CSS layout-linting findings in an audit.
 * Only non-empty categories are included; returns '' when there are none.
 */
export function formatLintSummary(audit) {
  if (!audit) return ''
  return LINT_CATEGORIES.map(({ key, label }) => {
    const count = audit[key]?.length ?? 0
    return count > 0 ? `${count} ${label}` : null
  })
    .filter(Boolean)
    .join(' · ')
}
