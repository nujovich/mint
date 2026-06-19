import { OllamaLlmClient } from './client-impl.mjs'

export const ollamaProvider = {
  name: 'ollama',
  defaults: {
    url: 'http://localhost:11434/api/chat',
    model: 'gemma4',
    maxTokens: { audit: 8000, parse: 10000, export: 8000 },
  },
  buildClient: (config) =>
    new OllamaLlmClient({
      apiKey: config.apiKey,
      modelName: config.model,
      url: config.url,
    }),
}
