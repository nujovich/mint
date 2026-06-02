import { LlmClient } from '../base.mjs'

export class AnthropicLlmClient extends LlmClient {
  constructor({ apiKey, modelName }) {
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required')
    }
    super()
    this.apiKey = apiKey
    this.modelName = modelName
    this.url = 'https://api.anthropic.com/v1/messages'
    this.version = '2023-06-01'
  }

  async sendPrompt(prompt, maxToken) {
    

    const content = typeof prompt === 'string' ? prompt : prompt.content
    const system = typeof prompt === 'string' ? undefined : prompt.system

    const body = {
      model: this.modelName,
      max_tokens: maxToken,
      messages: [{ role: 'user', content }],
    }
    if (system) body.system = system

    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.version,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      const msg = data?.error?.message || `Anthropic API error (${res.status})`
      throw new Error(msg)
    }
    const block = (data.content || []).find((b) => b && b.type === 'text')
    return block ? block.text : ''
  }
}
