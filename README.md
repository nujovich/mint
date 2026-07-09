# Mint 🎨

**Mint** audits your legacy CSS and generates a clean, exportable design system from the chaos.

It ships in two flavors:

- **CLI** — `npx mint-ds audit ./src/styles && npx mint-ds export --target tailwind`. Run it against a whole directory, scriptable, no UI.
- **Web playground** — paste a snippet, walk through the 3-step wizard, preview tokens visually before exporting.

Both share the same prompts and Claude pipeline.

## How it works

```
CSS / SCSS / HTML  →  Claude Audit  →  Review & curate  →  Clean tokens  →  Export
```

1. **Audit** — Claude analyzes your CSS, groups near-duplicate colors into clusters, detects fonts, flags spacing values that don't fit a 4px grid, identifies duplicate transition/animation declarations, and lints layout patterns for accessibility and modern-CSS pitfalls (see [CSS layout linting](#css-layout-linting)).
2. **Curate** — Review each cluster. Pick the canonical color, rename tokens, include or exclude entries, and select which fonts to keep. (CLI applies sensible defaults: include every cluster, keep non-system fonts, use the suggested 4px scale.)
3. **Export** — Generate production-ready output in any format.

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

> **Pre-release.** `mint-ds` isn't on npm yet, so the `npx mint-ds …` commands below won't resolve. Run it from a clone or use `npm link` while we're publishing — see [Local development without publishing](#local-development-without-publishing).

```bash
# Analyze every CSS/SCSS/HTML file in a directory and write mint-ds.tokens.json
npx mint-ds audit ./src/styles

# Generate exports from the resulting tokens
npx mint-ds export --target tailwind     # → tailwind.config.js
npx mint-ds export --target react        # → components.tsx
npx mint-ds export --target css          # → variables.css
```

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

| Command                          | Description                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `mint-ds audit <dir>`            | Walk `<dir>` for `.css`, `.scss`, `.sass`, `.less`, `.html` files, audit them with Claude, and write `mint-ds.tokens.json` |
| `mint-ds export --target <name>` | Read `mint-ds.tokens.json` and generate the chosen format                                                                  |
| `mint-ds validate <file>`        | Validate `tokens.json` against DTCG v1 — structure, references, cycles, naming consistency                                 |
| `mint-ds cache --clear`          | Delete the local `mint-ds.cache.json` cache file                                                                           |
| `mint-ds --help`                 | Show full usage                                                                                                            |

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

| Flag                | Description                                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--target <name>`   | **Required.** Accepts: `tailwind`, `react`, `vue`, `svelte`, `astro`, `css`, `scss`, `ts`, `css-modules`, `styled`, `emotion` (full names like `tailwind-config`, `react-component` also work) |
| `--tokens <file>`   | Tokens input path (default: `mint-ds.tokens.json`)                                                                                                                                             |
| `--out <file>`      | Override the default output filename                                                                                                                                                           |
| `--provider <name>` | LLM backend: `anthropic` (default), `ollama`, or `openrouter`                                                                                                                                  |
| `--api-key <value>` | LLM provider API key (overrides all API key env vars)                                                                                                                                          |
| `--model <name>`    | Model name (overrides all model env vars)                                                                                                                                                      |
| `--url <url>`       | API endpoint URL (overrides all URL env vars)                                                                                                                                                  |
| `--stdout`          | Print to stdout instead of writing a file                                                                                                                                                      |

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

| Category   | Formats                                                        |
| ---------- | -------------------------------------------------------------- |
| Tokens     | CSS Custom Properties, SCSS Variables, JS/TS Object            |
| Frameworks | Tailwind Config, Styled Components, Emotion Theme, CSS Modules |
| Components | React + TypeScript, Vue 3 SFC, Svelte, Astro                   |

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
