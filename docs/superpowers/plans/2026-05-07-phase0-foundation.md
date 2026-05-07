# Phase 0: Foundation — Vitest + ESLint + CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add test runner (vitest, 80% global coverage), ESLint flat config (`next lint`), typecheck script, CI workflow, and a lint-only pre-commit hook — the full engineering harness required before the Phase 1 multi-provider refactor.

**Architecture:** All changes are additive tooling. No production logic in `lib/`, `bin/`, `app/`, or `components/` is modified except for a single `/* v8 ignore start/end */` block around `callAnthropic` to exclude the network-dependent function from coverage. Tests live in `lib/__tests__/` and exercise every pure helper in `lib/prompts.mjs`.

**Tech Stack:** vitest, @vitest/coverage-v8, @eslint/eslintrc, husky, lint-staged, GitHub Actions (ubuntu-latest, Node 20)

---

## File Map

| Status | Path | Purpose |
|---|---|---|
| Create | `vitest.config.ts` | Vitest config with v8 coverage and 80% thresholds |
| Create | `lib/__tests__/prompts.test.mjs` | Smoke + unit tests for all pure helpers |
| Create | `eslint.config.mjs` | ESLint 9 flat config via FlatCompat → next/core-web-vitals |
| Create | `.github/workflows/ci.yml` | CI: lint → typecheck → test:coverage → build |
| Create | `.husky/pre-commit` | Runs lint-staged on commit |
| Modify | `package.json` | New scripts + devDependencies |
| Modify | `lib/prompts.mjs` | v8 ignore block around `callAnthropic` only |
| Modify | `CONTRIBUTING.md` | Update "Running checks" section |

---

## Task 1: Install vitest and add npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add vitest devDependencies and scripts to package.json**

Open `package.json`. Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

Add to `"devDependencies"`:
```json
"vitest": "^3.1.0",
"@vitest/coverage-v8": "^3.1.0"
```

Final `scripts` block:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "mint-ds": "node bin/mint-ds.mjs",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

- [ ] **Step 2: Install**

```bash
npm install
```

Expected: no peer warnings, `node_modules/vitest` and `node_modules/@vitest` appear.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest and coverage-v8 devDependencies"
```

---

## Task 2: Create vitest.config.ts

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create the config**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.mjs'],
      exclude: ['lib/__tests__/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
```

- [ ] **Step 2: Verify vitest picks up the config**

```bash
npm test
```

Expected: `No test files found` (or similar — no failures, no errors importing the config).

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add vitest config with v8 coverage and 80% thresholds"
```

---

## Task 3: Bootstrap test file — stripFences

**Files:**
- Create: `lib/__tests__/prompts.test.mjs`

- [ ] **Step 1: Create the test file with stripFences cases**

```js
import { describe, it, expect } from 'vitest'
import {
  stripFences,
} from '../prompts.mjs'

describe('stripFences', () => {
  it('strips a js-fenced code block', () => {
    expect(stripFences('```js\nconst x = 1\n```')).toBe('const x = 1')
  })

  it('strips a css-fenced code block', () => {
    expect(stripFences('```css\nbody { color: red; }\n```')).toBe('body { color: red; }')
  })

  it('returns unfenced input unchanged', () => {
    expect(stripFences('const x = 1')).toBe('const x = 1')
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
npm test
```

Expected output:
```
✓ lib/__tests__/prompts.test.mjs (3)
  ✓ stripFences > strips a js-fenced code block
  ✓ stripFences > strips a css-fenced code block
  ✓ stripFences > returns unfenced input unchanged

Test Files  1 passed (1)
Tests  3 passed (3)
```

- [ ] **Step 3: Commit**

```bash
git add lib/__tests__/prompts.test.mjs
git commit -m "test: add stripFences smoke tests"
```

---

## Task 4: Add resolveTarget and preprocessCss tests

**Files:**
- Modify: `lib/__tests__/prompts.test.mjs`

- [ ] **Step 1: Add imports and new test suites**

Extend the import at the top of `lib/__tests__/prompts.test.mjs`:
```js
import {
  stripFences,
  resolveTarget,
  preprocessCss,
} from '../prompts.mjs'
```

Append after the `stripFences` describe block:

```js
describe('resolveTarget', () => {
  it('returns a canonical target key unchanged', () => {
    expect(resolveTarget('css-variables')).toBe('css-variables')
  })

  it('resolves a short alias to its canonical key', () => {
    expect(resolveTarget('react')).toBe('react-component')
  })

  it('resolves tailwind alias', () => {
    expect(resolveTarget('tailwind')).toBe('tailwind-config')
  })

  it('returns null for an unknown target', () => {
    expect(resolveTarget('unknown-xyz')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(resolveTarget(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(resolveTarget('')).toBeNull()
  })
})

describe('preprocessCss', () => {
  it('strips block comments', () => {
    expect(preprocessCss('/* comment */ body { color: red; }')).toBe('body { color: red; }')
  })

  it('strips line comments', () => {
    expect(preprocessCss('// comment\nbody { color: red; }')).toBe('body { color: red; }')
  })

  it('collapses multiple whitespace to a single space', () => {
    expect(preprocessCss('body  {   color:   red;   }')).toBe('body { color: red; }')
  })

  it('returns already-clean input unchanged', () => {
    expect(preprocessCss('body { color: red; }')).toBe('body { color: red; }')
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
npm test
```

Expected:
```
✓ lib/__tests__/prompts.test.mjs (13)
  ✓ stripFences (3)
  ✓ resolveTarget (6)
  ✓ preprocessCss (4)

Test Files  1 passed (1)
Tests  13 passed (13)
```

- [ ] **Step 3: Commit**

```bash
git add lib/__tests__/prompts.test.mjs
git commit -m "test: add resolveTarget and preprocessCss tests"
```

---

## Task 5: Add buildAuditPrompt and buildResolvePrompt tests

**Files:**
- Modify: `lib/__tests__/prompts.test.mjs`

- [ ] **Step 1: Extend imports**

```js
import {
  stripFences,
  resolveTarget,
  preprocessCss,
  buildAuditPrompt,
  buildResolvePrompt,
} from '../prompts.mjs'
```

- [ ] **Step 2: Append test suites**

```js
describe('buildAuditPrompt', () => {
  const css = 'body { color: #ff0000; font-size: 16px; }'

  it('returns a non-empty string', () => {
    expect(typeof buildAuditPrompt(css)).toBe('string')
    expect(buildAuditPrompt(css).length).toBeGreaterThan(0)
  })

  it('embeds the CSS source in the output', () => {
    expect(buildAuditPrompt(css)).toContain(css)
  })

  it('includes the AuditReport instruction', () => {
    expect(buildAuditPrompt(css)).toContain('AuditReport')
  })
})

describe('buildResolvePrompt', () => {
  const css = 'body { color: #6366f1; }'
  const decisions = {
    colors: [{ include: true, name: 'primary', value: '#6366f1' }],
    fonts: ['Inter'],
    spacingScale: { '1': '4px', '2': '8px' },
  }

  it('returns a non-empty string', () => {
    expect(typeof buildResolvePrompt(css, decisions)).toBe('string')
    expect(buildResolvePrompt(css, decisions).length).toBeGreaterThan(0)
  })

  it('embeds the original CSS', () => {
    expect(buildResolvePrompt(css, decisions)).toContain(css)
  })

  it('embeds the decisions as JSON', () => {
    expect(buildResolvePrompt(css, decisions)).toContain('"primary"')
  })

  it('includes DSTokens instructions', () => {
    expect(buildResolvePrompt(css, decisions)).toContain('DSTokens')
  })
})
```

- [ ] **Step 3: Run the tests**

```bash
npm test
```

Expected:
```
✓ lib/__tests__/prompts.test.mjs (20)
  ...
  ✓ buildAuditPrompt (3)
  ✓ buildResolvePrompt (4)

Tests  20 passed (20)
```

- [ ] **Step 4: Commit**

```bash
git add lib/__tests__/prompts.test.mjs
git commit -m "test: add buildAuditPrompt and buildResolvePrompt tests"
```

---

## Task 6: Add buildExportPrompt tests

**Files:**
- Modify: `lib/__tests__/prompts.test.mjs`

- [ ] **Step 1: Extend imports**

```js
import {
  stripFences,
  resolveTarget,
  preprocessCss,
  buildAuditPrompt,
  buildResolvePrompt,
  buildExportPrompt,
} from '../prompts.mjs'
```

- [ ] **Step 2: Append test suite**

```js
describe('buildExportPrompt', () => {
  const tokens = {
    brand: 'test',
    colors: [{ name: 'primary', value: '#6366f1', scale: {} }],
    typography: { fontFamilies: { body: 'Inter' } },
    spacing: { '1': '4px' },
  }

  it('returns a non-empty string for a known target', () => {
    const result = buildExportPrompt(tokens, 'css-variables')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for react-component target', () => {
    const result = buildExportPrompt(tokens, 'react-component')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('embeds the tokens JSON in the output', () => {
    expect(buildExportPrompt(tokens, 'css-variables')).toContain('"primary"')
  })

  it('returns null for an unknown target', () => {
    expect(buildExportPrompt(tokens, 'does-not-exist')).toBeNull()
  })
})
```

- [ ] **Step 3: Run the tests**

```bash
npm test
```

Expected:
```
✓ lib/__tests__/prompts.test.mjs (24)
  ...
  ✓ buildExportPrompt (4)

Tests  24 passed (24)
```

- [ ] **Step 4: Commit**

```bash
git add lib/__tests__/prompts.test.mjs
git commit -m "test: add buildExportPrompt tests"
```

---

## Task 7: Exclude callAnthropic from coverage and verify 80% threshold

**Files:**
- Modify: `lib/prompts.mjs` (annotation only, no logic change)

- [ ] **Step 1: Add v8 ignore block around callAnthropic**

In `lib/prompts.mjs`, find the `callAnthropic` function (line 391). Wrap it:

```js
/* v8 ignore start */
export async function callAnthropic({ apiKey, prompt, maxTokens = 3000 }) {
  // ... existing body unchanged ...
}
/* v8 ignore end */
```

Add `/* v8 ignore start */` on the line immediately before `export async function callAnthropic` and `/* v8 ignore end */` on the line after the closing `}`.

- [ ] **Step 2: Run coverage**

```bash
npm run test:coverage
```

Expected: all thresholds (lines, functions, branches, statements) at ≥80%. If any threshold is below 80%, the command exits with a non-zero code and lists which threshold failed. Add test cases for the failing helper until coverage passes.

- [ ] **Step 3: Commit**

```bash
git add lib/prompts.mjs
git commit -m "chore: exclude callAnthropic from v8 coverage (network-dependent)"
```

---

## Task 8: Add ESLint flat config

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add @eslint/eslintrc and lint script to package.json**

Add to `"devDependencies"`:
```json
"@eslint/eslintrc": "^3.2.0"
```

Add to `"scripts"`:
```json
"lint": "next lint"
```

- [ ] **Step 2: Install**

```bash
npm install
```

- [ ] **Step 3: Create eslint.config.mjs**

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

- [ ] **Step 4: Commit**

```bash
git add eslint.config.mjs package.json package-lock.json
git commit -m "chore: add ESLint flat config with next/core-web-vitals"
```

---

## Task 9: Run lint and fix any findings

**Files:**
- Modify: whichever files `next lint` flags (fix inline if minor)

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Expected: `✔ No ESLint warnings or errors` — or a list of findings to address.

- [ ] **Step 2: Fix minor findings**

For each finding, fix it inline. Common Next.js lint rules that may trigger on existing code:

| Rule | Typical fix |
|---|---|
| `@next/next/no-img-element` | Replace `<img>` with `next/image` `<Image>` |
| `react-hooks/exhaustive-deps` | Add missing deps to the `useEffect`/`useCallback` array |
| `@next/next/no-html-link-for-pages` | Replace `<a href="...">` with `next/link` `<Link>` |

If any finding is non-trivial (requires understanding the feature logic), open a follow-up issue instead of expanding this PR. Do not use `// eslint-disable` to suppress without understanding the rule.

- [ ] **Step 3: Re-run lint to confirm clean**

```bash
npm run lint
```

Expected: `✔ No ESLint warnings or errors`

- [ ] **Step 4: Commit (only if there were findings to fix)**

```bash
git add -p   # stage only the lint fixes
git commit -m "fix: address pre-existing ESLint findings from next/core-web-vitals"
```

---

## Task 10: Add typecheck script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add typecheck script**

Add to `"scripts"` in `package.json`:
```json
"typecheck": "tsc --noEmit"
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no output, exit code 0. If type errors appear, fix them — they existed before this PR and should be addressed here since they'd also break CI.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add typecheck script (tsc --noEmit)"
```

---

## Task 11: Create CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npm run lint

      - run: npm run typecheck

      - run: npm run test:coverage

      - run: npm run build
```

- [ ] **Step 2: Verify the file is valid YAML**

```bash
node -e "require('fs').readFileSync('.github/workflows/ci.yml', 'utf8'); console.log('YAML readable')"
```

Expected: `YAML readable`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow (lint, typecheck, test:coverage, build)"
```

---

## Task 12: Set up pre-commit hook (husky + lint-staged)

**Files:**
- Modify: `package.json`
- Create: `.husky/pre-commit` (via husky init)

- [ ] **Step 1: Add husky and lint-staged**

Add to `"devDependencies"` in `package.json`:
```json
"husky": "^9.1.0",
"lint-staged": "^15.5.0"
```

Add to `"scripts"`:
```json
"prepare": "husky"
```

Add a top-level `"lint-staged"` key:
```json
"lint-staged": {
  "*.{js,mjs,cjs,ts,tsx}": "next lint --file"
}
```

- [ ] **Step 2: Install and initialise husky**

```bash
npm install
npx husky init
```

Expected: `.husky/pre-commit` is created with a default `npm test` line.

- [ ] **Step 3: Replace the pre-commit hook body**

Overwrite `.husky/pre-commit` with:
```sh
npx lint-staged
```

- [ ] **Step 4: Verify the hook is installed**

```bash
cat .git/hooks/pre-commit
```

Expected output contains `lint-staged` (husky wires the `.husky/pre-commit` script into the git hook). If the file doesn't exist, re-run `npx husky init` and repeat Step 3.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .husky/pre-commit
git commit -m "chore: add husky pre-commit hook running lint-staged"
```

---

## Task 13: Update CONTRIBUTING.md

**Files:**
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Replace the "Running checks" section**

Find this block in `CONTRIBUTING.md`:
```markdown
## Running checks

```bash
npx tsc --noEmit   # must pass before opening a PR
```

There is no test suite at this stage. Manual testing through the full wizard flow is the verification method.
```

Replace it with:
```markdown
## Running checks

```bash
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

# Full build (must pass before opening a PR)
npm run build
```

All four commands run automatically in CI on every PR. The pre-commit hook runs `npm run lint` on staged files before each commit.
```

- [ ] **Step 2: Run all checks locally one final time**

```bash
npm run lint && npm run typecheck && npm run test:coverage && npm run build
```

Expected: all four pass.

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: update CONTRIBUTING.md with test, lint, and typecheck commands"
```

---

## Done

Open a draft PR against `main`. Once CI goes green on the real PR, mark it ready for review. Confirm:

- [ ] `npm run lint` — clean
- [ ] `npm run typecheck` — clean
- [ ] `npm run test:coverage` — 24 tests pass, all thresholds ≥80%
- [ ] `npm run build` — no regression
- [ ] CI workflow — green
- [ ] Pre-commit hook fires on staged `.ts`/`.tsx`/`.mjs` files
