import { describe, it, expect, vi, afterEach } from 'vitest'
import { AnthropicLlmClient } from '../llm_providers/anthropic/client-impl.mjs'
import { OllamaLlmClient } from '../llm_providers/ollama/client-impl.mjs'
import { CssAuditor, buildCssAuditorFromConfig } from '../css-auditor.mjs'
import { buildConfigFromFlags } from '../config.mjs'
import { getClient } from '../llm_providers/client.mjs'
import { runRecordingScenario } from './helpers/fixture-recorder.mjs'
import { buildAuditPrompt } from '../prompts.mjs'

function mockFetch(response) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
}

afterEach(() => {
  vi.restoreAllMocks()
})

const ANTHROPIC_DEFAULTS = {
  apiKey: 'sk-test',
  modelName: 'claude-sonnet-4-20250514',
  url: 'https://api.anthropic.com/v1/messages',
  version: '2023-06-01',
}

const OLLAMA_DEFAULTS = {
  modelName: 'gemma4',
  url: 'http://localhost:11434/api/chat',
}

describe('AnthropicLlmClient', () => {
  it('returns text on successful 200 response', { timeout: 120000 }, async () => {
    const css = 'body { color: #ff0000; font-size: 16px; }'
    const prompt = buildAuditPrompt(css)

    const result = await runRecordingScenario({
      provider: 'anthropic',
      fixtureName: 'audit-200-simple-css',
      prompt,
      maxToken: 3000,
      apiKeyEnvVar: 'API_KEY',
      mockFetch,
      buildClient: (args) => new AnthropicLlmClient({ ...ANTHROPIC_DEFAULTS, ...args }),
    })

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('throws when apiKey is missing', () => {
    expect(() => new AnthropicLlmClient({ apiKey: undefined, modelName: undefined })).toThrow(
      'API_KEY is required'
    )
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
  ])(
    'throws on %i %s',
    async (status, type, message) => {
      mockFetch({
        ok: false,
        status,
        json: async () => ({ error: { type, message } }),
      })

      const client = new AnthropicLlmClient({ apiKey: 'sk-test' })

      await expect(client.sendPrompt('test', 3000)).rejects.toThrow(message)
    }
  )

  it('throws generic error when response message is missing', async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: async () => ({}),
    })

    const client = new AnthropicLlmClient({ apiKey: 'sk-test' })

    await expect(client.sendPrompt('test', 3000)).rejects.toThrow(
      'Anthropic API error (500)'
    )
  })

  it('handles string prompt', async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'hello' }] }),
    })

    const client = new AnthropicLlmClient(ANTHROPIC_DEFAULTS)
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
  })

  it('passes system prompt when provided', async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'result' }] }),
    })

    const client = new AnthropicLlmClient(ANTHROPIC_DEFAULTS)
    await client.sendPrompt({ content: 'user prompt', system: 'system prompt' }, 3000)

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
  })
})

describe('OllamaLlmClient', () => {
  it('returns assistant text on a recorded 200 response', { timeout: 120000 }, async () => {
    const css = 'body { color: #ff0000; font-size: 16px; }'
    const prompt = buildAuditPrompt(css)

    const result = await runRecordingScenario({
      provider: 'ollama',
      fixtureName: 'audit-200-simple-css',
      prompt,
      maxToken: 3000,
      mockFetch,
      buildClient: (args) => new OllamaLlmClient({ ...OLLAMA_DEFAULTS, ...args }),
    })

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('does not require apiKey', () => {
    expect(() => new OllamaLlmClient(OLLAMA_DEFAULTS)).not.toThrow()
  })

  it('returns assistant text on 200', async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ message: { content: 'hello from ollama' } }),
    })

    const client = new OllamaLlmClient(OLLAMA_DEFAULTS)
    const result = await client.sendPrompt('hi', 512)

    expect(result).toBe('hello from ollama')
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'gemma4',
          options: { num_ctx: 512 },
          messages: [{ role: 'user', content: 'hi' }],
          stream: false,
        }),
      })
    )
  })

  it('throws on non-ok response with status code', async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: async () => ({}),
    })

    const client = new OllamaLlmClient(OLLAMA_DEFAULTS)
    await expect(client.sendPrompt('test', 512)).rejects.toThrow('Ollama API error (500)')
  })

  it('passes system prompt as an extra message when provided', async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ message: { content: 'ok' } }),
    })

    const client = new OllamaLlmClient(OLLAMA_DEFAULTS)
    await client.sendPrompt({ content: 'user msg', system: 'be brief' }, 512)

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        body: expect.stringContaining('"role":"system"'),
      })
    )
  })

  it('omits Authorization header when apiKey is undefined', async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ message: { content: 'ok' } }),
    })

    const client = new OllamaLlmClient(OLLAMA_DEFAULTS)
    await client.sendPrompt('hi', 512)

    const [, init] = fetchSpy.mock.calls[0]
    expect(init.headers).not.toHaveProperty('Authorization')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('sends Authorization Bearer header when apiKey is defined', async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ message: { content: 'ok' } }),
    })

    const client = new OllamaLlmClient({ ...OLLAMA_DEFAULTS, apiKey: 'test-key' })
    await client.sendPrompt('hi', 512)

    const [, init] = fetchSpy.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer test-key')
    expect(init.headers['Content-Type']).toBe('application/json')
  })
})

describe('getClient', () => {
  it('returns an AnthropicLlmClient for anthropic config', () => {
    const client = getClient({
      name: 'anthropic',
      apiKey: 'sk-test',
      model: 'claude-sonnet-4-20250514',
      url: 'https://api.anthropic.com/v1/messages',
      version: '2023-06-01',
    })
    expect(client).toBeInstanceOf(AnthropicLlmClient)
    expect(client.apiKey).toBe('sk-test')
    expect(client.modelName).toBe('claude-sonnet-4-20250514')
  })

  it('returns an OllamaLlmClient for ollama config', () => {
    const client = getClient({
      name: 'ollama',
      apiKey: undefined,
      model: 'gemma4',
      url: 'http://localhost:11434/api/chat',
    })
    expect(client).toBeInstanceOf(OllamaLlmClient)
    expect(client.modelName).toBe('gemma4')
    expect(client.url).toBe('http://localhost:11434/api/chat')
  })
})

describe('buildConfigFromFlags', () => {
  it('overrides env apiKey with flag value', async () => {
    const prev = process.env.API_KEY
    process.env.API_KEY = 'env-key'
    try {
      vi.resetModules()
      const { buildConfigFromFlags: build } = await import('../config.mjs')
      const config = build({ 'api-key': 'flag-key' })
      expect(config.apiKey).toBe('flag-key')
    } finally {
      if (prev === undefined) delete process.env.API_KEY
      else process.env.API_KEY = prev
    }
  })

  it('selects ollama config when --provider ollama', () => {
    const config = buildConfigFromFlags({ provider: 'ollama' })
    expect(config.name).toBe('ollama')
    expect(config.url).toBe('http://localhost:11434/api/chat')
    expect(config.cssAuditor.maxTokens).toEqual({ audit: 10000, parse: 10000, export: 10000 })
  })
})

describe('buildCssAuditorFromConfig', () => {
  it('returns CssAuditor wrapping AnthropicLlmClient for anthropic name', () => {
    const config = buildConfigFromFlags({ 'api-key': 'sk-test' })
    const auditor = buildCssAuditorFromConfig(config)
    expect(auditor).toBeInstanceOf(CssAuditor)
    expect(auditor.client).toBeInstanceOf(AnthropicLlmClient)
  })

  it('prefers apiKey from flags over env', () => {
    const config = buildConfigFromFlags({ 'api-key': 'flag-key' })
    expect(config.name).toBe('anthropic')
    expect(config.apiKey).toBe('flag-key')
    const auditor = buildCssAuditorFromConfig(config)
    expect(auditor.client.apiKey).toBe('flag-key')
  })

  it('uses env apiKey when no flag override', async () => {
    const prev = process.env.API_KEY
    process.env.API_KEY = 'env-key'
    try {
      vi.resetModules()
      const { buildConfigFromFlags: build } = await import('../config.mjs')
      const config = build({})
      expect(config.apiKey).toBe('env-key')
    } finally {
      if (prev === undefined) delete process.env.API_KEY
      else process.env.API_KEY = prev
    }
  })

  it('throws for unknown provider name', () => {
    expect(() => buildConfigFromFlags({ provider: 'unknown-provider' })).toThrow(
      'Unsupported LLM provider: unknown-provider'
    )
  })
})
