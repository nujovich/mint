# BUILD-PLAN-issue-31.md

**Card:** https://github.com/nujovich/mint-radar/issues/31
**Title:** Scroll-driven animations: nueva API CSS sin cobertura de linting

## Decision

PLAN (2026-07-10) defined 4 concrete code milestones. No further decision needed.

## Milestones

- [ ] Milestone 1 -- Add `ScrollDrivenAnimationAudit` type system detecting `animation-timeline: scroll()` and `view()`
- [ ] Milestone 2 -- Implement parser that identifies scroll-driven animation usage and verifies fallbacks for unsupported browsers
- [ ] Milestone 3 -- Add scroll-driven animation coverage report with warnings about properties without fallback
- [ ] Milestone 4 -- Add tests with examples from the CSS Scroll-driven Animations Level 1 spec
