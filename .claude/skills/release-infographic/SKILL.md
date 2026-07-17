---
name: release-infographic
description: Use when the user wants to generate a visual summary / infographic / release card of what ships in a mint release. Reads CHANGELOG.md, editorializes the changes, and renders a mint-branded PNG. Trigger on "release infographic", "release card", "infografía del release", or before publishing a version.
---

# Release Infographic

Generate a mint-branded PNG summarizing what ships in a release, from `CHANGELOG.md`.

This is a skill (invoked by Claude), NOT an automatic hook. It does not fire on `npm run release`. Claude applies editorial judgment: picking highlights, writing punchy copy, choosing a layout.

## Files in this skill

- `template.html` — mint-branded shell with `{{version}}`, `{{date}}`, `{{tagline}}`, `{{body}}`, `{{stats}}` placeholders.
- `render.mjs` — HTML→PNG renderer. Run: `node <skill>/render.mjs <htmlPath> <outPath> [width]`.
- `EXTEND.md` — optional pinned preferences (read it first if present).

## Workflow

1. **Load preferences.** If `EXTEND.md` exists in this skill dir, read it for `layout`, `language`, `tagline`, `width` defaults.
2. **Resolve the target version.** Default: the topmost released version section in `CHANGELOG.md`. If preparing a release, use the `## [Unreleased]` section. Accept an explicit version if the user names one.
3. **Parse the changelog section** into buckets: Features, Bug Fixes, Performance, Refactoring, Documentation (mirrors `.release-it.json` sections).
4. **Editorialize:**
   - Write a one-line `tagline` capturing the release's theme (or use the pinned one).
   - Rewrite each changelog item as a short, punchy line (≈ 6–12 words). Wrap identifiers/commands in `<code>…</code>` (e.g. `<code>mint-ds lint</code>`).
   - Compute `stats`, e.g. `3 features · 1 fix`.
   - Pick a layout preset (see below) based on the release shape.
5. **Build `{{body}}`** using the chosen preset's markup (below).
6. **Fill the template.** Read `template.html`, replace every placeholder, write the filled HTML to `release-assets/v<version>.html`.
7. **Render.** Run `node .claude/skills/release-infographic/render.mjs release-assets/v<version>.html release-assets/v<version>.png <width>`.
8. **Report.** Show the user the PNG path and a one-line summary. Confirm no content was clipped.

## Layout presets (for `{{body}}`)

Pick by release shape. All markup goes inside `{{body}}`.

### `bento` (default) — mixed release with several categories

```html
<div class="bento">
  <div class="card wide">
    <h3>Features</h3>
    <ul>
      <li>Short punchy line with <code>identifier</code></li>
    </ul>
  </div>
  <div class="card">
    <h3>Bug Fixes</h3>
    <ul>
      <li>...</li>
    </ul>
  </div>
</div>
```

Use `card wide` (full-width) for the most important category, plain `card` for the rest.

### `linear` — a few sequential highlights that tell a story

```html
<div class="linear">
  <div class="step">
    <span class="num">01</span>
    <div>First highlight line.</div>
  </div>
  <div class="step">
    <span class="num">02</span>
    <div>Second highlight line.</div>
  </div>
</div>
```

### `dashboard` — "by the numbers" maintenance release

```html
<div class="tiles">
  <div class="tile">
    <div class="n">3</div>
    <div class="l">Features</div>
  </div>
  <div class="tile">
    <div class="n">1</div>
    <div class="l">Fixes</div>
  </div>
  <div class="tile">
    <div class="n">12</div>
    <div class="l">Commits</div>
  </div>
</div>
<div class="bento">
  <div class="card wide">
    <h3>Highlights</h3>
    <ul>
      <li>...</li>
    </ul>
  </div>
</div>
```

## Output

- PNG: `release-assets/v<version>.png` (versioned in git; auto-excluded from the npm tarball because `package.json#files` is an explicit allowlist).
- HTML record: `release-assets/v<version>.html` (reproducibility — regenerate without re-editorializing).

## Guardrails

- Never let an image model render this — text accuracy and exact brand tokens matter. Always use `render.mjs`.
- Keep technical identifiers exact (`mint-ds lint`, `gap-rule-color`, `--no-semantic`). Do not paraphrase them.
- Artifact copy is English by default (repo convention), unless `EXTEND.md` sets another language.
