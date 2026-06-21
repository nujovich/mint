import { describe, it, expect, vi, afterEach } from 'vitest'
import { AnthropicLlmClient } from '../llm_providers/anthropic/client-impl.mjs'
import { OllamaLlmClient } from '../llm_providers/ollama/client-impl.mjs'
import { OpenRouterLlmClient } from '../llm_providers/openrouter/client-impl.mjs'
import { CssAuditor, buildCssAuditorFromConfig } from '../css-auditor.mjs'
import { buildConfigFromFlags } from '../config.mjs'
import { getClient } from '../llm_providers/client.mjs'
import { getProvider, listProviders } from '../llm_providers/registry.mjs'
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

const OPENROUTER_DEFAULTS = {
  apiKey: 'sk-or-v1-test',
  modelName: 'deepseek/deepseek-v4-flash',
  url: 'https://openrouter.ai/api/v1/chat/completions',
}

describe('AnthropicLlmClient', () => {
  it(
    'returns text on successful 200 response',
    { timeout: 120000 },
    async () => {
      const css = 'body { color: #ff0000; font-size: 16px; }'
      const prompt = buildAuditPrompt(css)

      const result = await runRecordingScenario({
        provider: 'anthropic',
        fixtureName: 'audit-200-simple-css',
        prompt,
        maxToken: 3000,
        apiKeyEnvVar: 'API_KEY',
        mockFetch,
        buildClient: (args) =>
          new AnthropicLlmClient({ ...ANTHROPIC_DEFAULTS, ...args }),
      })

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    }
  )

  it('throws when apiKey is missing', () => {
    expect(
      () => new AnthropicLlmClient({ apiKey: undefined, modelName: undefined })
    ).toThrow('API_KEY is required')
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
    mockFetch({
      ok: false,
      status,
      json: async () => ({ error: { type, message } }),
    })

    const client = new AnthropicLlmClient({ apiKey: 'sk-test' })

    await expect(client.sendPrompt('test', 3000)).rejects.toThrow(message)
  })

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
  })
})

describe('OllamaLlmClient', () => {
  it(
    'returns assistant text on a recorded 200 response',
    { timeout: 120000 },
    async () => {
      const css = 'body { color: #ff0000; font-size: 16px; }'
      const prompt = buildAuditPrompt(css)

      const result = await runRecordingScenario({
        provider: 'ollama',
        fixtureName: 'audit-200-simple-css',
        prompt,
        maxToken: 3000,
        mockFetch,
        buildClient: (args) =>
          new OllamaLlmClient({ ...OLLAMA_DEFAULTS, ...args }),
      })

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    }
  )

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
          options: { num_predict: 512 },
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
    await expect(client.sendPrompt('test', 512)).rejects.toThrow(
      'Ollama API error (500)'
    )
  })

  it.each([
    [400, 'missing required parameter'],
    [404, 'model "gemma4" not found'],
    [429, 'rate limit exceeded'],
    [500, 'internal server error'],
    [502, 'bad gateway'],
  ])(
    'throws the message from the response body on %i',
    async (status, message) => {
      mockFetch({
        ok: false,
        status,
        json: async () => ({ error: message }),
      })

      const client = new OllamaLlmClient(OLLAMA_DEFAULTS)

      await expect(client.sendPrompt('test', 512)).rejects.toThrow(message)
    }
  )

  it('throws an Error whose message equals data.error verbatim', async () => {
    mockFetch({
      ok: false,
      status: 404,
      json: async () => ({ error: 'the model failed to generate a response' }),
    })

    const client = new OllamaLlmClient(OLLAMA_DEFAULTS)

    await expect(client.sendPrompt('test', 512)).rejects.toMatchObject({
      message: 'the model failed to generate a response',
    })
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
        body: JSON.stringify({
          model: 'gemma4',
          options: { num_predict: 512 },
          messages: [
            { role: 'system', content: 'be brief' },
            { role: 'user', content: 'user msg' },
          ],
          stream: false,
        }),
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
    expect(client.apiKey).toBeUndefined()
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

    const client = new OllamaLlmClient({
      ...OLLAMA_DEFAULTS,
      apiKey: 'test-key',
    })
    await client.sendPrompt('hi', 512)

    const [, init] = fetchSpy.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer test-key')
    expect(init.headers['Content-Type']).toBe('application/json')
  })
})

describe('OpenRouterLlmClient', () => {
  it(
    'returns text on a recorded 200 response',
    { timeout: 120000 },
    async () => {
      const css = 'body { color: #ff0000; font-size: 16px; }'
      const prompt = buildAuditPrompt(css)

      const result = await runRecordingScenario({
        provider: 'openrouter',
        fixtureName: 'audit-200-simple-css',
        prompt,
        maxToken: 3000,
        apiKeyEnvVar: 'API_KEY',
        mockFetch,
        buildClient: (args) =>
          new OpenRouterLlmClient({ ...OPENROUTER_DEFAULTS, ...args }),
      })

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    }
  )

  it('throws when apiKey is missing', () => {
    expect(
      () =>
        new OpenRouterLlmClient({
          apiKey: undefined,
          modelName: 'deepseek/deepseek-v4-flash',
          url: 'https://openrouter.ai/api/v1/chat/completions',
        })
    ).toThrow('API_KEY is required')
  })

  it.each([
    [400, 'Bad Request'],
    [401, 'Invalid credentials'],
    [402, 'Insufficient credits'],
    [403, 'Forbidden'],
    [408, 'Request timeout'],
    [429, 'Too Many Requests'],
    [502, 'Model is down or received invalid response'],
    [503, 'No available model provider'],
  ])('throws on %i', async (status, message) => {
    mockFetch({
      ok: false,
      status,
      json: async () => ({
        error: { code: status, message },
      }),
    })

    const client = new OpenRouterLlmClient(OPENROUTER_DEFAULTS)

    await expect(client.sendPrompt('test', 500)).rejects.toThrow(message)
  })

  it('throws generic error when response message is missing', async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: async () => ({}),
    })

    const client = new OpenRouterLlmClient(OPENROUTER_DEFAULTS)

    await expect(client.sendPrompt('test', 500)).rejects.toThrow(
      'OpenRouter API error (500)'
    )
  })

  it('handles string prompt', async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'hello from openrouter' } }],
      }),
    })

    const client = new OpenRouterLlmClient(OPENROUTER_DEFAULTS)
    const result = await client.sendPrompt('hello world', 3000)

    expect(result).toBe('hello from openrouter')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'deepseek/deepseek-v4-flash',
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
      json: async () => ({
        choices: [{ message: { content: 'result' } }],
      }),
    })

    const client = new OpenRouterLlmClient(OPENROUTER_DEFAULTS)
    await client.sendPrompt(
      { content: 'user prompt', system: 'system prompt' },
      3000
    )

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: JSON.stringify({
          model: 'deepseek/deepseek-v4-flash',
          max_tokens: 3000,
          messages: [
            { role: 'system', content: 'system prompt' },
            { role: 'user', content: 'user prompt' },
          ],
        }),
      })
    )
  })

  it('includes Authorization Bearer header', async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
      }),
    })

    const client = new OpenRouterLlmClient(OPENROUTER_DEFAULTS)
    await client.sendPrompt('hi', 512)

    const [, init] = fetchSpy.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer sk-or-v1-test')
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

  it('returns an OpenRouterLlmClient for openrouter config', () => {
    const client = getClient({
      name: 'openrouter',
      apiKey: 'sk-or-v1-test',
      model: 'deepseek/deepseek-v4-flash',
      url: 'https://openrouter.ai/api/v1/chat/completions',
    })
    expect(client).toBeInstanceOf(OpenRouterLlmClient)
    expect(client.apiKey).toBe('sk-or-v1-test')
    expect(client.modelName).toBe('deepseek/deepseek-v4-flash')
    expect(client.url).toBe('https://openrouter.ai/api/v1/chat/completions')
  })
})

describe('provider registry', () => {
  it('returns the anthropic provider by name', () => {
    const provider = getProvider('anthropic')
    expect(provider.name).toBe('anthropic')
    expect(provider.defaults.url).toBe('https://api.anthropic.com/v1/messages')
    expect(provider.defaults.model).toBe('claude-sonnet-4-20250514')
    expect(provider.defaults.maxTokens).toEqual({
      audit: 3000,
      parse: 4000,
      export: 6000,
    })
  })

  it('returns the ollama provider by name', () => {
    const provider = getProvider('ollama')
    expect(provider.name).toBe('ollama')
    expect(provider.defaults.url).toBe('http://localhost:11434/api/chat')
    expect(provider.defaults.model).toBe('gemma4')
    expect(provider.defaults.maxTokens).toEqual({
      audit: 8000,
      parse: 10000,
      export: 8000,
    })
  })

  it('throws for unknown provider', () => {
    expect(() => getProvider('foo')).toThrow('Unsupported LLM provider: foo')
  })

  it('lists both providers', () => {
    const names = listProviders()
      .map((p) => p.name)
      .sort()
    expect(names).toEqual(['anthropic', 'ollama', 'openrouter'])
  })
})

describe('buildConfigFromFlags', () => {
  it('overrides env apiKey with flag value', () => {
    const config = buildConfigFromFlags(
      { 'api-key': 'flag-key' },
      { API_KEY: 'env-key' }
    )
    expect(config.apiKey).toBe('flag-key')
  })

  it('selects ollama config when --provider ollama', () => {
    const config = buildConfigFromFlags({ provider: 'ollama' })
    expect(config.name).toBe('ollama')
    expect(config.url).toBe('http://localhost:11434/api/chat')
    expect(config.cssAuditor.maxTokens).toEqual({
      audit: 8000,
      parse: 10000,
      export: 8000,
    })
  })

  it('selects openrouter config when --provider openrouter', () => {
    const config = buildConfigFromFlags({ provider: 'openrouter' })
    expect(config.name).toBe('openrouter')
    expect(config.url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(config.model).toBe('deepseek/deepseek-v4-flash')
    expect(config.cssAuditor.maxTokens).toEqual({
      audit: 16384,
      parse: 16384,
      export: 16384,
    })
  })

  it('reads apiKey from injected env', () => {
    const config = buildConfigFromFlags({}, { API_KEY: 'injected-key' })
    expect(config.apiKey).toBe('injected-key')
  })

  it('reads apiKey from injected env with deprecated ANTHROPIC_API_KEY env var', () => {
    const config = buildConfigFromFlags(
      {},
      { ANTHROPIC_API_KEY: 'injected-key' }
    )
    expect(config.apiKey).toBe('injected-key')
  })

  it.each([
    {
      provider: 'anthropic',
      envVar: 'ANTHROPIC_API_KEY',
      provKey: 'anthro-key',
    },
    { provider: 'ollama', envVar: 'OLLAMA_API_KEY', provKey: 'ollama-key' },
    { provider: 'openrouter', envVar: 'OPENROUTER_API_KEY', provKey: 'or-key' },
  ])(
    'prefers --api-key flag over $envVar and generic API_KEY when using --provider $provider',
    ({ provider, envVar, provKey }) => {
      const config = buildConfigFromFlags(
        { provider, 'api-key': 'flag-key' },
        { [envVar]: provKey, API_KEY: 'gen-key' }
      )
      expect(config.apiKey).toBe('flag-key')
      expect(config.name).toBe(provider)
    }
  )

  it.each([
    { provider: 'anthropic', envVar: 'ANTHROPIC_API_KEY', key: 'sk-ant-123' },
    { provider: 'ollama', envVar: 'OLLAMA_API_KEY', key: 'sk-ollama-123' },
    { provider: 'openrouter', envVar: 'OPENROUTER_API_KEY', key: 'sk-or-123' },
  ])(
    'prefers $envVar over generic API_KEY when using --provider $provider',
    ({ provider, envVar, key }) => {
      const config = buildConfigFromFlags(
        { provider },
        { API_KEY: 'generic-fallback', [envVar]: key }
      )
      expect(config.apiKey).toBe(key)
      expect(config.name).toBe(provider)
    }
  )

  it.each([
    { provider: 'anthropic' },
    { provider: 'ollama' },
    { provider: 'openrouter' },
  ])(
    'falls back to API_KEY when provider-specific env var is not set (--provider $provider)',
    ({ provider }) => {
      const config = buildConfigFromFlags(
        { provider },
        { API_KEY: 'fallback-key' }
      )
      expect(config.apiKey).toBe('fallback-key')
      expect(config.name).toBe(provider)
    }
  )

  it('ollama works without any API key set', () => {
    const config = buildConfigFromFlags({ provider: 'ollama' }, {})
    expect(config.name).toBe('ollama')
    expect(config.apiKey).toBeUndefined()
  })

  it('uses ANTHROPIC_API_KEY as per-provider key when provider defaults to anthropic', () => {
    const config = buildConfigFromFlags(
      {},
      { ANTHROPIC_API_KEY: 'backcompat-key' }
    )
    expect(config.name).toBe('anthropic')
    expect(config.apiKey).toBe('backcompat-key')
  })

  it.each([
    {
      provider: 'anthropic',
      envVar: 'ANTHROPIC_MODEL_NAME',
      provModel: 'claude-prov-env',
      genericModel: 'generic-env-model',
      flagModel: 'claude-flag',
    },
    {
      provider: 'ollama',
      envVar: 'OLLAMA_MODEL_NAME',
      provModel: 'ollama-prov-env',
      genericModel: 'generic-env-model',
      flagModel: 'ollama-flag',
    },
    {
      provider: 'openrouter',
      envVar: 'OPENROUTER_MODEL_NAME',
      provModel: 'or-prov-env',
      genericModel: 'generic-env-model',
      flagModel: 'or-flag',
    },
  ])(
    'prefers --model flag over $envVar and generic LLM_MODEL_NAME when using --provider $provider',
    ({ provider, envVar, provModel, genericModel, flagModel }) => {
      const config = buildConfigFromFlags(
        { provider, model: flagModel },
        { [envVar]: provModel, LLM_MODEL_NAME: genericModel }
      )
      expect(config.model).toBe(flagModel)
      expect(config.name).toBe(provider)
    }
  )

  it.each([
    {
      provider: 'anthropic',
      envVar: 'ANTHROPIC_MODEL_NAME',
      model: 'claude-opus-5',
    },
    { provider: 'ollama', envVar: 'OLLAMA_MODEL_NAME', model: 'llama4-custom' },
    {
      provider: 'openrouter',
      envVar: 'OPENROUTER_MODEL_NAME',
      model: 'google/gemini-pro',
    },
  ])(
    'prefers $envVar over generic LLM_MODEL_NAME when using --provider $provider',
    ({ provider, envVar, model }) => {
      const config = buildConfigFromFlags(
        { provider },
        { LLM_MODEL_NAME: 'generic-model', [envVar]: model }
      )
      expect(config.model).toBe(model)
      expect(config.name).toBe(provider)
    }
  )

  it.each([
    { provider: 'anthropic', defaultModel: 'claude-sonnet-4-20250514' },
    { provider: 'ollama', defaultModel: 'gemma4' },
    { provider: 'openrouter', defaultModel: 'deepseek/deepseek-v4-flash' },
  ])(
    'falls back to LLM_MODEL_NAME when provider-specific env var is not set (--provider $provider)',
    ({ provider, defaultModel }) => {
      const config = buildConfigFromFlags(
        { provider },
        { LLM_MODEL_NAME: 'fallback-model' }
      )
      expect(config.model).toBe('fallback-model')
      expect(config.name).toBe(provider)
    }
  )

  it('uses provider default model when no env vars or flags set', () => {
    const anthropic = buildConfigFromFlags({ provider: 'anthropic' }, {})
    expect(anthropic.model).toBe('claude-sonnet-4-20250514')

    const ollama = buildConfigFromFlags({ provider: 'ollama' }, {})
    expect(ollama.model).toBe('gemma4')

    const openrouter = buildConfigFromFlags({ provider: 'openrouter' }, {})
    expect(openrouter.model).toBe('deepseek/deepseek-v4-flash')
  })

  it('falls back to defaults when injected env is empty', () => {
    const config = buildConfigFromFlags({}, {})
    expect(config.name).toBe('anthropic')
    expect(config.url).toBe('https://api.anthropic.com/v1/messages')
    expect(config.model).toBe('claude-sonnet-4-20250514')
    expect(config.apiKey).toBeUndefined()
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
    const config = buildConfigFromFlags(
      { 'api-key': 'flag-key' },
      { API_KEY: 'env-key' }
    )
    expect(config.name).toBe('anthropic')
    expect(config.apiKey).toBe('flag-key')
    const auditor = buildCssAuditorFromConfig(config)
    expect(auditor.client.apiKey).toBe('flag-key')
  })

  it('uses env apiKey when no flag override', () => {
    const config = buildConfigFromFlags({}, { API_KEY: 'env-key' })
    expect(config.apiKey).toBe('env-key')
  })

  it('throws for unknown provider name', () => {
    expect(() =>
      buildConfigFromFlags({ provider: 'unknown-provider' })
    ).toThrow('Unsupported LLM provider: unknown-provider')
  })
})
