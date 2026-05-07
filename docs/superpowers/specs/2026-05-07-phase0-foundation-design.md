# Phase 0: Foundation — Vitest + ESLint + CI Workflow

**Date:** 2026-05-07
**Issue:** [#21](https://github.com/nujovich/mint/issues/21)
**Parent RFC:** [#17](https://github.com/nujovich/mint/issues/17)

## Summary

Add the basic engineering infrastructure the repo is currently missing: a test runner with 80% global coverage enforcement, a linter, a type-check script, and a CI workflow. Prerequisite for the multi-provider refactor in Phase 1 (#17).

No production logic is modified. The only change to `lib/prompts.mjs` is a single coverage-exclusion annotation on `callAnthropic`.

---

## Section 1: Vitest + Test Coverage

### New dev dependencies

- `vitest`
- `@vitest/coverage-v8`

### New scripts in `package.json`

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### `vitest.config.ts`

- `environment: 'node'`
- `include: ['lib/__tests__/**/*.mjs']`
- `coverage.provider: 'v8'`
- Global thresholds: **80%** for lines, functions, branches, and statements
- `coverage.exclude` includes `node_modules`, `eslint.config.mjs`, `.github`

### `lib/__tests__/prompts.test.mjs`

~15–20 test cases covering all pure helpers. `callAnthropic` is excluded via a `/* c8 ignore next */` annotation in `lib/prompts.mjs` (no logic change).

| Helper | Test cases |
|---|---|
| `preprocessCss` | strips comments, collapses whitespace, returns clean input unchanged |
| `buildAuditPrompt` | output is a non-empty string, contains the CSS input |
| `buildResolvePrompt` | output contains token keywords, embeds the decisions JSON |
| `buildExportPrompt` | known target returns non-empty string, unknown target throws |
| `resolveTarget` | canonical target passes through, alias resolves to canonical, null/empty returns null |
| `stripFences` | fenced block stripped, no-fence passthrough, language-tagged variants (` ```js `, ` ```css `) |

### `lib/prompts.mjs` change

Single annotation above `callAnthropic` to exclude it from coverage instrumentation:

```js
/* c8 ignore next */
export async function callAnthropic({ ... }) {
```

No logic is modified.

---

## Section 2: ESLint (flat config + `next lint`)

### New dev dependency

- `@eslint/eslintrc` — needed for `FlatCompat` to bridge `eslint-config-next` (legacy format) into ESLint 9 flat config

### New script in `package.json`

```json
"lint": "next lint"
```

### `eslint.config.mjs`

```js
import { FlatCompat } from '@eslint/eslintrc'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory: __dirname })

export default [
  ...compat.extends('next/core-web-vitals'),
]
```

`next lint` covers `app/`, `components/`, `lib/`, and `bin/` by default — no extra include/exclude needed.

Any pre-existing lint findings on `main` are fixed inline if minor; non-trivial findings get a follow-up issue.

---

## Section 3: Type-check Script

### New script in `package.json`

```json
"typecheck": "tsc --noEmit"
```

Rationale: `next build` already runs the TypeScript compiler, but a dedicated `typecheck` step surfaces type errors earlier in CI (before the slower build step) and produces cleaner output for contributors.

---

## Section 4: GitHub Actions CI Workflow

### New file: `.github/workflows/ci.yml`

**Triggers:** push to `main`, pull requests targeting `main`

**Job:** `ci` on `ubuntu-latest`

**Steps in order:**

1. `actions/checkout@v4`
2. `actions/setup-node@v4` with `node-version: 20` and `cache: 'npm'`
3. `npm ci`
4. `npm run lint`
5. `npm run typecheck`
6. `npm run test:coverage`
7. `npm run build`

Any step failure marks the job red and blocks PR merges (once branch protection is configured — outside this issue's scope).

CI uses `npm run test:coverage` (not `npm test`) so that the 80% thresholds are enforced on every PR. Vitest only checks coverage thresholds when coverage collection is active.

---

## Section 5: CONTRIBUTING.md Update

Replace the current "Running checks" section (which says "There is no test suite") with:

```md
## Running checks

# Type-check
npm run typecheck

# Lint
npm run lint

# Tests
npm test

# Tests in watch mode (during development)
npm run test:watch

# Tests with coverage report
npm run test:coverage
```

Add a note that `npm run build` is the final gate and must pass before opening a PR — consistent with what CI enforces.

---

## Acceptance Criteria

- `npm install` succeeds with no peer warnings
- `npm run lint` passes on current `main` (minor findings fixed inline)
- `npm run typecheck` passes
- `npm test` runs and all smoke tests pass locally
- `npm run test:coverage` reports ≥80% across lines, functions, branches, statements
- `npm run build` still succeeds
- CI workflow runs green on a real PR
- No production logic in `lib/`, `bin/`, `app/`, or `components/` is modified

## Out of Scope

- Pre-commit hooks
- E2E tests
- Mutation testing
- Multi-version Node matrix in CI
- Branch protection rules
- Provider abstraction (Phase 1 / #17)
