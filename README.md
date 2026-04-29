# Mint

**Mint** audits your legacy CSS and generates a clean, exportable design system from the chaos.

It ships in two flavors:

- **CLI** — `npx mint-ds audit ./src/styles && npx mint-ds export --target tailwind`. Run it against a whole directory, scriptable, no UI.
- **Web playground** — paste a snippet, walk through the 3-step wizard, preview tokens visually before exporting.

Both share the same prompts and Claude pipeline.

## How it works

```
CSS / SCSS / HTML  →  Claude Audit  →  Review & curate  →  Clean tokens  →  Export
```

1. **Audit** — Claude analyzes your CSS, groups near-duplicate colors into clusters, detects fonts, and flags spacing values that don't fit a 4px grid.
2. **Curate** — Review each cluster. Pick the canonical color, rename tokens, include or exclude entries, and select which fonts to keep. (CLI applies sensible defaults: include every cluster, keep non-system fonts, use the suggested 4px scale.)
3. **Export** — Generate production-ready output in any format.

## Example — Frankenstein

A bundled example of the kind of CSS that grows organically over a few years: the **same blue declared in 6 aliases**, the **same Arial family duplicated across 5 selectors**, spacing values like `7px`, `11px`, `13px`, `17px`, `19px` mixed with `rem` and `em`, and `!important` everywhere. Full input in [`examples/frankenstein/styles.css`](examples/frankenstein/styles.css).

### Before — `examples/frankenstein/styles.css`

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

### What Mint sees

| Signal | What's in the source | What Mint outputs |
|---|---|---|
| **Colors** | 6 aliases for `#1976d2`, 3 for `#e53935`, 3 for `#f5f5f5`, 3 for `#212121`, 3 for `#dddddd` — all formatted differently (hex caps, hex lower, `rgb`, `rgba`, `hsl`, `#DDD` shorthand) | 7 named colors (`primary`, `error`, `background`, `text`, `border`, `surface`, `muted`), each with a 50–900 scale |
| **Fonts** | 5 `font-family` declarations, all Arial-family permutations | 1 body family |
| **Spacing** | 20+ values mixed across `px` / `rem` / `em`, including primes `7`, `11`, `13`, `17`, `19` | 5-step scale snapped to 4px: `4 / 8 / 12 / 20 / 24` |
| **Border radius** | `4px` and `8px` scattered with `!important` | `sm: 4px`, `md: 8px` |
| **Shadows** | `.shadow` and `.shadow-md` define the same value twice | one `sm` token |
| **Weights** | `bold` and `700` declared as separate utilities (same thing) | `bold: 700`, `extrabold: 800` |

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
        "50":  "#e3f2fd", "100": "#bbdefb", "200": "#90caf9",
        "300": "#64b5f6", "400": "#42a5f5", "500": "#1976d2",
        "600": "#1565c0", "700": "#0d47a1", "800": "#0a3f8f", "900": "#08357d"
      }
    },
    { "name": "error",      "value": "#e53935", "scale": { "50": "#ffebee", "...": "...", "900": "#a01818" } },
    { "name": "background", "value": "#f5f5f5", "scale": { "50": "#fefefe", "...": "...", "900": "#a8a8a8" } },
    { "name": "text",       "value": "#212121", "scale": { "50": "#f5f5f5", "...": "...", "900": "#141414" } },
    { "name": "border",     "value": "#dddddd", "scale": { "50": "#f9f9f9", "...": "...", "900": "#6c6c6c" } },
    { "name": "surface",    "value": "#ffffff", "scale": { "50": "#ffffff", "...": "...", "900": "#999999" } },
    { "name": "muted",      "value": "#666666", "scale": { "50": "#f2f2f2", "...": "...", "900": "#333333" } }
  ],
  "typography": {
    "fontFamilies": { "body": "Helvetica Neue" },
    "fontWeights":  { "bold": 700, "extrabold": 800 }
  },
  "spacing":      { "1": "4px", "2": "8px", "3": "12px", "5": "20px", "6": "24px" },
  "borderRadius": { "sm": "4px", "md": "8px" },
  "shadows":      { "sm": "0 2px 4px rgba(0,0,0,0.1)" }
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
    './app/**/*.{html,js,jsx,ts,tsx,vue}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e3f2fd', 100: '#bbdefb', /* …300–800 */ 900: '#08357d',
          DEFAULT: '#1976d2'
        },
        // error, background, text, border, surface, muted — same shape
      },
      fontFamily: {
        display: ['Helvetica Neue', 'sans-serif'],
        body:    ['Helvetica Neue', 'sans-serif']
      },
      spacing:      { '1': '4px', '2': '8px', '3': '12px', '5': '20px', '6': '24px' },
      borderRadius: { sm: '4px', md: '8px' },
      boxShadow:    { sm: '0 2px 4px rgba(0,0,0,0.1)' }
    }
  },
  safelist: ['bg-primary-500', 'text-error-500', /* … */ 'font-extrabold'],
  plugins: []
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
# Analyze every CSS/SCSS/HTML file in a directory and write mint-ds.tokens.json
npx mint-ds audit ./src/styles

# Generate exports from the resulting tokens
npx mint-ds export --target tailwind     # → tailwind.config.js
npx mint-ds export --target react        # → components.tsx
npx mint-ds export --target css          # → variables.css
```

### Authentication

Every command needs an Anthropic API key. You have two options — pick whichever fits your workflow:

**Option 1 — pass it per-command with `--api-key`:**

```bash
npx mint-ds audit ./src/styles --api-key sk-ant-...
```

Useful for one-off runs, CI jobs, or when you don't want the key persisted in your shell.

**Option 2 — set the `ANTHROPIC_API_KEY` env var.** Syntax depends on your shell:

| Shell | Command |
|-------|---------|
| bash / zsh / sh (macOS, Linux, WSL) | `export ANTHROPIC_API_KEY=sk-ant-...` |
| fish | `set -gx ANTHROPIC_API_KEY sk-ant-...` |
| PowerShell (Windows / pwsh) | `$env:ANTHROPIC_API_KEY = "sk-ant-..."` |
| Windows CMD | `set ANTHROPIC_API_KEY=sk-ant-...` |

These commands set the key only for the current shell session. To persist it, add the line to your shell rc file (`~/.bashrc`, `~/.zshrc`, `~/.config/fish/config.fish`, your PowerShell `$PROFILE`, etc.) or use the system Environment Variables dialog on Windows.

`--api-key` always wins over the env var when both are present. Get a key at [console.anthropic.com](https://console.anthropic.com).

### All commands

| Command | Description |
|---------|-------------|
| `mint-ds audit <dir>` | Walk `<dir>` for `.css`, `.scss`, `.sass`, `.less`, `.html` files, audit them with Claude, and write `mint-ds.tokens.json` |
| `mint-ds export --target <name>` | Read `mint-ds.tokens.json` and generate the chosen format |
| `mint-ds --help` | Show full usage |

### Audit options

| Flag | Description |
|------|-------------|
| `--out <file>` | Tokens output path (default: `mint-ds.tokens.json`) |
| `--report <file>` | Also write the raw `AuditReport` JSON for inspection |
| `--quiet` | Skip the chaos summary printout |

### Export options

| Flag | Description |
|------|-------------|
| `--target <name>` | **Required.** Accepts: `tailwind`, `react`, `vue`, `svelte`, `astro`, `css`, `scss`, `ts`, `css-modules`, `styled`, `emotion` (full names like `tailwind-config`, `react-component` also work) |
| `--tokens <file>` | Tokens input path (default: `mint-ds.tokens.json`) |
| `--out <file>` | Override the default output filename |
| `--stdout` | Print to stdout instead of writing a file |

### Local development without publishing

The CLI runs straight from a clone:

```bash
git clone https://github.com/nujovich/mint.git && cd mint
export ANTHROPIC_API_KEY=sk-ant-...
node bin/mint-ds.mjs audit ./examples/site
node bin/mint-ds.mjs export --target tailwind
# or `npm link` to expose `mint-ds` globally for testing.
```

## Export formats

| Category | Formats |
|----------|---------|
| Tokens | CSS Custom Properties, SCSS Variables, JS/TS Object |
| Frameworks | Tailwind Config, Styled Components, Emotion Theme, CSS Modules |
| Components | React + TypeScript, Vue 3 SFC, Svelte, Astro |

## Stack

- [Next.js 15](https://nextjs.org/) — App Router, API routes
- [React 18](https://react.dev/) — Client components
- [TypeScript](https://www.typescriptlang.org/)
- [Claude API](https://docs.anthropic.com/) — `claude-sonnet-4-20250514` for audit, resolve, and export generation

## Getting started

### Prerequisites

- Node.js 20+ (the CLI uses native `fetch` and recursive `fs.readdir`)
- An [Anthropic API key](https://console.anthropic.com/)

### Setup

```bash
git clone https://github.com/your-org/mint.git
cd mint
npm install
cp .env.local.example .env.local
# Add your key: ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key — get one at [console.anthropic.com](https://console.anthropic.com) |

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
