# BUILD-PLAN-issue-29.md — Static dead CSS detection

**Card:** https://github.com/nujovich/mint-radar/issues/29

**Decision:** Nadia chose Option B (static approximation, no browser).

## Milestones

- [ ] Milestone 1 — Add `DeadCssIssue` / `DeadCssAudit` types to lib/types.ts and a `lintDeadCss()` scanner in lib/css-lint-rules.mjs that detects overridden declarations, zero-specificity selectors, and duplicate selectors, with unit tests
- [ ] Milestone 2 — Add `mint-ds audit --dead-css` flag wiring the heuristics into the audit command with a dead-CSS report
- [ ] Milestone 3 — Add a benchmark fixture comparing the static heuristics against a real-world reference dataset to validate precision
