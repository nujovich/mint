# BUILD-PLAN — Card #32

**Card:** https://github.com/nujovich/mint-radar/issues/32
**Title:** CSS complexity metrics for CI
**Repo:** nujovich/mint

## Milestones

- [ ] Milestone 1 — Add `ComplexityMetrics` type to `lib/types.ts` with `selectorCount`, `avgSpecificity`, `declarationCount`, `importDepth`, `nestingDepth`, and `chaosScore` fields, plus an optional `complexity` field on `AuditReport`
- [ ] Milestone 2 — Implement metric calculation in the parser (`lintComplexityMetrics()`), with configurable thresholds via `.mintrc` or CLI flags (`--max-selectors`, `--max-specificity`)
- [ ] Milestone 3 — Add JSON/Markdown output with the metrics, CI-compatible (exit code 1 when thresholds are exceeded)
- [ ] Milestone 4 — Add a benchmark fixture validating the computed metrics against a reference complexity dataset
