# BUILD-PLAN-issue-19.md

**Card:** https://github.com/nujovich/mint-radar/issues/19

**Title:** Logical properties migration: Stylelint 17.10 estandariza el enforcement de flow-relative CSS

**Plan reference:** 2026-07-10 PLAN comment (planned)

## Milestones

- [ ] Milestone 1 — Add `LogicalPropertyIssue`, `LogicalPropertyAudit`, and `PHYSICAL_TO_LOGICAL` mapping to `lib/types.ts`; add `logicalProperties` field to `AuditReport`
- [ ] Milestone 2 — Implement `lintLogicalProperties()` in `lib/css-lint-rules.mjs`: parse CSS, detect physical properties where flow-relative equivalents exist, emit issues with selectors and suggestions
- [ ] Milestone 3 — Wire `logicalProperties` into `bin/mint-ds.mjs` CLI output and `audit-summary.mjs` as a lint category with migration ratio display
- [ ] Milestone 4 — Add test fixture with mixed logical/physical CSS and tests referencing Stylelint 17.10 logical-properties rules