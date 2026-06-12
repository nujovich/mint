import { AnthropicLlmClient } from './client-impl.mjs'

export const anthropicProvider = {
  name: 'anthropic',
  defaults: {
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
    version: '2023-06-01',
    maxTokens: { audit: 3000, parse: 4000, export: 6000 },
  },
  buildClient: (config) => new AnthropicLlmClient({
    apiKey: config.apiKey,
    modelName: config.model,
    version: config.version,
    url: config.url,
  }),
}
