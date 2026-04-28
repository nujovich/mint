import { NextRequest, NextResponse } from 'next/server'
import type { DSTokens, ExportTarget } from '@/lib/types'

function buildPrompt(tokens: DSTokens, target: ExportTarget): string {
  const t = JSON.stringify(tokens, null, 2)

  const shared = `\n\nDesign tokens:\n${t}\n\nReturn ONLY the code, no markdown fences, no explanation.`

  const prompts: Record<ExportTarget, string> = {
    'css-variables': `Generate a complete CSS file with custom properties for these design tokens.${shared}

Requirements:
- :root { } block with ALL tokens as CSS variables (--color-primary, --color-primary-50, etc.)
- [data-theme="dark"] { } with dark mode overrides for background, surface, text, muted colors
- Group by category with /* === Category === */ comments
- Include @import for Google Fonts if fontFamilies are defined
- Add a /* Usage */ comment at the top with quick examples`,

    'scss-variables': `Generate a complete SCSS file with variables and mixins for these design tokens.${shared}

Requirements:
- All tokens as $variable-name: value (e.g. $color-primary: #...)
- Grouped by // === Category === comments
- Color maps: $colors-primary: ( 50: #..., 100: #..., ... )
- Mixins: button-base, card, focus-ring, flex-center, truncate, visually-hidden
- Functions: color($name, $step: 500) to access color maps
- @forward and @use compatible structure`,

    'js-tokens': `Generate a complete TypeScript tokens file for these design tokens.${shared}

Requirements:
- Typed interfaces for each token category
- A const tokens object implementing the interfaces
- Helper functions: getColor(name, scale?), getSpacing(key), getShadow(key)
- Export the tokens object as default
- Export named types for use in other files
- Compatible with both ESM and CJS via dual exports comment`,

    'tailwind-config': `Generate a complete tailwind.config.js for these design tokens.${shared}

Requirements:
- Full module.exports with theme.extend
- Colors: all color tokens with full scales as nested objects
- fontFamily: display, body, mono
- fontSize with [size, { lineHeight }] tuples
- borderRadius, boxShadow, spacing extending defaults
- A safelist array with the most common generated classes
- darkMode: 'class'
- Add a @type {import('tailwindcss').Config} JSDoc`,

    'styled-components': `Generate a complete Styled Components theme file in TypeScript for these design tokens.${shared}

Requirements:
- DefaultTheme interface declaration (module augmentation)
- lightTheme and darkTheme objects typed as DefaultTheme
- All token categories: colors (with scales), typography, spacing, radii, shadows
- ThemeProvider usage example in a comment
- Export: { lightTheme, darkTheme, DefaultTheme }`,

    'emotion': `Generate a complete Emotion theme file in TypeScript for these design tokens.${shared}

Requirements:
- Theme interface with all token categories
- lightTheme and darkTheme objects typed as Theme
- useTheme() wrapper hook example
- ThemeProvider usage example in a comment
- Global styles snippet using the theme
- Export: { lightTheme, darkTheme, Theme }`,

    'css-modules': `Generate a complete CSS Modules file for these design tokens.${shared}

Requirements:
- @value declarations for all token values at the top
- Reusable component classes using the @value tokens:
  .btn, .btn-primary, .btn-secondary, .btn-ghost, .btn-sm, .btn-md, .btn-lg
  .card, .card-elevated, .card-outlined
  .badge, .badge-primary, .badge-secondary
  .input, .input-error
  .text-primary, .text-secondary, .text-muted
- Each class must only use @value references, not hardcoded values`,

    'react-component': `Generate production-ready React TypeScript components using these design tokens.${shared}

Generate these 4 components in a single file:

Button:
- Props: variant (primary|secondary|ghost|danger), size (sm|md|lg), loading, disabled, fullWidth, onClick, children
- Loading state with spinner SVG
- forwardRef

Card:
- Props: title?, description?, children, variant (default|elevated|outlined), padding (sm|md|lg)

Badge:
- Props: variant (primary|secondary|accent|neutral|success|danger), size (sm|md), children

Input:
- Props: label?, placeholder?, value, onChange, error?, hint?, disabled, type

Requirements:
- Use CSS custom properties (var(--color-primary) etc.) for all styling — no hardcoded values
- Inline styles using the token variable names
- Full TypeScript interfaces with JSDoc
- Named exports for each component`,

    'vue-component': `Generate production-ready Vue 3 components using these design tokens.${shared}

Generate Button, Card, Badge, and Input components in a single file using Vue's defineComponent per component pattern.

Requirements:
- <script setup lang="ts"> for each component
- defineProps with full TypeScript types and defaults
- computed styleObject using CSS custom property vars
- <style scoped> using var(--token-name) references
- Emit types where relevant (Button onClick, Input onChange)
- Export all 4 components
- Add a "How to register" comment at the top`,

    'svelte-component': `Generate production-ready Svelte components using these design tokens.${shared}

Generate Button, Card, Badge, and Input as separate component blocks in a single file (separated by // --- ComponentName --- comments so the user can split them).

Requirements:
- <script lang="ts"> with typed export let props
- CSS custom property vars in <style>
- Proper event forwarding with on:click etc.
- Slot usage where appropriate
- Add a usage example in a comment per component`,

    'astro-component': `Generate production-ready Astro components using these design tokens.${shared}

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
  }

  return prompts[target]
}

export async function POST(req: NextRequest) {
  const { tokens, target }: { tokens: DSTokens; target: ExportTarget } = await req.json()

  const prompt = buildPrompt(tokens, target)
  if (!prompt) {
    return NextResponse.json({ error: 'Unknown target' }, { status: 400 })
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    const raw: string = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''
    const code = raw.replace(/^```[\w-]*\n?/m, '').replace(/\n?```$/m, '').trim()

    return NextResponse.json({ code })
  } catch (err) {
    console.error('Export error:', err)
    return NextResponse.json({ error: 'Error generating export' }, { status: 500 })
  }
}
