# Changelog

All notable changes to this project will be documented in this file.

## [0.2.1](https://github.com/nujovich/mint/compare/v0.2.0...v0.2.1) (2026-07-10)

Maintenance release: release automation and CI publishing (OIDC + provenance). No user-facing changes.

## [0.2.0] - 2026-07-10

### Features

- `mint-ds validate` — DTCG v1 validation for `tokens.json`: structural checks plus
  semantic checks (broken/circular references, naming consistency, reference type
  mismatches), `--json` output, `--no-semantic` flag, and CI templates under `templates/dtcg/`.
- CSS layout linting rules added to the Claude audit:
  - **Layout accessibility** — flag grid/flex `order` that breaks DOM order and visual reordering without a `tabindex` fallback
  - **Modern best practices** — flag single-column grids, legacy centering, the flex `min-width: 0` hack, and fragile nested selectors
  - **Feature adoption** — suggest `@layer` cascade organization and `@container` queries where width-scoped `@media` queries are used
  - **Overflow & wrap safety** — flag flex containers missing `flex-wrap` and sized grid/flex containers without overflow handling
- Chaos score now factors in layout-accessibility (+1 when ≥ 3 issues) and overflow-safety (+1 when ≥ 4 issues) counts
- New `AuditReport` fields: `layoutA11yIssues`, `modernPracticeIssues`, `adoptionSuggestions`, `overflowSafetyIssues`

### Bug Fixes

- Ship `lib/dtcg-validator.mjs` in the npm tarball so the CLI loads when installed — the
  `files` allowlist previously omitted it, breaking every command on install (#79).

## [0.1.0] - 2026-05-19

### Features

- Initial release: CSS/SCSS audit via Claude AI
- Design token generation targeting CSS custom properties, Tailwind, SCSS variables, and Style Dictionary
- CLI tool (`mint-ds`) with `--audit`, `--resolve`, and `--export` commands
- Web playground (Next.js 15) with a three-step wizard UI
- CI pipeline with lint, typecheck, test coverage, and build checks
