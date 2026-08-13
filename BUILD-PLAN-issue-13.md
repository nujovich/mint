# BUILD-PLAN-issue-13.md — Modern CSS feature adoption scan

**Card:** https://github.com/nujovich/mint-radar/issues/13

**Decision:** PLAN already defined 4 concrete code milestones (planned). Decision not required.

## Milestones

- [ ] Milestone 1 — Extend audit prompt in lib/prompts.mjs with STEP 14: modern CSS feature scan (detect @property, @layer, @container, @supports, nesting, color-mix, @scope, :has()), report presence/absence with adoption suggestions
- [ ] Milestone 2 — Add modernFeatures field to AuditReport type in lib/types.ts (Record<string, {used: boolean, suggestion?: string}>)
- [ ] Milestone 3 — Wire modern features results in playground UI as "Modern CSS Adoption" section
- [ ] Milestone 4 — Add test fixture with modern and legacy CSS and tests in lib/**tests**/
