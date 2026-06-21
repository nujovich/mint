import { getProvider } from './llm_providers/registry.mjs'

function readEnv(env = process.env) {
  return {
    parsed: {
      llmProvider: {
        name: env.LLM_PROVIDER_NAME ?? 'anthropic',
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

function buildEnvVarName(providerName, suffix) {
  return `${providerName.toUpperCase()}_${suffix}`
}

function resolveProviderProperty({
  rawEnv,
  providerName,
  suffix,
  fallbackEnvVar,
}) {
  const perProviderKey = buildEnvVarName(providerName, suffix)
  if (rawEnv[perProviderKey]) return rawEnv[perProviderKey]
  if (rawEnv[fallbackEnvVar]) return rawEnv[fallbackEnvVar]
  return undefined
}

function buildDefaults(providerName, parsed, rawEnv) {
  const provider = getProvider(providerName)

  const { maxTokens: providerDefaultMaxTokens, ...providerDefaults } =
    provider.defaults

  const resolvedAPIKey = resolveProviderProperty({
    rawEnv,
    providerName,
    suffix: 'API_KEY',
    fallbackEnvVar: 'API_KEY',
  })

  return {
    ...providerDefaults,
    apiKey: resolvedAPIKey,
    cssAuditor: {
      maxTokens: {
        audit:
          parsed.cssAuditor.maxTokens.audit || providerDefaultMaxTokens.audit,
        parse:
          parsed.cssAuditor.maxTokens.parse || providerDefaultMaxTokens.parse,
        export:
          parsed.cssAuditor.maxTokens.export || providerDefaultMaxTokens.export,
      },
    },
  }
}

function buildConfig(parsedEnv, flags = {}, rawEnv) {
  const provider =
    typeof flags?.['provider'] === 'string'
      ? flags['provider']
      : parsedEnv.llmProvider.name

  const base = buildDefaults(provider, parsedEnv, rawEnv)

  const apiKey =
    typeof flags?.['api-key'] === 'string' ? flags['api-key'] : base.apiKey

  return { ...base, apiKey, name: provider }
}

export function buildConfigFromFlags(flags = {}, rawEnv = process.env) {
  const { parsed, raw } = readEnv(rawEnv)
  return buildConfig(parsed, flags, raw)
}
