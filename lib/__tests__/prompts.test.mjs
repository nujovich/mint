import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  stripFences,
  resolveTarget,
  preprocessCss,
  buildAuditPrompt,
  buildResolvePrompt,
  buildExportPrompt,
  callAnthropic,
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
    vi.useRealTimers()
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

  it('throws on HTTP error response without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Internal Server Error' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(callAnthropic({ apiKey: 'test-key', prompt: 'hello' })).rejects.toThrow(
      'Internal Server Error',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws on non-retryable network error without retrying', async () => {
    const nonRetryableError = Object.assign(new Error('DNS lookup failed'), { code: 'ENOTFOUND' })
    const fetchMock = vi.fn().mockRejectedValue(nonRetryableError)
    vi.stubGlobal('fetch', fetchMock)
    await expect(callAnthropic({ apiKey: 'test-key', prompt: 'hello' })).rejects.toThrow(
      'DNS lookup failed',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  describe('retry behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('retries on ETIMEDOUT and succeeds on second attempt', async () => {
      const fetchMock = vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error('etimedout'), { code: 'ETIMEDOUT' }))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ content: [{ type: 'text', text: 'retried-ok' }] }),
        })
      vi.stubGlobal('fetch', fetchMock)

      const promise = callAnthropic({ apiKey: 'test-key', prompt: 'hello' })
      await vi.advanceTimersByTimeAsync(500)
      await expect(promise).resolves.toBe('retried-ok')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('retries on ECONNRESET (via cause.code) and succeeds on second attempt', async () => {
      const wrapped = Object.assign(new Error('socket error'), {
        cause: { code: 'ECONNRESET' },
      })
      const fetchMock = vi.fn()
        .mockRejectedValueOnce(wrapped)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ content: [{ type: 'text', text: 'recovered' }] }),
        })
      vi.stubGlobal('fetch', fetchMock)

      const promise = callAnthropic({ apiKey: 'test-key', prompt: 'hello' })
      await vi.advanceTimersByTimeAsync(500)
      await expect(promise).resolves.toBe('recovered')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('retries on undici aggregate error (cause.errors[].code) and succeeds', async () => {
      const aggregate = Object.assign(new Error('undici error'), {
        cause: { errors: [{ code: 'UND_ERR_SOCKET' }] },
      })
      const fetchMock = vi.fn()
        .mockRejectedValueOnce(aggregate)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ content: [{ type: 'text', text: 'undici-ok' }] }),
        })
      vi.stubGlobal('fetch', fetchMock)

      const promise = callAnthropic({ apiKey: 'test-key', prompt: 'hello' })
      await vi.advanceTimersByTimeAsync(500)
      await expect(promise).resolves.toBe('undici-ok')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('throws after exhausting all retries', async () => {
      const err = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })
      const fetchMock = vi.fn().mockRejectedValue(err)
      vi.stubGlobal('fetch', fetchMock)

      const promise = callAnthropic({ apiKey: 'test-key', prompt: 'hello' })
      // Register the rejection handler before advancing timers to avoid an
      // unhandled-rejection warning while the timers are firing.
      const assertion = expect(promise).rejects.toThrow('timed out')
      await vi.advanceTimersByTimeAsync(2000)
      await assertion
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })
  })
})
