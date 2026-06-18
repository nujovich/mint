import { getProvider } from './llm_providers/registry.mjs'

function readEnv(env = process.env) {
  return {
    parsed: {
      llmProvider: {
        name: env.LLM_PROVIDER_NAME ?? 'anthropic',
        // TODO: read from env.LLM_API_URL
        url: undefined,
        // TODO: read from env.LLM_MODEL_NAME
        model: undefined,
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
    },
    raw: env,
  }
}

function resolveApiKey(apiKeyEnv, rawEnv) {
  // Take environment variable specified by provider defaults
  if (apiKeyEnv && rawEnv[apiKeyEnv]) return rawEnv[apiKeyEnv]
  // Fallback to generic API_KEY environment variable
  if (rawEnv.API_KEY) return rawEnv.API_KEY
  return undefined
}

function buildDefaults(providerName, parsed, rawEnv) {
  const provider = getProvider(providerName)

  const {
    maxTokens: defaultMaxTokensFromProvider,
    apiKeyEnv: apiKeySpecificEnvVarFromProvider,
    ...rest
  } = provider.defaults

  return {
    ...rest,
    url: parsed.llmProvider.url || rest.url,
    model: parsed.llmProvider.model || rest.model,
    apiKey: resolveApiKey(apiKeySpecificEnvVarFromProvider, rawEnv),
    cssAuditor: {
      maxTokens: {
        audit:
          parsed.cssAuditor.maxTokens.audit ||
          defaultMaxTokensFromProvider.audit,
        parse:
          parsed.cssAuditor.maxTokens.parse ||
          defaultMaxTokensFromProvider.parse,
        export:
          parsed.cssAuditor.maxTokens.export ||
          defaultMaxTokensFromProvider.export,
      },
    },
  }
}

function buildConfig(parsedEnv, flags = {}, rawEnv) {
  // Build base config for the specified provider
  const provider =
    typeof flags?.['provider'] === 'string'
      ? flags['provider']
      : parsedEnv.llmProvider.name
  const base = buildDefaults(provider, parsedEnv, rawEnv)

  // Override with any flags provided at runtime
  const apiKey =
    typeof flags?.['api-key'] === 'string' ? flags['api-key'] : base.apiKey
  const model =
    typeof flags?.['model'] === 'string' ? flags['model'] : base.model

  return { ...base, apiKey, model, name: provider }
}

export function buildConfigFromFlags(flags = {}, rawEnv = process.env) {
  const { parsed, raw } = readEnv(rawEnv)
  return buildConfig(parsed, flags, raw)
}
