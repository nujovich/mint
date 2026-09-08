# BUILD-PLAN-issue-23 — CSS nesting depth and specificity anti-pattern audit

**Card:** https://github.com/nujovich/mint-radar/issues/23

**Decision:** PLAN defined 4 concrete code milestones.

## Milestones

- [ ] Milestone 1 — Add `NestingAudit` type to `lib/types.ts` with `maxDepth`, `specificityGrowth`, and `unnecessaryAmpersand` fields, plus a `nesting` field on `AuditReport`
- [ ] Milestone 2 — Implement a parser that walks nested selectors with `&`, measuring maximum depth and flagging unnecessary `&` (when the nested selector is already specific)
- [ ] Milestone 3 — Add a nesting complexity heatmap to the audit output with a configurable `--max-nesting-depth` threshold
- [ ] Milestone 4 — Add test fixtures and tests based on Piccalilli and Kilian Valkhof nesting pitfalls
