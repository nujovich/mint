import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  stripFences,
  resolveTarget,
  preprocessCss,
  buildAuditPrompt,
  buildResolvePrompt,
  buildExportPrompt,
  callAnthropic,
  hasDnsResultOrderOverride,
  isWSL2,
} from '../prompts.mjs'

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}))

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

describe('buildAuditPrompt', () => {
  const css = 'body { color: #ff0000; font-size: 16px; }'

  it('returns a non-empty string', () => {
    expect(typeof buildAuditPrompt(css)).toBe('string')
    expect(buildAuditPrompt(css).length).toBeGreaterThan(0)
  })

  it('embeds the CSS source in the output', () => {
    expect(buildAuditPrompt(css)).toContain(css)
  })

  it('includes the AuditReport instruction', () => {
    expect(buildAuditPrompt(css)).toContain('AuditReport')
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

describe('callAnthropic', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws when apiKey is missing', async () => {
    await expect(callAnthropic({ prompt: 'hello' })).rejects.toThrow(
      'ANTHROPIC_API_KEY is required',
    )
  })

  it('returns the text content from a successful response', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    }))
    const result = await callAnthropic({ apiKey: 'test-key', prompt: 'hello' })
    expect(result).toBe('ok')
  })
})

describe('hasDnsResultOrderOverride', () => {
  let originalExecArgv

  beforeEach(() => {
    originalExecArgv = process.execArgv
    process.execArgv = []
    vi.stubEnv('NODE_OPTIONS', '')
  })

  afterEach(() => {
    process.execArgv = originalExecArgv
    vi.unstubAllEnvs()
  })

  it('returns true when NODE_OPTIONS includes --dns-result-order', () => {
    vi.stubEnv('NODE_OPTIONS', '--dns-result-order=verbatim')
    expect(hasDnsResultOrderOverride()).toBe(true)
  })

  it('returns true when execArgv contains --dns-result-order', () => {
    process.execArgv = ['--dns-result-order']
    expect(hasDnsResultOrderOverride()).toBe(true)
  })

  it('returns true when execArgv contains --dns-result-order=value', () => {
    process.execArgv = ['--dns-result-order=verbatim']
    expect(hasDnsResultOrderOverride()).toBe(true)
  })

  it('returns false when neither NODE_OPTIONS nor execArgv signal an override', () => {
    expect(hasDnsResultOrderOverride()).toBe(false)
  })
})
