import { describe, it, expect, vi } from 'vitest'
import { AnthropicLlmClient } from '../llm_providers/anthropic/client.mjs'
import {
  CssAuditor,
  buildCssAuditorFromSettingsAndFlags,
} from '../css-auditor.mjs'
import {
  setupFixture,
  saveRecordedFixture,
} from './helpers/anthropic-recorder.mjs'
import { buildAuditPrompt } from '../prompts.mjs'

const RECORD_MODE = process.env.RECORD_FIXTURES === '1'

describe('AnthropicLlmClient', () => {
  it('returns text on successful 200 response', async () => {
    const fixtureName = 'audit-200-simple-css'
    const css = 'body { color: #ff0000; font-size: 16px; }'
    const prompt = buildAuditPrompt(css)

    if (RECORD_MODE) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is required when RECORD_FIXTURES=1')
      }

      const realFetch = globalThis.fetch.bind(globalThis)
      let captured

      globalThis.fetch = async (...args) => {
        const response = await realFetch(...args)
        const body = await response.clone().json()
        captured = { status: response.status, ok: response.ok, body }
        return response
      }

      const client = new AnthropicLlmClient({ apiKey })

      let result
      try {
        result = await client.sendPrompt(prompt, 3000)
      } finally {
        globalThis.fetch = realFetch
      }

      if (!captured) {
        throw new Error('No response captured. Did the API call complete?')
      }

      await saveRecordedFixture(fixtureName, captured)

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    } else {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      await setupFixture(fixtureName, fetchSpy)

      const client = new AnthropicLlmClient({ apiKey: 'fake-key' })

      const result = await client.sendPrompt(prompt, 3000)

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)

      fetchSpy.mockRestore()
    }
  })

  it('throws when apiKey is missing', async () => {
    expect(
      () => new AnthropicLlmClient({ apiKey: undefined, modelName: undefined })
    ).toThrow('ANTHROPIC_API_KEY is required')
  })

  it.each([
    [400, 'invalid_request_error', 'Bad request'],
    [401, 'authentication_error', 'Invalid key'],
    [402, 'billing_error', 'Payment issue'],
    [403, 'permission_error', 'No permission'],
    [404, 'not_found_error', 'Resource not found'],
    [413, 'request_too_large', 'Request too large'],
    [429, 'rate_limit_error', 'Rate limited'],
    [500, 'api_error', 'Internal error'],
    [504, 'timeout_error', 'Request timeout'],
    [529, 'overloaded_error', 'API overloaded'],
  ])('throws on %i %s', async (status, type, message) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status,
      json: async () => ({
        error: { type, message },
      }),
    })

    const client = new AnthropicLlmClient({ apiKey: 'sk-test' })

    await expect(client.sendPrompt('test', 3000)).rejects.toThrow(message)

    fetchSpy.mockRestore()
  })

  it('throws generic error when response message is missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    })

    const client = new AnthropicLlmClient({ apiKey: 'sk-test' })

    await expect(client.sendPrompt('test', 3000)).rejects.toThrow(
      'Anthropic API error (500)'
    )

    fetchSpy.mockRestore()
  })

  it('handles string prompt', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: 'hello' }],
      }),
    })

    const client = new AnthropicLlmClient({
      apiKey: 'sk-test',
      modelName: 'claude-sonnet-4-20250514',
    })
    const result = await client.sendPrompt('hello world', 3000)

    expect(result).toBe('hello')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          messages: [{ role: 'user', content: 'hello world' }],
        }),
      })
    )

    fetchSpy.mockRestore()
  })

  it('passes system prompt when provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: 'result' }],
      }),
    })

    const client = new AnthropicLlmClient({
      apiKey: 'sk-test',
      modelName: 'claude-sonnet-4-20250514',
    })
    await client.sendPrompt(
      { content: 'user prompt', system: 'system prompt' },
      3000
    )

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          messages: [{ role: 'user', content: 'user prompt' }],
          system: 'system prompt',
        }),
      })
    )

    fetchSpy.mockRestore()
  })
})

describe('CssAuditor', () => {
  it('audit returns parsed JSON object', async () => {
    const rawResponse = '{"brand":"test","chaosScore":5}'
    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const prompt = { content: 'test', system: 'sys' }
    const result = await auditor.audit(prompt)

    expect(result).toEqual({ brand: 'test', chaosScore: 5 })
    expect(sendPromptSpy).toHaveBeenCalledWith(prompt, 3000)
  })

  it('audit strips fences before parsing', async () => {
    const rawResponse = '```json\n{"brand":"test","chaosScore":5}\n```'
    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit('test prompt')

    expect(result).toEqual({ brand: 'test', chaosScore: 5 })
  })

  it('parse returns parsed JSON object', async () => {
    const rawResponse = '{"brand":"test","colors":[]}'
    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const prompt = { content: 'test', system: 'sys' }
    const result = await auditor.parse(prompt)

    expect(result).toEqual({ brand: 'test', colors: [] })
    expect(sendPromptSpy).toHaveBeenCalledWith(prompt, 4000)
  })

  it('export returns stripped string', async () => {
    const rawResponse = '```css\n:root { --color: red; }\n```'
    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const prompt = { content: 'test', system: 'sys' }
    const result = await auditor.export(prompt)

    expect(result).toBe(':root { --color: red; }')
    expect(sendPromptSpy).toHaveBeenCalledWith(prompt, 6000)
  })

  it('export returns string unchanged when no fences', async () => {
    const rawResponse = ':root { --color: red; }'
    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.export('test prompt')

    expect(result).toBe(':root { --color: red; }')
  })
})

describe('CssAuditor.stripFences', () => {
  it('strips a js-fenced code block', () => {
    expect(CssAuditor.stripFences('```js\nconst x = 1\n```')).toBe(
      'const x = 1'
    )
  })

  it('strips a css-fenced code block', () => {
    expect(CssAuditor.stripFences('```css\nbody { color: red; }\n```')).toBe(
      'body { color: red; }'
    )
  })

  it('returns unfenced input unchanged', () => {
    expect(CssAuditor.stripFences('const x = 1')).toBe('const x = 1')
  })

  it('strips ```json fenced block', () => {
    expect(CssAuditor.stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })
})

describe('buildCssAuditorFromSettingsAndFlags', () => {
  it('returns CssAuditor wrapping AnthropicLlmClient for anthropic name', () => {
    const testSettings = { llmProviderName: 'anthropic' }
    const auditor = buildCssAuditorFromSettingsAndFlags(testSettings, {
      'api-key': 'sk-test',
    })
    expect(auditor).toBeInstanceOf(CssAuditor)
    expect(auditor.client).toBeInstanceOf(AnthropicLlmClient)
  })

  it('prefers apiKey from flags over settings', () => {
    const flags = { 'api-key': 'flag-key' }
    const testSettings = { llmProviderName: 'anthropic' }
    const auditor = buildCssAuditorFromSettingsAndFlags(testSettings, flags)
    expect(auditor.client.apiKey).toBe('flag-key')
  })

  it('uses settings apiKey when no flag override', () => {
    const testSettings = { llmProviderName: 'anthropic', apiKey: 'sk-test' }
    const auditor = buildCssAuditorFromSettingsAndFlags(testSettings, {})
    expect(auditor.client.apiKey).toBe('sk-test')
  })

  it('throws for unknown provider name', () => {
    const testSettings = { llmProviderName: 'unknown-provider' }
    expect(() => buildCssAuditorFromSettingsAndFlags(testSettings)).toThrow(
      'Unsupported LLM provider: unknown-provider'
    )
  })
})

describe('buildAuditPrompt layout a11y', () => {
  it('includes STEP 8 for layout accessibility detection', () => {
    const css = '.flex-parent { display: flex; } .flex-child { order: 1; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('STEP 8')
    expect(prompt.content).toContain('LAYOUT ACCESSIBILITY')
  })

  it('instructs LLM to detect order breaking DOM order', () => {
    const css = '.nav { display: grid; } .nav-item { order: -1; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('ORDER BREAKING DOM ORDER')
    expect(prompt.content).toContain('order')
  })

  it('instructs LLM to check for missing tabindex fallback', () => {
    const css = '.flex { display: flex; } .flex-item { order: 2; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('REORDERING WITHOUT TABINDEX FALLBACK')
    expect(prompt.content).toContain('tabindex')
  })

  it('includes layoutA11yIssues in the output example', () => {
    const css = 'body { color: red; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('layoutA11yIssues')
    expect(prompt.content).toContain('nav-logo')
  })

  it('includes layout a11y in chaos score calculation', () => {
    const css = 'body { color: red; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('layoutA11yIssues.length')
  })
})

describe('CssAuditor layout a11y integration', () => {
  it('audit parses response with layoutA11yIssues', async () => {
    const rawResponse = JSON.stringify({
      brand: 'test',
      chaosScore: 5,
      summary: '',
      colorClusters: [],
      fonts: [],
      spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
      lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
      layoutA11yIssues: [
        {
          selector: '.nav-item',
          property: 'order',
          value: '-1',
          reason: 'Visual order differs from DOM order',
          severity: 'warning',
        },
      ],
    })

    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit({ content: 'test', system: 'sys' })
    expect(result.layoutA11yIssues).toEqual([
      {
        selector: '.nav-item',
        property: 'order',
        value: '-1',
        reason: 'Visual order differs from DOM order',
        severity: 'warning',
      },
    ])
  })

  it('audit handles empty layoutA11yIssues array', async () => {
    const rawResponse = JSON.stringify({
      brand: 'test',
      chaosScore: 3,
      summary: '',
      colorClusters: [],
      fonts: [],
      spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
      lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
      layoutA11yIssues: [],
    })

    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit({ content: 'test', system: 'sys' })
    expect(result.layoutA11yIssues).toEqual([])
  })
})

describe('buildAuditPrompt modern practices', () => {
  it('includes STEP 9 for modern CSS best practices detection', () => {
    const css = '.grid { display: grid; grid-template-columns: 1fr; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('STEP 9')
    expect(prompt.content).toContain('MODERN CSS BEST PRACTICES')
  })

  it('instructs LLM to detect single-column grids', () => {
    const css = '.container { display: grid; grid-template-columns: 1fr; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('SINGLE-COLUMN GRID')
    expect(prompt.content).toContain('grid-when-flexbox-wrap-would-work')
  })

  it('instructs LLM to detect legacy centering techniques', () => {
    const css =
      '.modal { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('LEGACY CENTERING')
    expect(prompt.content).toContain('legacy-centering')
  })

  it('instructs LLM to detect flex min-width zero hack', () => {
    const css = '.parent { display: flex; } .child { min-width: 0; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('FLEX MIN-WIDTH ZERO HACK')
    expect(prompt.content).toContain('flex-min-width-zero-hack')
  })

  it('instructs LLM to detect fragile nested selectors', () => {
    const css = '.card > .header > .title { font-size: 16px; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('FRAGILE NESTED SELECTORS')
    expect(prompt.content).toContain('fragile-nested-selectors')
  })

  it('includes modernPracticeIssues in the output example', () => {
    const css = 'body { color: red; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('modernPracticeIssues')
    expect(prompt.content).toContain('card-grid')
    expect(prompt.content).toContain('fragile-nested-selectors')
  })
})

describe('CssAuditor modernPracticeIssues integration', () => {
  it('audit parses response with modernPracticeIssues', async () => {
    const rawResponse = JSON.stringify({
      brand: 'test',
      chaosScore: 4,
      summary: '',
      colorClusters: [],
      fonts: [],
      spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
      lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
      layoutA11yIssues: [],
      modernPracticeIssues: [
        {
          selector: '.card-grid',
          rule: 'grid-when-flexbox-wrap-would-work',
          severity: 'suggestion',
          reason: 'Single-column grid layout',
        },
      ],
    })

    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit({ content: 'test', system: 'sys' })
    expect(result.modernPracticeIssues).toEqual([
      {
        selector: '.card-grid',
        rule: 'grid-when-flexbox-wrap-would-work',
        severity: 'suggestion',
        reason: 'Single-column grid layout',
      },
    ])
  })

  it('audit handles empty modernPracticeIssues array', async () => {
    const rawResponse = JSON.stringify({
      brand: 'test',
      chaosScore: 3,
      summary: '',
      colorClusters: [],
      fonts: [],
      spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
      lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
      layoutA11yIssues: [],
      modernPracticeIssues: [],
    })

    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit({ content: 'test', system: 'sys' })
    expect(result.modernPracticeIssues).toEqual([])
  })
})

describe('buildAuditPrompt adoption suggestions', () => {
  it('includes STEP 10 for modern feature adoption detection', () => {
    const css = 'body { color: red; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('STEP 10')
    expect(prompt.content).toContain('MODERN FEATURE ADOPTION')
  })

  it('instructs LLM to suggest CSS layers for large projects', () => {
    const css =
      '.a {} .b {} .c {} .d {} .e {} .f {} .g {} .h {} .i {} .j {} .k {} .l {} .m {} .n {} .o {} .p {} .q {} .r {} .s {} .t {} .u {}'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('USE CSS LAYERS')
    expect(prompt.content).toContain('use-css-layers')
  })

  it('instructs LLM to suggest container queries', () => {
    const css = '@media (min-width: 768px) { .card { width: 50%; } }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('USE CONTAINER QUERIES')
    expect(prompt.content).toContain('use-container-queries')
  })

  it('includes adoptionSuggestions in the output example', () => {
    const css = 'body { color: red; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('adoptionSuggestions')
    expect(prompt.content).toContain('use-css-layers')
    expect(prompt.content).toContain('product-card')
  })
})

describe('CssAuditor adoptionSuggestions integration', () => {
  it('audit parses response with adoptionSuggestions', async () => {
    const rawResponse = JSON.stringify({
      brand: 'test',
      chaosScore: 4,
      summary: '',
      colorClusters: [],
      fonts: [],
      spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
      lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
      layoutA11yIssues: [],
      modernPracticeIssues: [],
      adoptionSuggestions: [
        {
          selector: '',
          rule: 'use-css-layers',
          severity: 'info',
          reason: 'Project has 30 selector rules without @layer organization',
        },
      ],
    })

    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit({ content: 'test', system: 'sys' })
    expect(result.adoptionSuggestions).toEqual([
      {
        selector: '',
        rule: 'use-css-layers',
        severity: 'info',
        reason: 'Project has 30 selector rules without @layer organization',
      },
    ])
  })

  it('audit handles empty adoptionSuggestions array', async () => {
    const rawResponse = JSON.stringify({
      brand: 'test',
      chaosScore: 3,
      summary: '',
      colorClusters: [],
      fonts: [],
      spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
      lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
      layoutA11yIssues: [],
      modernPracticeIssues: [],
      adoptionSuggestions: [],
    })

    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit({ content: 'test', system: 'sys' })
    expect(result.adoptionSuggestions).toEqual([])
  })

  it('audit handles missing adoptionSuggestions gracefully', async () => {
    const rawResponse = JSON.stringify({
      brand: 'test',
      chaosScore: 3,
      summary: '',
      colorClusters: [],
      fonts: [],
      spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
      lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
      layoutA11yIssues: [],
      modernPracticeIssues: [],
    })

    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit({ content: 'test', system: 'sys' })
    expect(result.adoptionSuggestions).toBeUndefined()
  })
})
