import { describe, it, expect } from 'vitest'
import {
  resolveTarget,
  preprocessCss,
  buildAuditPrompt,
  buildResolvePrompt,
  buildExportPrompt,
  AUDIT_SYSTEM_PROMPT,
} from '../prompts.mjs'

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
    expect(preprocessCss('/* comment */ body { color: red; }')).toBe(
      'body { color: red; }'
    )
  })

  it('strips line comments', () => {
    expect(preprocessCss('// comment\nbody { color: red; }')).toBe(
      'body { color: red; }'
    )
  })

  it('collapses multiple whitespace to a single space', () => {
    expect(preprocessCss('body  {   color:   red;   }')).toBe(
      'body { color: red; }'
    )
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

  it('returns an object with content and system', () => {
    const result = buildAuditPrompt(css)
    expect(typeof result).toBe('object')
    expect(typeof result.content).toBe('string')
    expect(result.system).toBe(AUDIT_SYSTEM_PROMPT)
  })

  it('returns a non-empty content string', () => {
    expect(buildAuditPrompt(css).content.length).toBeGreaterThan(0)
  })

  it('embeds the CSS source in the output', () => {
    expect(buildAuditPrompt(css).content).toContain(css)
  })

  it('wraps CSS source in <css_source> tags', () => {
    const content = buildAuditPrompt(css).content
    expect(content).toContain('<css_source>')
    expect(content).toContain('</css_source>')
    expect(content.indexOf('<css_source>')).toBeLessThan(content.indexOf(css))
  })

  it('includes the AuditReport instruction', () => {
    expect(buildAuditPrompt(css).content).toContain('AuditReport')
  })

  it('includes <instructions> wrapper tags', () => {
    const content = buildAuditPrompt(css).content
    expect(content).toContain('<instructions>')
    expect(content).toContain('</instructions>')
  })

  it('includes <output_format> and <example> tags', () => {
    const content = buildAuditPrompt(css).content
    expect(content).toContain('<output_format>')
    expect(content).toContain('</output_format>')
    expect(content).toContain('<example>')
    expect(content).toContain('</example>')
  })

  it('includes all seven analysis steps', () => {
    const content = buildAuditPrompt(css).content
    expect(content).toContain('STEP 1')
    expect(content).toContain('STEP 2')
    expect(content).toContain('STEP 3')
    expect(content).toContain('STEP 4')
    expect(content).toContain('STEP 5')
    expect(content).toContain('STEP 6')
    expect(content).toContain('STEP 7')
  })

  it('covers all required JSON output fields in the example', () => {
    const content = buildAuditPrompt(css).content
    expect(content).toContain('"brand"')
    expect(content).toContain('"chaosScore"')
    expect(content).toContain('"summary"')
    expect(content).toContain('"colorClusters"')
    expect(content).toContain('"fonts"')
    expect(content).toContain('"spacing"')
    expect(content).toContain('"lineHeights"')
  })

  it('includes all allowed semantic color names', () => {
    const content = buildAuditPrompt(css).content
    for (const name of [
      'primary',
      'secondary',
      'accent',
      'background',
      'surface',
      'text',
      'muted',
      'border',
      'error',
      'success',
      'warning',
      'info',
    ]) {
      expect(content).toContain(name)
    }
  })

  it('includes deterministic chaos score formula with stacking rules', () => {
    const content = buildAuditPrompt(css).content
    expect(content).toContain('+2 if colorClusters')
    expect(content).toContain('+1 if colorClusters')
    expect(content).toContain('+2 if nonScaleValues')
    expect(content).toContain('+1 if nonScaleValues')
    expect(content).toContain('unitlessMix')
  })

  it('covers directional spacing properties', () => {
    const content = buildAuditPrompt(css).content
    expect(content).toContain('margin-top')
    expect(content).toContain('padding-left')
    expect(content).toContain('column-gap')
    expect(content).toContain('row-gap')
  })

  it('truncates very large CSS inputs to 60000 characters', () => {
    const largeCss = 'a { color: red; } '.repeat(5000)
    const content = buildAuditPrompt(largeCss).content
    const start = content.indexOf('<css_source>') + '<css_source>\n'.length
    const end = content.indexOf('</css_source>')
    const embeddedCss = content.slice(start, end).trimEnd()
    expect(embeddedCss.length).toBeLessThanOrEqual(60000)
  })

  it('instructs Claude to return only JSON with no markdown fences', () => {
    expect(buildAuditPrompt(css).content).toContain('No markdown fences')
  })

  it('includes a LINE-HEIGHT step with unitlessMix flag', () => {
    const content = buildAuditPrompt(css).content
    expect(content).toContain('LINE-HEIGHT')
    expect(content).toContain('unitlessMix')
    expect(content).toContain('tight')
    expect(content).toContain('snug')
    expect(content).toContain('normal')
    expect(content).toContain('relaxed')
    expect(content).toContain('loose')
  })
})

describe('buildResolvePrompt', () => {
  const css = 'body { color: #6366f1; }'
  const decisions = {
    colors: [{ include: true, name: 'primary', value: '#6366f1' }],
    fonts: ['Inter'],
    spacingScale: { 1: '4px', 2: '8px' },
    lineHeights: { tight: 1.2, normal: 1.5 },
  }

  it('returns an object with content and null system', () => {
    const result = buildResolvePrompt(css, decisions)
    expect(typeof result).toBe('object')
    expect(typeof result.content).toBe('string')
    expect(result.system).toBeNull()
  })

  it('returns a non-empty content string', () => {
    expect(buildResolvePrompt(css, decisions).content.length).toBeGreaterThan(0)
  })

  it('embeds the original CSS', () => {
    expect(buildResolvePrompt(css, decisions).content).toContain(css)
  })

  it('embeds the decisions as JSON', () => {
    expect(buildResolvePrompt(css, decisions).content).toContain('"primary"')
  })

  it('includes DSTokens instructions', () => {
    expect(buildResolvePrompt(css, decisions).content).toContain('DSTokens')
  })

  it('includes line-height normalization instructions with canonical keys', () => {
    const content = buildResolvePrompt(css, decisions).content
    expect(content).toContain('tight')
    expect(content).toContain('snug')
    expect(content).toContain('normal')
    expect(content).toContain('relaxed')
    expect(content).toContain('loose')
    expect(content).toContain('lineHeights')
  })
})

describe('buildExportPrompt', () => {
  const tokens = {
    brand: 'test',
    colors: [{ name: 'primary', value: '#6366f1', scale: {} }],
    typography: { fontFamilies: { body: 'Inter' } },
    spacing: { 1: '4px' },
  }

  it('returns an object with content and null system for a known target', () => {
    const result = buildExportPrompt(tokens, 'css-variables')
    expect(typeof result).toBe('object')
    expect(typeof result.content).toBe('string')
    expect(result.system).toBeNull()
  })

  it('returns a non-empty content string for css-variables target', () => {
    expect(
      buildExportPrompt(tokens, 'css-variables').content.length
    ).toBeGreaterThan(0)
  })

  it('returns a non-empty content string for react-component target', () => {
    expect(
      buildExportPrompt(tokens, 'react-component').content.length
    ).toBeGreaterThan(0)
  })

  it('embeds the tokens JSON in the output', () => {
    expect(buildExportPrompt(tokens, 'css-variables').content).toContain(
      '"primary"'
    )
  })

  it('returns null for an unknown target', () => {
    expect(buildExportPrompt(tokens, 'does-not-exist')).toBeNull()
  })

  it('returns an object with content and null system for scss-variables target', () => {
    const result = buildExportPrompt(tokens, 'scss-variables')
    expect(typeof result).toBe('object')
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.system).toBeNull()
  })

  it('returns an object with content and null system for js-tokens target', () => {
    const result = buildExportPrompt(tokens, 'js-tokens')
    expect(typeof result).toBe('object')
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.system).toBeNull()
  })

  it('returns an object with content and null system for tailwind-config target', () => {
    const result = buildExportPrompt(tokens, 'tailwind-config')
    expect(typeof result).toBe('object')
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.system).toBeNull()
  })

  it('returns an object with content and null system for styled-components target', () => {
    const result = buildExportPrompt(tokens, 'styled-components')
    expect(typeof result).toBe('object')
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.system).toBeNull()
  })

  it('returns an object with content and null system for emotion target', () => {
    const result = buildExportPrompt(tokens, 'emotion')
    expect(typeof result).toBe('object')
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.system).toBeNull()
  })

  it('returns an object with content and null system for css-modules target', () => {
    const result = buildExportPrompt(tokens, 'css-modules')
    expect(typeof result).toBe('object')
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.system).toBeNull()
  })

  it('returns an object with content and null system for vue-component target', () => {
    const result = buildExportPrompt(tokens, 'vue-component')
    expect(typeof result).toBe('object')
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.system).toBeNull()
  })

  it('returns an object with content and null system for svelte-component target', () => {
    const result = buildExportPrompt(tokens, 'svelte-component')
    expect(typeof result).toBe('object')
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.system).toBeNull()
  })

  it('returns an object with content and null system for astro-component target', () => {
    const result = buildExportPrompt(tokens, 'astro-component')
    expect(typeof result).toBe('object')
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.system).toBeNull()
  })

  it('returns an object with content and null system for angular-component target', () => {
    const result = buildExportPrompt(tokens, 'angular-component')
    expect(typeof result).toBe('object')
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.system).toBeNull()
  })

  it('returns an object with content and null system for angular-legacy-component target', () => {
    const result = buildExportPrompt(tokens, 'angular-legacy-component')
    expect(typeof result).toBe('object')
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.system).toBeNull()
  })
})
