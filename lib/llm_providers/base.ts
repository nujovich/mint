export interface PromptInput {
  content: string
  system?: string
}

export class LlmClient {
  async sendPrompt(prompt: string | PromptInput, maxToken: number): Promise<string> {
    throw new Error('Not implemented')
  }
}
