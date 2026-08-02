# BUILD-PLAN-issue-10 — Stylelint 17.10: logical vs physical properties audit

**Card:** https://github.com/nujovich/mint-radar/issues/10

**Decision:** Planned (no Nadia override recorded — PLAN comment at 2026-06-16).

## Milestones

- [x] Milestone 1 — Extend audit prompt in lib/prompts.mjs with STEP 14: logical properties analysis (detect physical directional properties, suggest logical equivalents, compute logical-vs-physical ratio). Add LogicalPropertiesIssue + LogicalPropertiesAudit types to lib/types.ts and logicalProperties field to AuditReport.
- [ ] Milestone 2 — Wire logicalProperties results in playground UI (AuditView component)
- [ ] Milestone 3 — Wire logicalProperties in audit-summary.mjs (CLI summary line)
- [ ] Milestone 4 — Add test fixture with mixed logical/physical properties and tests in lib/**tests**/
