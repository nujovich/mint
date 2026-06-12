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
  switch (providerName) {
    case 'anthropic':
      return {
        url: 'https://api.anthropic.com/v1/messages',
        model: env.llmProvider.model || 'claude-sonnet-4-20250514',
        apiKey: env.llmProvider.apiKey ?? undefined,
        version: '2023-06-01',
        cssAuditor: {
          maxTokens: {
            audit: env.cssAuditor.maxTokens.audit || 3000,
            parse: env.cssAuditor.maxTokens.parse || 4000,
            export: env.cssAuditor.maxTokens.export || 6000,
          },
        },
      }
    case 'ollama':
      return {
        url: env.llmProvider.url || 'http://localhost:11434/api/chat',
        model: env.llmProvider.model || 'gemma4',
        apiKey: env.llmProvider.apiKey ?? undefined,
        cssAuditor: {
          maxTokens: {
            audit: env.cssAuditor.maxTokens.audit || 10000,
            parse: env.cssAuditor.maxTokens.parse || 10000,
            export: env.cssAuditor.maxTokens.export || 10000,
          },
        },
      }
    default:
      throw new Error(`Unsupported LLM provider: ${providerName}`)
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
