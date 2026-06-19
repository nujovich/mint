import { OpenRouterLlmClient } from './client-impl.mjs'

export const openrouterProvider = {
  name: 'openrouter',
  defaults: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'deepseek/deepseek-v4-flash',
    maxTokens: { audit: 16384, parse: 16384, export: 16384 },
  },
  buildClient: (config) =>
    new OpenRouterLlmClient({
      apiKey: config.apiKey,
      modelName: config.model,
      url: config.url,
    }),
}
