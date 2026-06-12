import { LlmClient } from '../base.mjs'

export class OllamaLlmClient extends LlmClient {
  constructor({ apiKey, modelName, url }) {
    super()
    this.apiKey = apiKey
    this.modelName = modelName
    this.url = url
  }

  async sendPrompt(prompt, maxToken) {
    const content = typeof prompt === 'string' ? prompt : prompt.content
    const system = typeof prompt === 'string' ? undefined : prompt.system

    const body = {
      model: this.modelName,
      options: {
        num_ctx: maxToken,
      },
      messages: [{ role: 'user', content: content }],
      stream: false,
    }

    if (system) body.messages.push({role: 'system', content: system})

    const headers = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`

    const res = await fetch(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      const msg = `Ollama API error (${res.status})`
      throw new Error(msg)
    }
    return data.message.content
  }
}
