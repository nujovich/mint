# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-07-10

### Features

- `mint-ds validate` — DTCG v1 validation for `tokens.json`: structural checks plus
  semantic checks (broken/circular references, naming consistency, reference type
  mismatches), `--json` output, `--no-semantic` flag, and CI templates under `templates/dtcg/`.

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
