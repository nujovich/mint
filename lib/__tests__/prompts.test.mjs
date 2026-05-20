import { describe, it, expect } from 'vitest'
import {
  stripFences,
  resolveTarget,
  preprocessCss,
  buildAuditPrompt,
  buildResolvePrompt,
  buildExportPrompt,
  AUDIT_SYSTEM_PROMPT,
} from '../prompts.mjs'

describe('stripFences', () => {
  it('strips a js-fenced code block', () => {
    expect(stripFences('```js\nconst x = 1\n```')).toBe('const x = 1')
  })

  it('strips a css-fenced code block', () => {
    expect(stripFences('```css\nbody { color: red; }\n```')).toBe('body { color: red; }')
  })

  it('returns unfenced input unchanged', () => {
    expect(stripFences('const x = 1')).toBe('const x = 1')
  })
})

describe('resolveTarget', () => {
  it('returns a canonical target key unchanged', () => {
    expect(resolveTarget('css-variables')).toBe('css-variables')
  })

  it('resolves a short alias to its canonical key', () => {
    expect(resolveTarget('react')).toBe('react-component')
  })

  it('resolves tailwind alias', () => {
    expect(resolveTarget('tailwind')).toBe('tailwind-config')
  })

  it('returns null for an unknown target', () => {
    expect(resolveTarget('unknown-xyz')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(resolveTarget(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(resolveTarget('')).toBeNull()
  })
})

describe('preprocessCss', () => {
  it('strips block comments', () => {
    expect(preprocessCss('/* comment */ body { color: red; }')).toBe('body { color: red; }')
  })

  it('strips line comments', () => {
    expect(preprocessCss('// comment\nbody { color: red; }')).toBe('body { color: red; }')
  })

  it('collapses multiple whitespace to a single space', () => {
    expect(preprocessCss('body  {   color:   red;   }')).toBe('body { color: red; }')
  })

  it('returns already-clean input unchanged', () => {
    expect(preprocessCss('body { color: red; }')).toBe('body { color: red; }')
  })
})

describe('AUDIT_SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof AUDIT_SYSTEM_PROMPT).toBe('string')
    expect(AUDIT_SYSTEM_PROMPT.length).toBeGreaterThan(0)
  })

  it('establishes an auditor role', () => {
    expect(AUDIT_SYSTEM_PROMPT).toContain('auditor')
  })

  it('mentions JSON output requirement', () => {
    expect(AUDIT_SYSTEM_PROMPT).toContain('JSON')
  })
})

describe('buildAuditPrompt', () => {
  const css = 'body { color: #ff0000; font-size: 16px; }'

  it('returns a non-empty string', () => {
    expect(typeof buildAuditPrompt(css)).toBe('string')
    expect(buildAuditPrompt(css).length).toBeGreaterThan(0)
  })

  it('embeds the CSS source in the output', () => {
    expect(buildAuditPrompt(css)).toContain(css)
  })

  it('wraps CSS source in <css_source> tags', () => {
    const prompt = buildAuditPrompt(css)
    expect(prompt).toContain('<css_source>')
    expect(prompt).toContain('</css_source>')
    expect(prompt.indexOf('<css_source>')).toBeLessThan(prompt.indexOf(css))
  })

  it('includes the AuditReport instruction', () => {
    expect(buildAuditPrompt(css)).toContain('AuditReport')
  })

  it('includes <instructions> wrapper tags', () => {
    const prompt = buildAuditPrompt(css)
    expect(prompt).toContain('<instructions>')
    expect(prompt).toContain('</instructions>')
  })

  it('includes <output_format> and <example> tags', () => {
    const prompt = buildAuditPrompt(css)
    expect(prompt).toContain('<output_format>')
    expect(prompt).toContain('</output_format>')
    expect(prompt).toContain('<example>')
    expect(prompt).toContain('</example>')
  })

  it('includes all six analysis steps', () => {
    const prompt = buildAuditPrompt(css)
    expect(prompt).toContain('STEP 1')
    expect(prompt).toContain('STEP 2')
    expect(prompt).toContain('STEP 3')
    expect(prompt).toContain('STEP 4')
    expect(prompt).toContain('STEP 5')
    expect(prompt).toContain('STEP 6')
  })

  it('covers all required JSON output fields in the example', () => {
    const prompt = buildAuditPrompt(css)
    expect(prompt).toContain('"brand"')
    expect(prompt).toContain('"chaosScore"')
    expect(prompt).toContain('"summary"')
    expect(prompt).toContain('"colorClusters"')
    expect(prompt).toContain('"fonts"')
    expect(prompt).toContain('"spacing"')
  })

  it('includes all allowed semantic color names', () => {
    const prompt = buildAuditPrompt(css)
    for (const name of ['primary', 'secondary', 'accent', 'background', 'surface',
      'text', 'muted', 'border', 'error', 'success', 'warning', 'info']) {
      expect(prompt).toContain(name)
    }
  })

  it('includes deterministic chaos score formula with stacking rules', () => {
    const prompt = buildAuditPrompt(css)
    expect(prompt).toContain('+2 if colorClusters')
    expect(prompt).toContain('+1 if colorClusters')
    expect(prompt).toContain('+2 if nonScaleValues')
    expect(prompt).toContain('+1 if nonScaleValues')
  })

  it('covers directional spacing properties', () => {
    const prompt = buildAuditPrompt(css)
    expect(prompt).toContain('margin-top')
    expect(prompt).toContain('padding-left')
    expect(prompt).toContain('column-gap')
    expect(prompt).toContain('row-gap')
  })

  it('truncates very large CSS inputs to 60000 characters', () => {
    const largeCss = 'a { color: red; } '.repeat(5000)
    const prompt = buildAuditPrompt(largeCss)
    const start = prompt.indexOf('<css_source>') + '<css_source>\n'.length
    const end = prompt.indexOf('</css_source>')
    const embeddedCss = prompt.slice(start, end).trimEnd()
    expect(embeddedCss.length).toBeLessThanOrEqual(60000)
  })

  it('instructs Claude to return only JSON with no markdown fences', () => {
    const prompt = buildAuditPrompt(css)
    expect(prompt).toContain('No markdown fences')
  })
})

describe('buildResolvePrompt', () => {
  const css = 'body { color: #6366f1; }'
  const decisions = {
    colors: [{ include: true, name: 'primary', value: '#6366f1' }],
    fonts: ['Inter'],
    spacingScale: { '1': '4px', '2': '8px' },
  }

  it('returns a non-empty string', () => {
    expect(typeof buildResolvePrompt(css, decisions)).toBe('string')
    expect(buildResolvePrompt(css, decisions).length).toBeGreaterThan(0)
  })

  it('embeds the original CSS', () => {
    expect(buildResolvePrompt(css, decisions)).toContain(css)
  })

  it('embeds the decisions as JSON', () => {
    expect(buildResolvePrompt(css, decisions)).toContain('"primary"')
  })

  it('includes DSTokens instructions', () => {
    expect(buildResolvePrompt(css, decisions)).toContain('DSTokens')
  })
})

describe('buildExportPrompt', () => {
  const tokens = {
    brand: 'test',
    colors: [{ name: 'primary', value: '#6366f1', scale: {} }],
    typography: { fontFamilies: { body: 'Inter' } },
    spacing: { '1': '4px' },
  }

  it('returns a non-empty string for a known target', () => {
    const result = buildExportPrompt(tokens, 'css-variables')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for react-component target', () => {
    const result = buildExportPrompt(tokens, 'react-component')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('embeds the tokens JSON in the output', () => {
    expect(buildExportPrompt(tokens, 'css-variables')).toContain('"primary"')
  })

  it('returns null for an unknown target', () => {
    expect(buildExportPrompt(tokens, 'does-not-exist')).toBeNull()
  })

  it('returns a non-empty string for scss-variables target', () => {
    const result = buildExportPrompt(tokens, 'scss-variables')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for js-tokens target', () => {
    const result = buildExportPrompt(tokens, 'js-tokens')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for tailwind-config target', () => {
    const result = buildExportPrompt(tokens, 'tailwind-config')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for styled-components target', () => {
    const result = buildExportPrompt(tokens, 'styled-components')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for emotion target', () => {
    const result = buildExportPrompt(tokens, 'emotion')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for css-modules target', () => {
    const result = buildExportPrompt(tokens, 'css-modules')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for vue-component target', () => {
    const result = buildExportPrompt(tokens, 'vue-component')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for svelte-component target', () => {
    const result = buildExportPrompt(tokens, 'svelte-component')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for astro-component target', () => {
    const result = buildExportPrompt(tokens, 'astro-component')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for angular-component target', () => {
    const result = buildExportPrompt(tokens, 'angular-component')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for angular-legacy-component target', () => {
    const result = buildExportPrompt(tokens, 'angular-legacy-component')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
