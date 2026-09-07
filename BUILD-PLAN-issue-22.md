# BUILD-PLAN-issue-22.md — Unused CSS custom properties detection

**Card:** https://github.com/nujovich/mint-radar/issues/22

**Decision:** PLAN defined 4 milestones (deterministic dead-code analysis for CSS custom properties).

## Milestones

- [ ] Milestone 1 — Add `UnusedCustomPropertyIssue` and `UnusedCustomPropertiesAudit` types to lib/types.ts tracking defined (--*) vs referenced (var(--*)) custom properties, plus `unusedCustomProperties` field on AuditReport
- [ ] Milestone 2 — Implement `lintUnusedCustomProperties()` in lib/css-lint-rules.mjs: walk all --* declarations and var() references, emit the defined-but-unused diff with selectors and cleanup suggestions
- [ ] Milestone 3 — Wire the unused-properties report into bin/mint-ds.mjs CLI output with a dead-variable list and an optional --remove-unused flag
- [ ] Milestone 4 — Add a test fixture with a large Tailwind-style stylesheet (1000+ custom properties) and tests in lib/__tests__/
