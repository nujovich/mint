import { getProvider } from './llm_providers/registry.mjs'

function readEnv(env = process.env) {
  return {
    llmProvider: {
      name: env.LLM_PROVIDER_NAME ?? 'anthropic',
      // TODO: read from env.LLM_API_URL
      url: undefined,
      // TODO: read from env.LLM_MODEL_NAME
      model: env.OPENROUTER_MODEL ?? undefined,
      apiKey: env.API_KEY || env.ANTHROPIC_API_KEY || env.OPENROUTER_API_KEY,
    },
    cssAuditor: {
      maxTokens: {
        // TODO: read from env.CSS_MAX_TOKENS_AUDIT
        audit: undefined,
        // TODO: read from env.CSS_MAX_TOKENS_PARSE
        parse: undefined,
        // TODO: read from env.CSS_MAX_TOKENS_EXPORT
        export: undefined,
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
  const provider =
    typeof flags?.['provider'] === 'string'
      ? flags['provider']
      : env.llmProvider.name
  const base = buildDefaults(provider, env)
  const apiKey =
    typeof flags?.['api-key'] === 'string' ? flags['api-key'] : base.apiKey
  const model =
    typeof flags?.['model'] === 'string' ? flags['model'] : base.model
  return { ...base, apiKey, model, name: provider }
}

export function buildConfigFromFlags(flags, env = process.env) {
  return buildConfig(readEnv(env), flags)
}
