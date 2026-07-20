# Mint 🎨

**Mint** audits your legacy CSS and generates a clean, exportable design system from the chaos.

It ships in two flavors:

- **CLI** — `npx mint-ds audit ./src/styles && npx mint-ds export --target tailwind`. Run it against a whole directory, scriptable, no UI.
- **Web playground** — paste a snippet, walk through the 3-step wizard, preview tokens visually before exporting.

Both share the same prompts and Claude pipeline.

## How it works

```
CSS / SCSS / HTML  →  Claude Audit  →  Review & curate  →  Clean tokens  →  Export  →  Apply
```

1. **Audit** — Claude analyzes your CSS, groups near-duplicate colors into clusters, detects fonts, flags spacing values that don't fit a 4px grid, identifies duplicate transition/animation declarations, and lints layout patterns for accessibility and modern-CSS pitfalls (see [CSS layout linting](#css-layout-linting)).
2. **Curate** — Review each cluster. Pick the canonical color, rename tokens, include or exclude entries, and select which fonts to keep. (CLI applies sensible defaults: include every cluster, keep non-system fonts, use the suggested 4px scale.)
3. **Export** — Generate production-ready output in any format.
4. **Apply** — Rewrite your source CSS in place so raw values reference the generated tokens (`#1976d2` → `var(--color-primary)`). Deterministic, no LLM — adoption becomes a reviewable git diff. See [`mint-ds apply`](#applying-tokens-to-source-css).

## CSS layout linting

Beyond color, font, and spacing tokens, the audit also lints your CSS for layout accessibility issues and modern-CSS pitfalls. These findings are returned in the raw `AuditReport` (write it to disk with `--report`); the accessibility and overflow checks also feed the chaos score.

| Category                   | Rule                                | Severity   | What it flags                                                                                                                   |
| -------------------------- | ----------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Layout accessibility**   | `order` breaks DOM order            | warning    | A grid/flex child reordered with `order` so the visual order no longer matches the DOM — breaks keyboard navigation and SR flow |
|                            | reordering without tabindex         | warning    | An element visually reordered via `order` with no matching `tabindex` adjustment, so keyboard users navigate in DOM order       |
| **Modern best practices**  | `grid-when-flexbox-wrap-would-work` | suggestion | Single-column grid that a `flex` + `flex-wrap` layout would handle more simply                                                  |
|                            | `legacy-centering`                  | suggestion | `margin: 0 auto` + fixed width, or absolute-position + `transform` centering, where modern `flex`/`grid` centering is cleaner   |
|                            | `flex-min-width-zero-hack`          | suggestion | `min-width: 0` on a flex item — the classic overflow workaround that often hides a layout misunderstanding                      |
|                            | `fragile-nested-selectors`          | suggestion | Selectors coupled to a brittle DOM shape (deep `>` / `+` chains) that a small HTML refactor would break                         |
| **Feature adoption**       | `use-css-layers`                    | info       | Large stylesheets (20+ rules) with no `@layer` organization                                                                     |
|                            | `use-container-queries`             | info       | Component-scoped width `@media` queries that a `@container` query would express better                                          |
| **Overflow & wrap safety** | `flex-wrap-missing`                 | warning    | Flex container without `flex-wrap` — items can't wrap and may overflow on narrow viewports                                      |
|                            | `missing-overflow-wrap`             | suggestion | Sized grid/flex container (fixed width/height) with no `overflow` handling, so content can be clipped                           |

The chaos score gains **+1** when there are 3 or more layout-accessibility issues and **+1** when there are 4 or more overflow-safety issues. Adoption suggestions are informational only and never affect the score.

## Example — Frankenstein

A bundled example of the kind of CSS that grows organically over a few years: the **same blue declared in 6 aliases**, the **same Arial family duplicated across 5 selectors**, spacing values like `7px`, `11px`, `13px`, `17px`, `19px` mixed with `rem` and `em`, and `!important` everywhere. Full input in [`examples/frankenstein/styles.css`](examples/frankenstein/styles.css).

### Before — `examples/frankenstein/styles.css`

<!-- prettier-ignore-start -->
```css
:root {
  --color-primary:       #1976d2;
  --color-primary-caps:  #1976D2;              /* same color, caps */
  --color-primary-rgb:   rgb(25, 118, 210);    /* same color, rgb */
  --color-primary-rgba:  rgba(25,118,210,1);   /* same color, rgba */
  --color-primary-hsl:   hsl(211, 79%, 46%);   /* same color, hsl */
  --color-blue:          #1976d2;              /* extra alias */
  /* …same pattern for danger, bg, text, border */
}

body         { font-family: 'Arial', sans-serif !important; }
.app-root    { font-family: Arial, Helvetica, sans-serif !important; }
h1, h2, h3   { font-family: "Arial", "Helvetica Neue", Helvetica, sans-serif !important; }
p, span, li  { font-family: Arial, sans-serif; }
.card        { font-family: 'Arial', Helvetica, sans-serif !important; }

.card        { padding: 13px; }            /* odd */
.card-inner  { padding: 1rem; }            /* unit mixed */
.table-cell  { padding: 7px 11px; }        /* primes */
.metric-card { padding: 19px; }            /* odd */
.btn-lg      { padding: 11px 20px; }       /* 11 instead of 12 */
.sidebar     { width: 13rem; }
.modal       { padding: 1.5em; }
.modal-footer{ margin-top: 17px; }
.tooltip     { padding: 5px 9px; }
```
<!-- prettier-ignore-end -->

### What Mint sees

| Signal            | What's in the source                                                                                                                                                                                                   | What Mint outputs                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Colors**        | 6 aliases for `#1976d2`, 3 for `#e53935`, 3 for `#f5f5f5`, 3 for `#212121`, 3 for `#dddddd` — all formatted differently (hex caps, hex lower, `rgb`, `rgba`, `hsl`, `#DDD` shorthand)                                  | 7 named colors (`primary`, `error`, `background`, `text`, `border`, `surface`, `muted`), each with a 50–900 scale |
| **Fonts**         | 5 `font-family` declarations, all Arial-family permutations                                                                                                                                                            | 1 body family                                                                                                     |
| **Spacing**       | 20+ values mixed across `px` / `rem` / `em`, including primes `7`, `11`, `13`, `17`, `19`                                                                                                                              | 5-step scale snapped to 4px: `4 / 8 / 12 / 20 / 24`                                                               |
| **Border radius** | `4px` and `8px` scattered with `!important`                                                                                                                                                                            | `sm: 4px`, `md: 8px`                                                                                              |
| **Shadows**       | `.shadow` and `.shadow-md` define the same value twice                                                                                                                                                                 | one `sm` token                                                                                                    |
| **Weights**       | `bold` and `700` declared as separate utilities (same thing)                                                                                                                                                           | `bold: 700`, `extrabold: 800`                                                                                     |
| **Motion**        | 8+ selectors mixing `transition`/`animation` with conflicting units (`200ms` vs `0.2s`), competing easings (`ease-in-out` vs `cubic-bezier(…)`), and properties written both as shorthands and individual declarations | Duration scale (`fast: 150ms`, `base: 200ms`, `slow: 300ms`) + easing scale (`standard`, `emphasized`)            |

### After — `examples/frankenstein/mint-ds.tokens.json`

<details>
<summary>Click to expand the full tokens output</summary>

```json
{
  "brand": "frankenstein",
  "colors": [
    {
      "name": "primary",
      "value": "#1976d2",
      "scale": {
        "50": "#e3f2fd",
        "100": "#bbdefb",
        "200": "#90caf9",
        "300": "#64b5f6",
        "400": "#42a5f5",
        "500": "#1976d2",
        "600": "#1565c0",
        "700": "#0d47a1",
        "800": "#0a3f8f",
        "900": "#08357d"
      }
    },
    {
      "name": "error",
      "value": "#e53935",
      "scale": { "50": "#ffebee", "...": "...", "900": "#a01818" }
    },
    {
      "name": "background",
      "value": "#f5f5f5",
      "scale": { "50": "#fefefe", "...": "...", "900": "#a8a8a8" }
    },
    {
      "name": "text",
      "value": "#212121",
      "scale": { "50": "#f5f5f5", "...": "...", "900": "#141414" }
    },
    {
      "name": "border",
      "value": "#dddddd",
      "scale": { "50": "#f9f9f9", "...": "...", "900": "#6c6c6c" }
    },
    {
      "name": "surface",
      "value": "#ffffff",
      "scale": { "50": "#ffffff", "...": "...", "900": "#999999" }
    },
    {
      "name": "muted",
      "value": "#666666",
      "scale": { "50": "#f2f2f2", "...": "...", "900": "#333333" }
    }
  ],
  "typography": {
    "fontFamilies": { "body": "Helvetica Neue" },
    "fontWeights": { "bold": 700, "extrabold": 800 }
  },
  "spacing": { "1": "4px", "2": "8px", "3": "12px", "5": "20px", "6": "24px" },
  "borderRadius": { "sm": "4px", "md": "8px" },
  "shadows": { "sm": "0 2px 4px rgba(0,0,0,0.1)" }
}
```

</details>

### Generated exports

The same tokens were exported in two flavors and committed alongside, so you can see the full pipeline without running it:

<details>
<summary><a href="examples/frankenstein/tailwind.config.js"><code>examples/frankenstein/tailwind.config.js</code></a> — <code>--target tailwind</code></summary>

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,js,jsx,ts,tsx,vue}',
    './components/**/*.{html,js,jsx,ts,tsx,vue}',
    './pages/**/*.{html,js,jsx,ts,tsx,vue}',
    './app/**/*.{html,js,jsx,ts,tsx,vue}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e3f2fd',
          100: '#bbdefb',
          /* …300–800 */ 900: '#08357d',
          DEFAULT: '#1976d2',
        },
        // error, background, text, border, surface, muted — same shape
      },
      fontFamily: {
        display: ['Helvetica Neue', 'sans-serif'],
        body: ['Helvetica Neue', 'sans-serif'],
      },
      spacing: { 1: '4px', 2: '8px', 3: '12px', 5: '20px', 6: '24px' },
      borderRadius: { sm: '4px', md: '8px' },
      boxShadow: { sm: '0 2px 4px rgba(0,0,0,0.1)' },
    },
  },
  safelist: ['bg-primary-500', 'text-error-500', /* … */ 'font-extrabold'],
  plugins: [],
}
```

Each color collapses 3–6 source aliases into one named scale; `safelist` covers the utilities the source CSS used so Tailwind's JIT keeps them.

</details>

<details>
<summary><a href="examples/frankenstein/components.astro"><code>examples/frankenstein/components.astro</code></a> — <code>--target astro</code></summary>

A single file with four ready-to-use Astro components — `Button`, `Card`, `Badge`, `Input` — wired to the design tokens via CSS variables. Excerpt:

```astro
---
interface Props extends HTMLAttributes<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}
const { variant = 'primary', size = 'md', ...rest } = Astro.props;
---

<button class:list={['btn', `btn--${variant}`, `btn--${size}`]} {...rest}>
  <slot />
</button>

<style>
  .btn--md      { padding: var(--spacing-3) var(--spacing-5); }
  .btn--primary { background-color: var(--color-primary-500); color: white; }
  .btn--primary:hover:not(:disabled) { background-color: var(--color-primary-600); }
  /* secondary, ghost, danger variants follow the same token references */
</style>
```

Notice how every value references a token (`var(--color-primary-500)`, `var(--spacing-3)`) — there are no hardcoded hexes or magic numbers in the generated components.

</details>

### Reproduce it locally

```bash
# 1. Audit the bundled example
npx mint-ds audit examples/frankenstein

# 2. Pick the export your stack needs
npx mint-ds export --target tailwind   # → tailwind.config.js
npx mint-ds export --target astro      # → components.astro
npx mint-ds export --target css        # → variables.css
npx mint-ds export --target react      # → components.tsx
```

The committed artifacts ([`mint-ds.tokens.json`](examples/frankenstein/mint-ds.tokens.json), [`tailwind.config.js`](examples/frankenstein/tailwind.config.js), [`components.astro`](examples/frankenstein/components.astro)) are what the audit and exports produced on the maintainer's machine — your run will land in the same shape, with minor variation in scale stops if Claude picks slightly different intermediate values.

## CLI

```bash
# Optional: scaffold a mint.config.mjs with project defaults
npx mint-ds init

# Analyze every CSS/SCSS/HTML file in a directory and write mint-ds.tokens.json
npx mint-ds audit ./src/styles

# Generate exports from the resulting tokens
npx mint-ds export --target tailwind     # → tailwind.config.js
npx mint-ds export --target react        # → components.tsx
npx mint-ds export --target css          # → variables.css

# Rewrite your source CSS to reference the generated tokens
npx mint-ds apply ./src/styles --dry-run # preview the diff
npx mint-ds apply ./src/styles           # write the changes in place
```

### Applying tokens to source CSS

`mint-ds apply` closes the loop: it rewrites raw values in your source CSS/SCSS to reference the tokens you generated, so adopting a design system is a reviewable migration commit instead of manual find-and-replace.

```bash
npx mint-ds apply <path> [options]
```

It works from the tokens file alone — **deterministic, no LLM call**. Every color/spacing/font-family literal is normalized and matched against the tokens:

```css
/* before */ /* after */
color: #1976d2;
color: var(--color-primary);
border-color: #1565c0;
border-color: var(--color-primary-600);
background: rgb(25 118 210);
background: var(--color-primary);
padding: 8px;
padding: var(--spacing-2);
font-family: Inter, sans-serif;
font-family: var(--font-body);
```

Different textual forms of the same color (`#1976D2`, `#1976d2`, `rgb(...)`) all match. It only touches the value side of declarations — comments, `url(...)`, and existing `var(...)` are left alone, and re-running is a no-op.

| Flag              | Description                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--tokens <file>` | Tokens file to read (default `mint-ds.tokens.json`, or your `mint.config` value).                                                                                                     |
| `--dry-run`       | Print the substitutions without writing any file.                                                                                                                                     |
| `--fuzzy`         | Also snap near-duplicate colors and off-scale spacing to the closest token, leaving a `/* was 13px */` note. Off by default, so a plain run only makes exact, lossless substitutions. |
| `--force`         | Skip the git-clean safety check (see below).                                                                                                                                          |
| `--target`        | Substitution style. Only `css-var` (the default) is supported today.                                                                                                                  |

**Safety.** `apply` writes to your files in place, so by default it refuses to run when any target file has uncommitted changes (or when it can't verify git state) — commit or stash first, or pass `--force`. It never descends into `node_modules` and only touches source extensions (`.css`, `.scss`, `.sass`, `.less`, `.html`). Use `--dry-run` to preview, then let `git diff` be your review.

> **Note:** in HTML files, CSS inside `<style>` blocks is rewritten, but inline `style="..."` attributes are left untouched.

### Authentication

Every command needs an LLM provider API key. You have three options — pick whichever fits your workflow:

**Option 1 — pass it per-command with `--api-key`:**

```bash
npx mint-ds audit ./src/styles --api-key sk-ant-...
```

Useful for one-off runs, CI jobs, or when you don't want the key persisted in your shell.

**Option 2 — set a per-provider env var** (recommended when you use multiple providers):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENROUTER_API_KEY=sk-or-...
export OLLAMA_API_KEY=sk-ollama-...    # optional — Ollama doesn't require a key
```

**Option 3 — set the generic `API_KEY` env var** (works with any provider):

| Shell                               | Command                       |
| ----------------------------------- | ----------------------------- |
| bash / zsh / sh (macOS, Linux, WSL) | `export API_KEY=sk-ant-...`   |
| fish                                | `set -gx API_KEY sk-ant-...`  |
| PowerShell (Windows / pwsh)         | `$env:API_KEY = "sk-ant-..."` |
| Windows CMD                         | `set API_KEY=sk-ant-...`      |

These commands set the key only for the current shell session. To persist it, add the line to your shell rc file (`~/.bashrc`, `~/.zshrc`, `~/.config/fish/config.fish`, your PowerShell `$PROFILE`, etc.) or use the system Environment Variables dialog on Windows.

`--api-key` always wins over env vars. Per-provider env vars (`ANTHROPIC_API_KEY`, etc.) win over the generic `API_KEY`.

Where to get a key:

- **Anthropic** — [console.anthropic.com](https://console.anthropic.com)
- **OpenRouter** — [openrouter.ai/keys](https://openrouter.ai/keys)

### LLM provider

Mint talks to an LLM for audit, resolve, and export. By default it uses Anthropic Claude; you can swap to a local backend with `--provider`.

| Value                 | Description                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `anthropic` (default) | Anthropic Claude API. Default model `claude-sonnet-4-20250514`.                                                       |
| `ollama`              | Local Ollama server. No API key required. Defaults to `http://localhost:11434/api/chat`, model `gemma4`.              |
| `openrouter`          | OpenRouter API. Default model `deepseek/deepseek-v4-flash`, endpoint `https://openrouter.ai/api/v1/chat/completions`. |

Override model or URL with `--model`/`--url` or the corresponding env vars. See [Environment variables](#environment-variables) for the full precedence chain.

```bash
# Run the audit against a local Ollama instance
npx mint-ds audit ./src/styles --provider ollama

# Generate exports with a local LLM
npx mint-ds export --target tailwind --provider ollama
```

`--provider` works on both `audit` and `export`. Passing an unknown name exits with `Unsupported LLM provider: <name>`.

### All commands

| Command                          | Description                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `mint-ds init`                   | Scaffold a `mint.config.mjs` with project defaults (`--force` to overwrite an existing config)                              |
| `mint-ds audit <dir>`            | Walk `<dir>` for `.css`, `.scss`, `.sass`, `.less`, `.html` files, audit them with Claude, and write `mint-ds.tokens.json`  |
| `mint-ds export --target <name>` | Read `mint-ds.tokens.json` and generate the chosen format                                                                   |
| `mint-ds validate <file>`        | Validate `tokens.json` against DTCG v1 — structure, references, cycles, naming consistency                                  |
| `mint-ds diff <old> <new>`       | Show what changed between two token files — added, removed, renamed, value-changed, scale-changed (no LLM)                  |
| `mint-ds cache --clear`          | Delete the local `mint-ds.cache.json` cache file                                                                            |
| `mint-ds compat <dir>`           | Flag CSS properties below Baseline / Interop 2026 for your browserslist target, with fallback suggestions (no LLM)          |
| `mint-ds lint <dir>`             | Run static CSS lint rules (gap-decoration hacks) plus a modern-CSS adoption report — no LLM                                 |
| `mint-ds score <dir>`            | Compute a 0–100 CSS health score with a per-metric breakdown, benchmarked against Project Wallace 2026 percentiles (no LLM) |
| `mint-ds --help`                 | Show full usage                                                                                                             |

### Configuration

Repeating the same flags on every `audit` / `export` gets old. Run `mint-ds init` to scaffold a `mint.config.mjs` in the current directory:

```js
/** @type {import('mint-ds').MintConfig} */
export default {
  // Directory the audit walks by default
  source: './src/styles',
  // Default tokens file
  tokens: 'mint-ds.tokens.json',
  // Default export target
  target: 'tailwind',
  // Where exports are written
  outDir: './design-system',
  // Glob patterns excluded from the audit walk
  ignore: ['**/node_modules/**', '**/dist/**'],
}
```

With that file present, `mint-ds audit` (no directory) walks `source`, and `mint-ds export` (no `--target`) emits `tailwind` into `outDir`. **CLI flags always win over config**, which in turn wins over the built-in defaults:

```
CLI flag  >  mint.config.mjs  >  built-in default
```

The file is generated as `.mjs` so it loads regardless of whether your project is ESM or CommonJS; existing `mint.config.js` / `mint.config.cjs` are also picked up if you prefer to write your own. `init` refuses to clobber an existing config unless you pass `--force`. Every field is optional.

### Validate options

| Flag            | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `--spec <name>` | Spec to validate against (default: `dtcg`)                 |
| `--json`        | Emit machine-readable JSON to stdout                       |
| `--no-semantic` | Skip semantic checks (refs, cycles, naming, type mismatch) |

`validate` runs two layers of checks:

- **Structural** — every node must be a valid DTCG token (with `$value`) or a group; `$type` is required and validated against the value.
- **Semantic** — broken references, circular references, naming-convention drift, and reference type mismatches.

**Exit codes:** `0` valid · `1` warnings only · `2` errors. Structural violations and broken/circular references are errors (exit `2`); naming drift and type mismatches are warnings (exit `1`). Ready-made CI templates (GitHub Action + pre-commit hook) live in [`templates/dtcg/`](templates/dtcg/).

### Diff

`mint-ds diff <old.tokens.json> <new.tokens.json>` compares two token files and reports what changed — semantically, not line-by-line. Every re-`audit` produces a fresh `mint-ds.tokens.json`; `diff` tells a PR reviewer whether a color shifted, a token was renamed, or a scale stop moved. No API key or LLM call required.

Changes are grouped by category (`colors`, `spacing`, `fontFamilies`, …) and classified:

| Symbol | Change        | Meaning                                             |
| ------ | ------------- | --------------------------------------------------- |
| `+`    | added         | Present in the new file only                        |
| `–`    | removed       | Present in the old file only                        |
| `↻`    | renamed       | Same value under a different name (heuristic)       |
| `~`    | value changed | Same name, different value                          |
| `~`    | scale changed | A color scale stop was added, removed, or re-valued |

```bash
# Human-readable report
npx mint-ds diff old.tokens.json mint-ds.tokens.json

# Machine-readable output for CI / PR bots
npx mint-ds diff old.tokens.json mint-ds.tokens.json --json
```

Example output:

```
colors
  + accent (#f59e0b)
  ~ primary.500: #1976d2 → #1f77d8
  – legacy-blue (was #1a73e8)
spacing
  ↻ renamed "4" → "5" (value 20px)

Summary: 3 change(s) — 1 added, 1 removed, 1 renamed — breaking
```

| Flag     | Description                          |
| -------- | ------------------------------------ |
| `--json` | Emit machine-readable JSON to stdout |

**Exit codes:** `0` no breaking changes · `1` breaking changes. Removed, value-changed, and scale-changed tokens are **breaking** (they alter what downstream exports emit); additions and renames preserve existing values and are non-breaking. Gate CI on the exit code to block breaking token changes from merging unnoticed.

### Compat

`mint-ds compat <dir>` scans every CSS/SCSS/HTML file in `<dir>` for properties that aren't safe to adopt yet against your project's [browserslist](https://github.com/browserslist/browserslist) target, and prints concrete fallbacks. Compatibility data comes from the [`web-features`](https://github.com/web-platform-dx/web-features) package (Baseline + Interop 2026) — no API key or LLM call required.

```bash
# Scan a styles directory against the browserslist target of the current project
npx mint-ds compat ./src/styles

# Resolve the browserslist target from a different project root
npx mint-ds compat ./src/styles --project-dir ./packages/app
```

It reports two kinds of finding:

- **`WARNING` — not supported.** A below-Baseline property that one or more of your resolved target browsers still lack. The message lists the unsupported browsers (e.g. `safari 26.3`, `chrome 118`) so you know where a fallback is needed.
- **`INFO` — experimental.** A property below the Interop 2026 threshold (90% interop). Shipping-but-not-yet-Baseline-high features (e.g. `backdrop-filter`, `view-transition-name`) surface here with their interop percentage.

Every finding carries the `web-features` feature name and a concrete `@supports`/polyfill next step, closed by a per-run summary. When every used property is Baseline or supported by the target, it prints a single ✓. The browserslist target is resolved in priority order: a `browserslist` key in `package.json` (flat array or `{ production, development }` env block), then a `.browserslistrc` / `browserslist` file, then the browserslist default.

| Flag                  | Description                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| `--project-dir <dir>` | Project root to resolve the browserslist target from (default: current dir) |
| `--quiet`             | Skip the closing fallback tip                                               |

### Lint

`mint-ds lint <dir>` runs Mint's static CSS lint rules over every CSS/SCSS/HTML file in `<dir>` — deterministic pattern checks that complement the LLM audit, with no API key or LLM call required.

Today it ships the **gap-decoration** rules. They flag hand-rolled ways of drawing lines between grid/flex tracks — borders on direct children, `::before`/`::after` pseudo-elements, or backgrounds used alongside `gap` — and point you at the native `gap-rule-color` / `gap-rule-style` / `gap-rule-width` properties (Chrome 149+, Firefox 132+).

```bash
npx mint-ds lint ./src/styles
```

Each finding prints with a severity badge (`WARN` / `INFO`), the selector, and a migration hint. A closing **Modern CSS Opportunities** report summarizes how many stylesheets use gap-decoration hacks and how many could move to the native properties, broken down by pattern.

### Score

`mint-ds score <dir>` computes a single **0–100 CSS health score** for every CSS/SCSS file in `<dir>` (a single file also works), with a per-metric breakdown benchmarked against [Project Wallace](https://www.projectwallace.com/)'s 2026 analysis of >100k production stylesheets. No API key or LLM call required — the score is a deterministic, pure computation.

It measures five complexity metrics:

| Metric                    | What it captures                                                          |
| ------------------------- | ------------------------------------------------------------------------- |
| **Selectors per rule**    | Compound selectors per rule (over-qualification)                          |
| **Declarations per rule** | Rule bloat / god-rules                                                    |
| **`!important` ratio**    | Share of declarations forcing specificity                                 |
| **Average specificity**   | ID/pseudo over-nesting                                                    |
| **`@layer` adoption**     | Share of CSS organized in cascade layers (inverted — higher is healthier) |

Each metric is mapped to a per-metric health in `[0,1]` against a `good`/`bad` reference point, then combined into the composite score using per-metric **weights** (both summing to their own normalized total):

| Metric                | Weight | `good` | `bad` |
| --------------------- | ------ | ------ | ----- |
| `importantRatio`      | 0.25   | 0%     | 10%   |
| `selectorsPerRule`    | 0.20   | 2      | 8     |
| `declarationsPerRule` | 0.20   | 4      | 12    |
| `avgSpecificity`      | 0.20   | 30     | 200   |
| `layerAdoption`       | 0.15   | 50%    | 0%    |

Weights and thresholds derive from Project Wallace's corpus — the metrics that most strongly correlate with unmaintainable CSS carry the most weight. Programmatic callers can override any subset via `computeWeightedScore(metrics, weights, thresholds)` in `lib/css-health-score.mjs`; unknown keys and non-positive weights are dropped and the composite re-normalizes, so a partial override stays well-scaled.

**Severity thresholds.** Each metric's _health percentile_ (share of real-world sites at least as healthy) is bucketed into `ok` / `warning` / `error`. Defaults come from the Wallace verdict bands and are overridable per run:

| Threshold                  | Default | Meaning                                                |
| -------------------------- | ------- | ------------------------------------------------------ |
| `--thresholds-error <n>`   | 25      | Percentile at or below which a metric is an **error**  |
| `--thresholds-warning <n>` | 50      | Percentile at or below which a metric is a **warning** |

The command exits `0` (ok), `1` (at least one warning), or `2` (at least one error) so it can gate CI. `--json` emits the full structured report (`score`, per-metric `metrics`, `status`, `exitCode`, and the Wallace `benchmark`) to stdout.

```bash
npx mint-ds score ./src/styles
npx mint-ds score ./src/styles --json
# Stricter gate: any metric worse than the 40th percentile fails the build
npx mint-ds score ./src/styles --thresholds-error 40 --thresholds-warning 60
```

Scoring the demo stylesheet shows the shape of the report — the Frankenstein CSS is deliberately messy, so it fails on `!important` abuse and zero cascade-layer adoption:

```
$ npx mint-ds score examples/frankenstein/styles.css

CSS Health Score: 60/100

Per-metric breakdown:
  Selectors per rule: 1.05     —  health 78.12/100 (better, ok)
  Declarations per rule: 1.42  —  health 85.8/100 (better, ok)
  !important ratio: 30.6%      —  health 0/100 (worse, error)
  Average specificity: 7.84    —  health 83.67/100 (better, ok)
  @layer adoption: 0.0%        —  health 0/100 (worse, error)

Overall health percentile 49.52/100 — less healthy than the median production stylesheet (Project Wallace 2026, >100k sites).

Status: ERROR — 2 metric(s) below the error threshold.
```

The full `--json` report for this file is committed as [`examples/frankenstein/styles.health.json`](examples/frankenstein/styles.health.json) so you can see the exact structured shape.

### Audit options

| Flag                | Description                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| `--out <file>`      | Tokens output path (default: `mint-ds.tokens.json`)                       |
| `--report <file>`   | Also write the raw `AuditReport` JSON for inspection                      |
| `--provider <name>` | LLM backend: `anthropic` (default), `ollama`, or `openrouter`             |
| `--api-key <value>` | LLM provider API key (overrides all API key env vars)                     |
| `--model <name>`    | Model name (overrides all model env vars)                                 |
| `--url <url>`       | API endpoint URL (overrides all URL env vars)                             |
| `--quiet`           | Skip the chaos summary printout                                           |
| `--no-cache`        | Skip the cache lookup and overwrite any existing cache entry for this CSS |

### Cache

`mint-ds` automatically caches audit results in `mint-ds.cache.json` (keyed by a SHA-256 hash of the preprocessed CSS). Subsequent runs on unchanged CSS skip the Claude API call entirely.

```bash
# Force a fresh audit, ignoring the cache
mint-ds audit ./src/styles --no-cache

# Inspect or clear the local cache
mint-ds cache           # list cached entries with their timestamps
mint-ds cache --clear   # delete mint-ds.cache.json
```

Add `mint-ds.cache.json` to `.gitignore` if you don't want to commit it.

### Export options

| Flag                | Description                                                                                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--target <name>`   | **Required.** Accepts: `tailwind`, `unocss`, `react`, `vue`, `svelte`, `astro`, `css`, `scss`, `ts`, `css-modules`, `styled`, `emotion`, `vanilla-extract`, `angular`, `angular-legacy`, `solidjs`, `qwik`, `dtcg`, `design-md` (full names like `tailwind-config`, `react-component` also work) |
| `--tokens <file>`   | Tokens input path (default: `mint-ds.tokens.json`)                                                                                                                                                                                                                                               |
| `--out <file>`      | Override the default output filename                                                                                                                                                                                                                                                             |
| `--provider <name>` | LLM backend: `anthropic` (default), `ollama`, or `openrouter`                                                                                                                                                                                                                                    |
| `--api-key <value>` | LLM provider API key (overrides all API key env vars)                                                                                                                                                                                                                                            |
| `--model <name>`    | Model name (overrides all model env vars)                                                                                                                                                                                                                                                        |
| `--url <url>`       | API endpoint URL (overrides all URL env vars)                                                                                                                                                                                                                                                    |
| `--stdout`          | Print to stdout instead of writing a file                                                                                                                                                                                                                                                        |

### Local development without publishing

The CLI runs straight from a clone:

```bash
git clone https://github.com/nujovich/mint.git && cd mint
export API_KEY=sk-ant-...
node bin/mint-ds.mjs audit ./examples/site
node bin/mint-ds.mjs export --target tailwind
# or use a local LLM via Ollama — no API key needed
node bin/mint-ds.mjs audit ./examples/site --provider ollama
# or `npm link` to expose `mint-ds` globally for testing.
```

## Export formats

| Category   | Formats                                                                                |
| ---------- | -------------------------------------------------------------------------------------- |
| Tokens     | CSS Custom Properties, SCSS Variables, JS/TS Object                                    |
| Frameworks | Tailwind Config, Styled Components, Emotion Theme, CSS Modules, Vanilla Extract        |
| Components | React + TypeScript, Vue 3 SFC, Svelte, Astro, Angular, Angular (Legacy), SolidJS, Qwik |
| Interop    | DTCG (Design Tokens Format Module v1) — for Penpot & Tokens Studio                     |
| Docs       | DESIGN.md — human-readable design system summary for AI-assisted workflows             |

## Penpot & DTCG interop

The `dtcg` target is a deterministic converter — it transforms `mint-ds.tokens.json`
into a [W3C DTCG Format Module v1](https://www.designtokens.org/TR/2025.10/format/)
file without calling an LLM, so the output is byte-stable and safe to run in CI.

```bash
# Emit DTCG JSON next to your tokens (writes mint-ds.tokens.dtcg.json)
npx mint-ds export --target dtcg --tokens mint-ds.tokens.json

# ...or print it to stdout
npx mint-ds export --target dtcg --stdout
```

The converter maps every category: colors (as `$type: color`), spacing and
border-radius (`dimension`), box-shadows (DTCG shadow arrays) and typography
(font-family / font-weight groups). A worked example lives at
[`examples/frankenstein/mint-ds.tokens.dtcg.json`](examples/frankenstein/mint-ds.tokens.dtcg.json).
Gate the output in CI with `mint-ds validate <file> --spec dtcg` — ready-made
templates live in [`templates/dtcg/`](templates/dtcg/).

### Import into Penpot

Penpot's design tokens adhere to the W3C DTCG format, so the file imports natively:

1. Open the **Tokens** tab in the left panel of your Penpot file.
2. Click **Tools** at the bottom of the panel, then choose **Import**.
3. Select the exported `mint-ds.tokens.dtcg.json`.

Penpot reads the first-level keys of a single JSON file as **set names**, so Mint's
output lands as five token sets — `color`, `spacing`, `border-radius`, `shadow`
and `typography`. (Prefer a different set layout? Import a `.zip` with one JSON
file per folder instead.)

> Note: Penpot's token _export_ currently emits Tokens Studio format rather than
> DTCG, but DTCG _import_ — the direction Mint feeds — is fully supported.

### Import into Tokens Studio for Figma

The [Tokens Studio](https://tokens.studio/) Figma plugin reads the same file:

1. In the plugin, open **Settings** and set the token format to **W3C DTCG** (the
   plugin converts between DTCG and its legacy format on demand).
2. Switch the token view to the **JSON** editor and paste the contents of
   `mint-ds.tokens.dtcg.json`, or point a remote (GitHub / GitLab) storage
   provider at the committed file.

Because DTCG is a shared spec, the same file is also consumable by Style Dictionary
and any other DTCG-aware tool — zero vendor-specific code.

## Stack

- [Next.js 15](https://nextjs.org/) — App Router, API routes
- [React 18](https://react.dev/) — Client components
- [TypeScript](https://www.typescriptlang.org/)
- [Claude API](https://docs.anthropic.com/) — `claude-sonnet-4-20250514` for audit, resolve, and export generation by default; [Ollama](https://ollama.com/) and [OpenRouter](https://openrouter.ai/) are also supported as alternatives via `--provider ollama` or `--provider openrouter`

## Getting started

### Prerequisites

- Node.js 20+ (the CLI uses native `fetch` and recursive `fs.readdir`)
- An [Anthropic API key](https://console.anthropic.com/) or [OpenRouter API key](https://openrouter.ai/keys)

### Setup

```bash
git clone https://github.com/your-org/mint.git
cd mint
npm install
cp .env.local.example .env.local
# Add your key: API_KEY=sk-ant-...
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Mint resolves configuration through a precedence chain: **CLI flag > per-provider env var > generic env var > provider default**.

### API keys

| Variable             | Description                                   |
| -------------------- | --------------------------------------------- |
| `ANTHROPIC_API_KEY`  | Anthropic API key                             |
| `OPENROUTER_API_KEY` | OpenRouter API key                            |
| `OLLAMA_API_KEY`     | Ollama API key (optional — Ollama needs none) |
| `API_KEY`            | Universal fallback for all providers          |

Precedence: `--api-key` > `{PROVIDER}_API_KEY` > `API_KEY` > provider default (none for Anthropic/OpenRouter, undefined for Ollama).

### Model name

| Variable                | Description                          |
| ----------------------- | ------------------------------------ |
| `ANTHROPIC_MODEL_NAME`  | Model name for Anthropic             |
| `OPENROUTER_MODEL_NAME` | Model name for OpenRouter            |
| `OLLAMA_MODEL_NAME`     | Model name for Ollama                |
| `LLM_MODEL_NAME`        | Universal fallback for all providers |

Precedence: `--model` > `{PROVIDER}_MODEL_NAME` > `LLM_MODEL_NAME` > provider default.

### API URL

| Variable             | Description                          |
| -------------------- | ------------------------------------ |
| `ANTHROPIC_API_URL`  | API endpoint for Anthropic           |
| `OPENROUTER_API_URL` | API endpoint for OpenRouter          |
| `OLLAMA_API_URL`     | API endpoint for Ollama              |
| `LLM_API_URL`        | Universal fallback for all providers |

Precedence: `--url` > `{PROVIDER}_API_URL` > `LLM_API_URL` > provider default.

## Project structure

```
bin/
  mint.mjs             — CLI entry point (audit + export commands)
app/
  api/
    audit/route.ts     — POST /api/audit   → AuditReport
    resolve/route.ts   — POST /api/resolve → DSTokens
    export/route.ts    — POST /api/export  → generated code string
  page.tsx             — 3-step playground wizard + CLI promo
  layout.tsx
  globals.css
components/
  CssInput.tsx         — Step 1: paste or upload CSS
  AuditView.tsx        — Step 2: review clusters, fonts, spacing
  TokenPreview.tsx     — Step 3: visual token preview
  ExportPanel.tsx      — Step 3: format picker + code viewer
  CliPromo.tsx         — "Try the CLI" block on the playground root
  StepBar.tsx          — Progress indicator
  CoffeeLoader.tsx     — Full-screen loading overlay
  CodeViewer.tsx       — Syntax-highlighted code output
lib/
  types.ts             — DSTokens, AuditReport, ExportTarget and all shared types
  prompts.mjs          — Prompt builders + Claude helper, shared by API routes and CLI
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
