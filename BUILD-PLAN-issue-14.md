# BUILD-PLAN-issue-14.md — CSS layout anti-pattern detection

**Card:** https://github.com/nujovich/mint-radar/issues/14

**Decision:** PLAN defined 4 concrete code milestones (no decision pending).

## Milestones

- [ ] Milestone 1 — Extend audit prompt in lib/prompts.mjs with a layout health step (STEP 14): detect nested grid containers without subgrid and flex items at overflow risk (fixed flex-basis). Visual reorder vs DOM order is already reported by STEP 9, so it is not duplicated here.
- [ ] Milestone 2 — Add layoutWarnings field to AuditReport type in lib/types.ts (array of {pattern, element, severity, suggestion})
- [ ] Milestone 3 — Wire layout warnings in playground UI as layout health alerts
- [ ] Milestone 4 — Add test fixture with problematic layout patterns and tests in lib/**tests**/
