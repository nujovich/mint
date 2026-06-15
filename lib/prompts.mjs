// Shared prompt builders + Anthropic helper.
// Imported by Next.js API routes (lib/types.ts holds the matching TS types)
// and by the CLI in bin/mint-ds.mjs. Keep this file dependency-free so it runs
// in plain Node without a build step.

import { preprocessCss } from './css-utils.mjs'
export { preprocessCss }

export const AUDIT_SYSTEM_PROMPT = `You are an expert design-system auditor with deep knowledge of CSS architecture, design tokens, and visual consistency. Your role is to analyze CSS codebases, identify color, typography, and spacing patterns, and surface actionable data for design system extraction.

You produce precise, complete JSON reports. You never skip values, never estimate counts, and never invent data not present in the source. When uncertain about a color cluster's semantic role, choose the closest match from the allowed list rather than leaving it blank.`

export function buildAuditPrompt(css) {
  const processed = preprocessCss(css)
  const content = `<css_source>
${processed.slice(0, 60000)}
</css_source>

<instructions>
Analyze the CSS source above and produce a JSON AuditReport. Work through each step completely and in order before writing the output.

STEP 1 — COLORS
Scan every color value: hex (#rgb, #rrggbb, #rrggbbaa), rgb(), rgba(), hsl(), hsla(). For each distinct value, count its exact appearances and record up to 3 CSS selectors or property names where it is used (contexts).

Group values into clusters of near-duplicates using this rule: two values are near-duplicates when their difference on any single HSL channel is ≤ 15 (hue degrees or percentage points on saturation/lightness). Per cluster:
- "id": "cluster-N" where N is a zero-based sequential integer
- "representative": the single most-used value; if tied, pick the most-saturated one
- "samples": every distinct value in the cluster, each with "hex" (converted to #rrggbb format), "usageCount", and up to 3 "contexts"
- "suggestedName": the semantic role — pick exactly one from: primary, secondary, accent, background, surface, text, muted, border, error, success, warning, info

Cap at 14 clusters maximum. If more exist, merge the two smallest (by total usageCount) into their nearest neighbor until you reach 14.

STEP 2 — FONTS
Collect every distinct font-family value. For each:
- "family": exact font name as written in the CSS
- "usages": up to 5 CSS selectors or rule contexts where this font appears
- "isSystemFont": true only for these names: Arial, Helvetica, Georgia, Times, Times New Roman, Courier, Courier New, Verdana, Tahoma, Trebuchet MS, Impact, system-ui, -apple-system, BlinkMacSystemFont, ui-sans-serif, ui-serif, ui-monospace, sans-serif, serif, monospace, cursive, fantasy

STEP 3 — SPACING
Collect every distinct numeric px value from these CSS properties: margin, margin-top, margin-right, margin-bottom, margin-left, padding, padding-top, padding-right, padding-bottom, padding-left, gap, column-gap, row-gap, top, right, bottom, left.
Exclude: 0, percentages (%), auto, and any non-px unit (em, rem, vh, vw, vmin, vmax, ch, ex).

- "found": all distinct values sorted ascending as strings (e.g. ["4px", "7px", "8px"])
- "suggestedScale": map of scale step → px value, include only steps that match at least one found value: 1→4px, 2→8px, 3→12px, 4→16px, 5→20px, 6→24px, 8→32px, 10→40px, 12→48px, 16→64px, 20→80px, 24→96px
- "nonScaleValues": values from "found" that are NOT divisible by 4

STEP 4 — LINE-HEIGHT
Collect every distinct line-height value from the CSS. Scan for:
- The line-height property (all values — unitless numbers like 1.2, length values like 20px, percentages)
- The shorthand "font: …/<value>" where space-slash precedes the line-height (e.g. "font: 14px/1.5 Inter" or "font: 700 16px/24px sans-serif")

Normalize all values to their canonical representation:
- Keep unitless numbers as numbers (1.2, 1.5, 1.75)
- Convert px values to numbers by dividing by the author's body font-size if detectable, otherwise divide by 16
- Round to 2 decimal places

- "found": all distinct normalized values sorted ascending as numbers (e.g. [1.2, 1.25, 1.5, 1.75])
- "suggestedScale": map each found value to the closest canonical key from this fixed set:
  tight (1.0–1.2), snug (1.21–1.4), normal (1.41–1.6), relaxed (1.61–1.8), loose (1.81+)
  Only include values that actually appear in "found". If multiple found values map to the same key, keep the one closest to the key's midpoint.
- "unitlessMix": true if some values in "found" are unitless numbers AND others are px-derived (e.g. [1.2, 20] means 1.2 is unitless and 20 was px-derived)

STEP 5 — CHAOS SCORE
Compute a deterministic integer from 1–10. Start at 1, then add:
- +2 if colorClusters.length > 8
- +1 if colorClusters.length > 5 (stacks with the above)
- +2 if nonScaleValues.length > 10
- +1 if nonScaleValues.length > 5 (stacks with the above)
- +2 if count of non-system fonts (isSystemFont === false) > 3
- +1 if count of non-system fonts > 1 (stacks with the above)
- +1 if lineHeights.unitlessMix is true
Cap the final result at 10.

STEP 6 — SUMMARY
Write 1–2 sentences naming the top quality issues. Be specific: cite actual counts (e.g. "9 color clusters including 4 near-duplicate grays", "17 off-scale spacing values", "5 line-height values mixing unitless and px units").

STEP 7 — BRAND
Infer a project name from CSS comments, HTML title elements, BEM block prefixes, CSS variable namespaces (e.g. --myapp-*), or @layer names. Return "" if nothing identifiable is found.
</instructions>

<output_format>
Return ONLY a valid JSON object matching the structure in the example below. No markdown fences, no backticks, no text before or after the JSON.

<example>
{
  "brand": "project name or empty string",
  "chaosScore": 7,
  "summary": "The codebase has 6 near-duplicate blue shades and 23 off-scale spacing values indicating significant design debt.",
  "colorClusters": [
    {
      "id": "cluster-0",
      "suggestedName": "primary",
      "representative": "#1a73e8",
      "samples": [
        { "hex": "#1a73e8", "usageCount": 12, "contexts": [".btn-primary", "--color-brand", "a:hover"] },
        { "hex": "#1b74e9", "usageCount": 3, "contexts": [".header-logo"] }
      ]
    }
  ],
  "fonts": [
    { "family": "Inter", "usages": ["body", "h1", ".card"], "isSystemFont": false },
    { "family": "sans-serif", "usages": ["*"], "isSystemFont": true }
  ],
  "spacing": {
    "found": ["4px", "7px", "8px", "13px", "16px", "24px"],
    "suggestedScale": { "1": "4px", "2": "8px", "4": "16px", "6": "24px" },
    "nonScaleValues": ["7px", "13px"]
  },
  "lineHeights": {
    "found": [1.2, 1.25, 1.5, 1.75],
    "suggestedScale": { "tight": 1.2, "snug": 1.25, "normal": 1.5, "relaxed": 1.75 },
    "unitlessMix": true
  }
}
</example>
</output_format>`
  return { content, system: AUDIT_SYSTEM_PROMPT }
}

export function buildResolvePrompt(css, decisions) {
  const content = `You are a design system token generator. Given the original CSS and user curation decisions, produce a clean DSTokens JSON.

ORIGINAL CSS:
${String(css).slice(0, 50000)}

USER DECISIONS:
${JSON.stringify(decisions, null, 2)}

Rules:
- decisions.colors: only include entries where include === true. Use the provided "name" as the token name and "value" as the hex color.
- decisions.fonts: first font = "body", second = "display" (if present). If any font name contains "mono", "code", or "courier", use it as "mono".
- decisions.spacingScale: use directly as the spacing token map (e.g. { "1": "4px", "2": "8px", ... }).
- Extract border-radius values from the CSS. Normalize to these named keys: sm (2-4px), md (6-8px), lg (10-14px), xl (16-20px), 2xl (24px+), full (9999px or 50%). Include only the keys you find evidence for.
- Extract box-shadow values from the CSS. Normalize to: sm, md, lg, xl. Include only found values.
- Extract font-size values from the CSS. Normalize to semantic keys: xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl. Base ≈ 16px. Include only found values.
- Extract font-weight values from the CSS. Normalize to: thin (100), light (300), normal (400), medium (500), semibold (600), bold (700), extrabold (800). Include only found values.
- decisions.lineHeights: use as the line-height token map. Validate against the CSS — drop any key whose normalized CSS value differs by more than 0.15 from the decisions value. If the CSS contains additional line-height values not in the decisions, add them using the canonical key mapping (tight: 1.0–1.2, snug: 1.21–1.4, normal: 1.41–1.6, relaxed: 1.61–1.8, loose: 1.81+).
- Extract line-height values from the CSS if decisions.lineHeights is empty. Normalize to: tight (1–1.2), snug (1.3–1.4), normal (1.5), relaxed (1.6–1.7), loose (2+). Include only found values.
- Generate a 50–900 scale (50, 100, 200, 300, 400, 500, 600, 700, 800, 900) for each included color. The "value" from decisions is the 500. Derive lighter shades by mixing with white and darker shades by mixing with black (adjust luminance accordingly).
- brand: extract from CSS comments, class name prefixes, or CSS variable prefixes. Empty string if not found.

Return ONLY valid JSON matching this exact DSTokens structure. No markdown fences, no explanation.

{
  "brand": "string",
  "colors": [
    {
      "name": "primary",
      "value": "#6366f1",
      "scale": { "50": "#eef2ff", "100": "#e0e7ff", "200": "#c7d2fe", "300": "#a5b4fc", "400": "#818cf8", "500": "#6366f1", "600": "#4f46e5", "700": "#4338ca", "800": "#3730a3", "900": "#312e81" },
      "description": ""
    }
  ],
  "typography": {
    "fontFamilies": { "body": "Inter", "display": "Cal Sans", "mono": "Fira Code" },
    "fontSizes": { "xs": "12px", "sm": "14px", "base": "16px", "lg": "18px", "xl": "20px", "2xl": "24px", "3xl": "30px", "4xl": "36px" },
    "fontWeights": { "normal": 400, "medium": 500, "semibold": 600, "bold": 700 },
    "lineHeights": { "tight": 1.2, "normal": 1.5, "relaxed": 1.7 }
  },
  "spacing": { "1": "4px", "2": "8px", "3": "12px", "4": "16px", "6": "24px", "8": "32px" },
  "borderRadius": { "sm": "4px", "md": "8px", "lg": "12px", "xl": "16px", "full": "9999px" },
  "shadows": { "sm": "0 1px 2px rgba(0,0,0,0.05)", "md": "0 4px 6px rgba(0,0,0,0.1)", "lg": "0 10px 15px rgba(0,0,0,0.1)" }
}`
  return { content, system: null }
}

const EXPORT_PROMPTS = {
  'css-variables': (
    shared
  ) => `Generate a complete CSS file with custom properties for these design tokens.${shared}

Requirements:
- :root { } block with ALL tokens as CSS variables (--color-primary, --color-primary-50, etc.)
- [data-theme="dark"] { } with dark mode overrides for background, surface, text, muted colors
- Group by category with /* === Category === */ comments
- Include @import for Google Fonts if fontFamilies are defined
- Add a /* Usage */ comment at the top with quick examples`,

  'scss-variables': (
    shared
  ) => `Generate a complete SCSS file with variables and mixins for these design tokens.${shared}

Requirements:
- All tokens as $variable-name: value (e.g. $color-primary: #...)
- Grouped by // === Category === comments
- Color maps: $colors-primary: ( 50: #..., 100: #..., ... )
- Mixins: button-base, card, focus-ring, flex-center, truncate, visually-hidden
- Functions: color($name, $step: 500) to access color maps
- @forward and @use compatible structure`,

  'js-tokens': (
    shared
  ) => `Generate a complete TypeScript tokens file for these design tokens.${shared}

Requirements:
- Typed interfaces for each token category
- A const tokens object implementing the interfaces
- Helper functions: getColor(name, scale?), getSpacing(key), getShadow(key)
- Export the tokens object as default
- Export named types for use in other files
- Compatible with both ESM and CJS via dual exports comment`,

  'tailwind-config': (
    shared
  ) => `Generate a complete tailwind.config.js for these design tokens.${shared}

Requirements:
- Full module.exports with theme.extend
- Colors: all color tokens with full scales as nested objects
- fontFamily: display, body, mono
- fontSize with [size, { lineHeight }] tuples
- borderRadius, boxShadow, spacing extending defaults
- A safelist array with the most common generated classes
- darkMode: 'class'
- Add a @type {import('tailwindcss').Config} JSDoc`,

  'styled-components': (
    shared
  ) => `Generate a complete Styled Components theme file in TypeScript for these design tokens.${shared}

Requirements:
- DefaultTheme interface declaration (module augmentation)
- lightTheme and darkTheme objects typed as DefaultTheme
- All token categories: colors (with scales), typography, spacing, radii, shadows
- ThemeProvider usage example in a comment
- Export: { lightTheme, darkTheme, DefaultTheme }`,

  emotion: (
    shared
  ) => `Generate a complete Emotion theme file in TypeScript for these design tokens.${shared}

Requirements:
- Theme interface with all token categories
- lightTheme and darkTheme objects typed as Theme
- useTheme() wrapper hook example
- ThemeProvider usage example in a comment
- Global styles snippet using the theme
- Export: { lightTheme, darkTheme, Theme }`,

  'css-modules': (
    shared
  ) => `Generate a complete CSS Modules file for these design tokens.${shared}

Requirements:
- @value declarations for all token values at the top
- Reusable component classes using the @value tokens:
  .btn, .btn-primary, .btn-secondary, .btn-ghost, .btn-sm, .btn-md, .btn-lg
  .card, .card-elevated, .card-outlined
  .badge, .badge-primary, .badge-secondary
  .input, .input-error
  .text-primary, .text-secondary, .text-muted
- Each class must only use @value references, not hardcoded values`,

  'react-component': (
    shared
  ) => `Generate production-ready React TypeScript components using these design tokens.${shared}

Generate these 4 components in a single file:

Button:
- Props: variant (primary|secondary|ghost|danger), size (sm|md|lg), loading, disabled, fullWidth, onClick, children
- Loading state with spinner SVG
- forwardRef

Card:
- Props: title?, description?, children, variant (default,elevated,outlined), padding (sm|md|lg)

Badge:
- Props: variant (primary|secondary|accent|neutral|success|danger), size (sm|md), children

Input:
- Props: label?, placeholder?, value, onChange, error?, hint?, disabled, type

Requirements:
- Use CSS custom properties (var(--color-primary) etc.) for all styling — no hardcoded values
- Inline styles using the token variable names
- Full TypeScript interfaces with JSDoc
- Named exports for each component`,

  'vue-component': (
    shared
  ) => `Generate production-ready Vue 3 components using these design tokens.${shared}

Generate Button, Card, Badge, and Input components in a single file using Vue's defineComponent per component pattern.

Requirements:
- <script setup lang="ts"> for each component
- defineProps with full TypeScript types and defaults
- computed styleObject using CSS custom property vars
- <style scoped> using var(--token-name) references
- Emit types where relevant (Button onClick, Input onChange)
- Export all 4 components
- Add a "How to register" comment at the top`,

  'svelte-component': (
    shared
  ) => `Generate production-ready Svelte components using these design tokens.${shared}

Generate Button, Card, Badge, and Input as separate component blocks in a single file (separated by // --- ComponentName --- comments so the user can split them).

Requirements:
- <script lang="ts"> with typed export let props
- CSS custom property vars in <style>
- Proper event forwarding with on:click etc.
- Slot usage where appropriate
- Add a usage example in a comment per component`,

  'astro-component': (
    shared
  ) => `Generate production-ready Astro components using these design tokens.${shared}

Generate Button, Card, Badge, and Input as separate .astro component blocks in a single file (separated by // --- ComponentName.astro --- comments so the user can split them into individual files).

Requirements:
- Frontmatter (---) with typed Props interface using TypeScript
- Destructure props with Astro.props and provide defaults
- Use <slot /> for children content where appropriate
- <style> block (scoped by default in Astro) using var(--token-name) CSS custom properties — no hardcoded values
- Button: variant (primary|secondary|ghost|danger), size (sm|md|lg), disabled, type
- Card: title?, description?, variant (default|elevated|outlined)
- Badge: variant (primary|secondary|accent|neutral|success|danger), size (sm|md)
- Input: label?, placeholder?, value?, error?, hint?, disabled, type, name, id
- Add a <!-- Usage example --> comment per component showing how to import and use it
- Make the components compatible with both SSR and static Astro projects`,

  'angular-component': (
    shared
  ) => `Generate production-ready Angular standalone components using these design tokens.${shared}

Generate these 4 standalone components in a single file:

Button:
- Selector: mint-button
- Props: variant (primary|secondary|ghost|danger), size (sm|md|lg), disabled, loading, fullWidth
- Loading state with spinner SVG shown via @if
- Emit a clicked event

Card:
- Selector: mint-card
- Props: title?, description?, variant (default|elevated|outlined), padding (sm|md|lg)
- Project content via <ng-content />

Badge:
- Selector: mint-badge
- Props: variant (primary|secondary|accent|neutral|success|danger), size (sm|md)
- Project content via <ng-content />

Input:
- Selector: mint-input
- Props: label?, placeholder?, value, error?, hint?, disabled, type

Requirements:
- Standalone components with standalone: true
- Signal inputs: input<T>() for required props, input<T>(defaultValue) for optional ones
- Signal outputs: output<T>() for events (e.g. clicked = output<void>())
- Use @if / @for control flow blocks (not *ngIf / *ngFor)
- Inline styles via styles: [...] array using var(--token-name) CSS custom properties — no hardcoded hex/px values
- ChangeDetectionStrategy.OnPush on every component
- host: { ... } for data attributes (e.g. '[attr.data-variant]': 'variant()')
- Add a "// Usage" comment at the top showing how to import and add to standalone imports
- Named exports for each component`,

  'angular-legacy-component': (
    shared
  ) => `Generate production-ready Angular components using the classic @NgModule pattern with these design tokens.${shared}

Generate these 4 classic components plus a MintDesignSystemModule in a single file:

Button:
- Selector: mint-button
- Props: variant (primary|secondary|ghost|danger), size (sm|md|lg), disabled, loading, fullWidth
- Loading state with spinner SVG shown via *ngIf
- Emit an onClick event

Card:
- Selector: mint-card
- Props: title?, description?, variant (default|elevated|outlined), padding (sm|md|lg)
- Project content via <ng-content />

Badge:
- Selector: mint-badge
- Props: variant (primary|secondary|accent|neutral|success|danger), size (sm|md)
- Project content via <ng-content />

Input:
- Selector: mint-input
- Props: label?, placeholder?, value, error?, hint?, disabled, type

Requirements:
- Components use the classic @Component() decorator (no standalone: true)
- @Input() and @Output() decorators for props and events (not signal inputs)
- Use *ngIf / *ngFor structural directives (not @if / @for control flow)
- Inline styles via styles: [...] array using var(--token-name) CSS custom properties — no hardcoded hex/px values
- At the bottom of the file, a MintDesignSystemModule @NgModule that:
  - Imports CommonModule and FormsModule
  - Declares all 4 components
  - Exports all 4 components
- Add a "// Usage" comment at the top showing how to import MintDesignSystemModule and add to @NgModule.imports
- Named exports for each component and the module`,
}

export function buildExportPrompt(tokens, target) {
  const builder = EXPORT_PROMPTS[target]
  if (!builder) return null
  const shared = `\n\nDesign tokens:\n${JSON.stringify(tokens, null, 2)}\n\nReturn ONLY the code, no markdown fences, no explanation.`
  return { content: builder(shared), system: null }
}

// File-naming metadata for CLI output. UI metadata (label, description,
// category) lives in lib/types.ts so the playground can group nicely.
export const EXPORT_OUTPUT = {
  'css-variables': { filename: 'variables', ext: 'css' },
  'scss-variables': { filename: '_tokens', ext: 'scss' },
  'js-tokens': { filename: 'tokens', ext: 'ts' },
  'tailwind-config': { filename: 'tailwind.config', ext: 'js' },
  'styled-components': { filename: 'theme', ext: 'ts' },
  emotion: { filename: 'theme', ext: 'ts' },
  'css-modules': { filename: 'tokens', ext: 'module.css' },
  'react-component': { filename: 'components', ext: 'tsx' },
  'vue-component': { filename: 'components', ext: 'vue' },
  'svelte-component': { filename: 'components', ext: 'svelte' },
  'astro-component': { filename: 'components', ext: 'astro' },
  'angular-component': { filename: 'components', ext: 'ts' },
  'angular-legacy-component': { filename: 'components.module', ext: 'ts' },
}

// Short aliases the CLI accepts for --target.
export const TARGET_ALIASES = {
  css: 'css-variables',
  scss: 'scss-variables',
  sass: 'scss-variables',
  js: 'js-tokens',
  ts: 'js-tokens',
  tokens: 'js-tokens',
  tailwind: 'tailwind-config',
  styled: 'styled-components',
  'css-modules': 'css-modules',
  modules: 'css-modules',
  emotion: 'emotion',
  react: 'react-component',
  vue: 'vue-component',
  svelte: 'svelte-component',
  astro: 'astro-component',
  angular: 'angular-component',
  'angular-legacy': 'angular-legacy-component',
}

// Curated short list shown in --help and validation errors. Keeps the public
// surface friendly; full alias map above remains accepted by resolveTarget.
export const ADVERTISED_TARGETS = [
  'tailwind',
  'react',
  'vue',
  'svelte',
  'astro',
  'css',
  'scss',
  'ts',
  'css-modules',
  'styled',
  'emotion',
  'angular',
  'angular-legacy',
]

export function resolveTarget(input) {
  if (!input) return null
  const lc = String(input).toLowerCase()
  if (EXPORT_OUTPUT[lc]) return lc
  return TARGET_ALIASES[lc] || null
}
