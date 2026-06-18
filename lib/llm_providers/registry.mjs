import { anthropicProvider } from './anthropic/index.mjs'
import { ollamaProvider } from './ollama/index.mjs'
import { openrouterProvider } from './openrouter/index.mjs'

const providers = {
  [anthropicProvider.name]: anthropicProvider,
  [ollamaProvider.name]: ollamaProvider,
  [openrouterProvider.name]: openrouterProvider,
}

export function getProvider(name) {
  const provider = providers[name]
  if (!provider) {
    throw new Error(`Unsupported LLM provider: ${name}`)
  }
  return provider
}

export function listProviders() {
  return Object.values(providers)
}
