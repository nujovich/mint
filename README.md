# Mint

**Mint** audits your legacy CSS and generates a clean, exportable design system from the chaos.

Paste any CSS, SCSS, or HTML — messy legacy code, Bootstrap overrides, years of accumulated styles. Claude identifies near-duplicate color clusters, off-scale spacing values, and mixed font families. You review the analysis, decide what to keep, and Mint generates canonical design tokens ready to ship.

## How it works

```
CSS / SCSS / HTML  →  Claude Audit  →  Review & curate  →  Clean tokens  →  Export
```

1. **Audit** — Claude analyzes your CSS, groups near-duplicate colors into clusters, detects fonts, and flags spacing values that don't fit a 4px grid.
2. **Curate** — Review each cluster. Pick the canonical color, rename tokens, include or exclude entries, and select which fonts to keep.
3. **Export** — Generate production-ready output in any format.

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

- Node.js 18+
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
app/
  api/
    audit/route.ts     — POST /api/audit   → AuditReport
    resolve/route.ts   — POST /api/resolve → DSTokens
    export/route.ts    — POST /api/export  → generated code string
  page.tsx             — 3-step wizard state machine
  layout.tsx
  globals.css
components/
  CssInput.tsx         — Step 1: paste or upload CSS
  AuditView.tsx        — Step 2: review clusters, fonts, spacing
  TokenPreview.tsx     — Step 3: visual token preview
  ExportPanel.tsx      — Step 3: format picker + code viewer
  StepBar.tsx          — Progress indicator
  CoffeeLoader.tsx     — Full-screen loading overlay
  CodeViewer.tsx       — Syntax-highlighted code output
lib/
  types.ts             — DSTokens, AuditReport, ExportTarget and all shared types
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
