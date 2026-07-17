import { LlmClient } from '../base.mjs'
import { fetchWithRetry } from '../../net-utils.mjs'

export class OpenRouterLlmClient extends LlmClient {
  constructor({ apiKey, modelName, url }) {
    if (!apiKey) {
      throw new Error('API_KEY is required')
    }

    super()
    this.apiKey = apiKey
    this.modelName = modelName
    this.url = url
  }

  async sendPrompt(prompt, maxToken) {
    const content = typeof prompt === 'string' ? prompt : prompt.content
    const system = typeof prompt === 'string' ? undefined : prompt.system

    const messages = []
    if (system) messages.push({ role: 'system', content: system })
    messages.push({ role: 'user', content })

    const body = {
      model: this.modelName,
      max_tokens: maxToken,
      messages,
    }

    const res = await fetchWithRetry(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (!res.ok) {
      const msg = data?.error?.message || `OpenRouter API error (${res.status})`
      if (data?.error?.metadata) console.warn(data.error.metadata)
      throw new Error(msg)
    }

    return data?.choices?.[0]?.message?.content ?? ''
  }
}
