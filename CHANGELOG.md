# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Features

- `mint-ds validate` — DTCG v1 validation for `tokens.json`: structural checks plus
  semantic checks (broken/circular references, naming consistency, reference type
  mismatches), `--json` output, `--no-semantic` flag, and CI templates under `templates/dtcg/`.

## [0.1.0] - 2026-05-19

### Features

- Initial release: CSS/SCSS audit via Claude AI
- Design token generation targeting CSS custom properties, Tailwind, SCSS variables, and Style Dictionary
- CLI tool (`mint-ds`) with `--audit`, `--resolve`, and `--export` commands
- Web playground (Next.js 15) with a three-step wizard UI
- CI pipeline with lint, typecheck, test coverage, and build checks
