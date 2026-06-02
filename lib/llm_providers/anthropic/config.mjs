

export const anthropicConfig = {
  model: 'claude-sonnet-4-20250514',
  apiKey: process.env.ANTHROPIC_API_KEY ?? undefined,
  cssAuditor: {
    maxTokens: {
        audit: 3000,
        parse: 4000,
        export: 6000,
    },
  }
}