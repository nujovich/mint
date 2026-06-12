import { getProvider } from './llm_providers/registry.mjs'

function readEnv(env = process.env) {
  return {
    llmProvider: {
      name: env.LLM_PROVIDER_NAME ?? 'anthropic',
      url: env.LLM_API_URL,
      model: env.LLM_MODEL_NAME,
      apiKey: env.API_KEY,
    },
    cssAuditor: {
      maxTokens: {
        audit: env.CCS_MAX_TOKENS_AUDIT,
        parse: env.CCS_MAX_TOKENS_PARSE,
        export: env.CCS_MAX_TOKENS_EXPORT,
      },
    },
  }
}

function buildDefaults(providerName, env) {
  const provider = getProvider(providerName)
  const { maxTokens, ...rest } = provider.defaults
  return {
    ...rest,
    url: env.llmProvider.url || rest.url,
    model: env.llmProvider.model || rest.model,
    apiKey: env.llmProvider.apiKey ?? undefined,
    cssAuditor: {
      maxTokens: {
        audit: env.cssAuditor.maxTokens.audit || maxTokens.audit,
        parse: env.cssAuditor.maxTokens.parse || maxTokens.parse,
        export: env.cssAuditor.maxTokens.export || maxTokens.export,
      },
    },
  }
}

function buildConfig(env, flags = {}) {
  const provider = typeof flags?.['provider'] === 'string' ? flags['provider'] : env.llmProvider.name
  const base = buildDefaults(provider, env)
  const apiKey = typeof flags?.['api-key'] === 'string' ? flags['api-key'] : base.apiKey
  return { ...base, apiKey, name: provider }
}

export function buildConfigFromFlags(flags, env = process.env) {
  return buildConfig(readEnv(env), flags)
}
