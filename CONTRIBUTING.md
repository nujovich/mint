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
npx tsc --noEmit   # must pass before opening a PR
```

There is no test suite at this stage. Manual testing through the full wizard flow is the verification method.

## Opening a PR

- Use the PR template — fill out all sections
- Keep PRs focused: one logical change per PR
- For anything that changes Claude prompts or the AuditReport/DSTokens shape, include a before/after example of the JSON output in the PR description
