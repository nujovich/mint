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
