# BUILD-PLAN-issue-27.md

**Card:** https://github.com/nujovich/mint-radar/issues/27
**Title:** prefers-reduced-motion: gap de 4 anos sin resolver en stylelint

## Decision

PLAN (2026-07-10) defined 4 concrete code milestones. No further decision needed.

## Milestones

- [x] Milestone 1 -- Add `MotionAccessibilityAudit` type system detecting animation/transition declarations without a `@media (prefers-reduced-motion)` wrapper
- [x] Milestone 2 -- Implement parser identifying animation properties (`animation`, `transition`, `transform`) and verifying reduced-motion wrapping
- [x] Milestone 3 -- Add report with count of animations not respecting user motion preference and wrap suggestion
- [ ] Milestone 4 -- Add tests with the stylelint `prefers-reduced-motion` rule dataset
