import { AnthropicLlmClient } from './llm_providers/anthropic/client.mjs'
import { llmProviderConfigs } from './llm_providers/config.mjs'
import { settings } from './settings.mjs' 

export class CssAuditor {
  constructor(client, config) {
    this.client = client
    this.config = config
  }

  static stripFences(raw) {
    return String(raw)
      .replace(/^```[\w-]*\n?/m, '')
      .replace(/^```\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim()
  }

  async audit(prompt) {
    const text = await this.client.sendPrompt(prompt, this.config.maxTokens.audit)
    return JSON.parse(CssAuditor.stripFences(text))
  }

  async parse(prompt) {
    const text = await this.client.sendPrompt(prompt, this.config.maxTokens.parse)
    return JSON.parse(CssAuditor.stripFences(text))
  }

  async export(prompt) {
    const text = await this.client.sendPrompt(prompt, this.config.maxTokens.export)
    return CssAuditor.stripFences(text)
  }
}

export function buildCssAuditorFromSettingsAndFlags(appSettings, flags) {

  const llmProviderName = appSettings.llmProviderName
  const llmProviderConfig = llmProviderConfigs[llmProviderName]
  if (!llmProviderConfig) throw new Error(`Unsupported LLM provider: ${llmProviderName}`)

  const apiKey = typeof flags?.['api-key'] === 'string' ? flags['api-key'] : (appSettings.apiKey ?? llmProviderConfig.apiKey)
  let client = undefined
  if (llmProviderName == 'anthropic')
    client = new AnthropicLlmClient({ apiKey, modelName: llmProviderConfig.model })

  return new CssAuditor(client, llmProviderConfig.cssAuditor)
}

export function getCssAuditor(flags) {
  return buildCssAuditorFromSettingsAndFlags(settings, flags)
}
