# Changelog

## [0.3.0](https://github.com/nujovich/mint/compare/v0.2.1...v0.3.0) (2026-07-20)

### Features

- add `diff` command to compare two token files ([#90](https://github.com/nujovich/mint/issues/90)) ([bb79fb9](https://github.com/nujovich/mint/commit/bb79fb9bae9615c3089b82c364139d0d55bd529e)), closes [#34](https://github.com/nujovich/mint/issues/34)
- add `mint-ds apply` to codemod source CSS to tokens ([#35](https://github.com/nujovich/mint/issues/35)) ([#97](https://github.com/nujovich/mint/issues/97)) ([3a8cd52](https://github.com/nujovich/mint/commit/3a8cd522d30ffb9679cb480823c3edd0227526c2))
- add `mint-ds init` command to scaffold a config file ([#93](https://github.com/nujovich/mint/issues/93)) ([481837c](https://github.com/nujovich/mint/commit/481837c2c20f3c7fe7b84690e7c273f05c20f6f1)), closes [#13](https://github.com/nujovich/mint/issues/13)
- add CSS layout linting rules for a11y and modern practices ([#68](https://github.com/nujovich/mint/issues/68)) ([130a4f5](https://github.com/nujovich/mint/commit/130a4f5e60eb52221303f888f67c4e5b5698a8e7))
- add mint-ds lint command with gap-decoration rules ([#72](https://github.com/nujovich/mint/issues/72)) ([59695f7](https://github.com/nujovich/mint/commit/59695f73d62f4e6b6378a2279c6cdab7a22940a7)), closes [#7](https://github.com/nujovich/mint/issues/7)
- add mint-ds score command for CSS health scoring ([#75](https://github.com/nujovich/mint/issues/75)) ([8cb2b29](https://github.com/nujovich/mint/commit/8cb2b29de6a86d69696bf3832d5fe19d19062fb1)), closes [#6](https://github.com/nujovich/mint/issues/6) [#6](https://github.com/nujovich/mint/issues/6)
- add release-infographic skill ([#96](https://github.com/nujovich/mint/issues/96)) ([4933a99](https://github.com/nujovich/mint/commit/4933a9909703b9057b6e35899b6f6d6a84a7785a))
- add SolidJS and Qwik export targets ([#86](https://github.com/nujovich/mint/issues/86)) ([7b05818](https://github.com/nujovich/mint/commit/7b05818a31301f1be209f6e5fadce0b1065fd844))
- add UnoCSS export target ([#87](https://github.com/nujovich/mint/issues/87)) ([8453290](https://github.com/nujovich/mint/commit/8453290c257bc4780dd5ee5cd56ec8e2ca855770)), closes [#10](https://github.com/nujovich/mint/issues/10)
- add Vanilla Extract export target ([#88](https://github.com/nujovich/mint/issues/88)) ([0c678da](https://github.com/nujovich/mint/commit/0c678dacd72c94d8819794366c9a2d1825f64bf5)), closes [#9](https://github.com/nujovich/mint/issues/9)
- **compat:** add Interop 2026 safe CSS feature adoption rules ([#73](https://github.com/nujovich/mint/issues/73)) ([967442b](https://github.com/nujovich/mint/commit/967442bb73ce8c6594d75a5adb83de6cfcad204b)), closes [#4](https://github.com/nujovich/mint/issues/4) [#4](https://github.com/nujovich/mint/issues/4) [#4](https://github.com/nujovich/mint/issues/4)
- **mint:** add --target dtcg deterministic export for Penpot interop ([#85](https://github.com/nujovich/mint/issues/85)) ([6203534](https://github.com/nujovich/mint/commit/62035346d3f11039ac267fb632fdb7f6813c9639)), closes [#76](https://github.com/nujovich/mint/issues/76) [#76](https://github.com/nujovich/mint/issues/76) [#92](https://github.com/nujovich/mint/issues/92)
- **penpot-plugin:** add DTCG to Penpot token import plugin ([#92](https://github.com/nujovich/mint/issues/92)) ([27c6fc0](https://github.com/nujovich/mint/commit/27c6fc0d75f1433e002591a2fd2d4ed011cb8d0e)), closes [#76](https://github.com/nujovich/mint/issues/76)

### Bug Fixes

- retry LLM calls and force IPv4 DNS on WSL2 ([#19](https://github.com/nujovich/mint/issues/19)) ([#95](https://github.com/nujovich/mint/issues/95)) ([c75c835](https://github.com/nujovich/mint/commit/c75c835458b6d05256b39410b41b3d926fb60fb5))
- ship compat/lint lib modules in npm files allowlist ([#89](https://github.com/nujovich/mint/issues/89)) ([ab79313](https://github.com/nujovich/mint/commit/ab793134627ab4c9036a1d732cbc3f413cdbac36))

All notable changes to this project will be documented in this file.

## [Unreleased]

### Features

- `mint-ds lint <dir>` — new static CSS lint command (no LLM). Ships gap-decoration rules that flag hand-rolled ways of drawing lines between grid/flex tracks (borders on children, `::before`/`::after` pseudo-elements, or backgrounds alongside `gap`) and suggest the native `gap-rule-color` / `gap-rule-style` / `gap-rule-width` properties, closed by a "Modern CSS Opportunities" adoption report.

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
