# Contributing to Mint

Thanks for your interest in contributing. Here's everything you need to get started.

## Setup

```bash
git clone https://github.com/your-org/mint.git
cd mint
npm install
cp .env.local.example .env.local
# Set ANTHROPIC_API_KEY in .env.local
npm run dev
```

## Architecture overview

Mint is a Next.js 15 app with three API routes and a single-page wizard UI.

**The wizard has three steps:**

| Step | Component | API call |
|------|-----------|----------|
| 1 — Input | `CssInput.tsx` | — |
| 2 — Audit | `AuditView.tsx` | `POST /api/audit` |
| 3 — Tokens | `TokenPreview` + `ExportPanel` | `POST /api/resolve`, `POST /api/export` |

**State machine lives in `app/page.tsx`** as a `WizardStep` union (`'input' | 'audit' | 'tokens'`). All API calls go through `handleAudit` and `handleResolve` there.

**Shared types** are in `lib/types.ts`. Touch this file whenever you add a new data shape — don't define types inline in components.

**Styling** is inline styles + CSS custom properties from `globals.css`. Responsive layout uses the `mint-*` CSS utility classes defined at the bottom of `globals.css`. Apply them via `className` — don't duplicate grid/flex logic in inline styles.

## Making changes

### Adding a new export target

1. Add the new target to the `ExportTarget` union in `lib/types.ts`
2. Add an entry to `EXPORT_TARGETS` in `lib/types.ts` (English description, correct category)
3. Add the prompt case to `buildPrompt()` in `app/api/export/route.ts`
4. Test by running the full flow and clicking your new target in the Export tab

### Modifying Claude prompts

All three prompts live in their respective route files:
- `app/api/audit/route.ts` — CSS analysis prompt
- `app/api/resolve/route.ts` — token generation prompt
- `app/api/export/route.ts` — code generation prompt (one case per target)

When editing prompts, test with real-world CSS inputs — Bootstrap, Tailwind, and hand-rolled legacy CSS all behave differently.

### Adding responsive styles

Add CSS utility classes to the `Responsive layout utilities` section at the bottom of `app/globals.css`. Use the existing `mint-*` naming convention. Apply via `className` in components, and keep inline styles only for dynamic values (colors, widths derived from data).

## Code conventions

- **Language** — all user-facing strings must be English
- **Types** — no `any`, no implicit `any`. Extend `lib/types.ts` for new shapes
- **Comments** — only when the *why* is non-obvious. No docstrings, no task references
- **Inline styles vs CSS** — use CSS classes for layout (grid, flex, padding breakpoints), inline styles for dynamic/token-driven values
- **No new dependencies** without discussion — the current stack is intentionally minimal

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

All four commands run automatically in CI on every PR. The pre-commit hook runs `npx lint-staged`, which lints staged files with `next lint --file`, before each commit.

## Opening a PR

- Use the PR template — fill out all sections
- Keep PRs focused: one logical change per PR
- For anything that changes Claude prompts or the AuditReport/DSTokens shape, include a before/after example of the JSON output in the PR description

## Commit message convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) so the changelog and GitHub Releases can be generated automatically.

| Prefix | When to use |
|--------|-------------|
| `feat:` | New user-facing feature |
| `fix:` | Bug fix |
| `perf:` | Performance improvement |
| `refactor:` | Code change with no behavior change |
| `docs:` | Documentation only |
| `chore:` | Tooling, deps, config (hidden in changelog) |
| `test:` | Tests only (hidden in changelog) |
| `ci:` | CI/CD changes (hidden in changelog) |

Breaking changes: add `!` after the prefix or a `BREAKING CHANGE:` footer, e.g. `feat!: redesign token schema`.

The `commit-msg` hook enforces this format automatically via commitlint.

## Releasing a new version

Maintainers run the release from the `main` branch. You need a `GITHUB_TOKEN` with write access to create the GitHub Release.

```bash
# Preview what would be released (no writes, no tags)
npm run release:dry

# Publish the release
GITHUB_TOKEN=<your-token> npm run release
```

`release-it` will:
1. Bump the version in `package.json` (patch / minor / major — it asks)
2. Append the new section to `CHANGELOG.md`
3. Commit both files with `chore: release vX.Y.Z`
4. Create and push the git tag `vX.Y.Z`
5. Publish a GitHub Release with the generated notes
