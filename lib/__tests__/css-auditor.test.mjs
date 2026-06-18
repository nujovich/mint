import { describe, it, expect, vi } from 'vitest'
import { CssAuditor } from '../css-auditor.mjs'

describe('CssAuditor', () => {
  it('audit returns parsed JSON object', async () => {
    const rawResponse = '{"brand":"test","chaosScore":5}'
    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const prompt = { content: 'test', system: 'sys' }
    const result = await auditor.audit(prompt)

    expect(result).toEqual({ brand: 'test', chaosScore: 5 })
    expect(sendPromptSpy).toHaveBeenCalledWith(prompt, 3000)
  })

  it('audit strips fences before parsing', async () => {
    const rawResponse = '```json\n{"brand":"test","chaosScore":5}\n```'
    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit('test prompt')

    expect(result).toEqual({ brand: 'test', chaosScore: 5 })
  })

  it('parse returns parsed JSON object', async () => {
    const rawResponse = '{"brand":"test","colors":[]}'
    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const prompt = { content: 'test', system: 'sys' }
    const result = await auditor.parse(prompt)

    expect(result).toEqual({ brand: 'test', colors: [] })
    expect(sendPromptSpy).toHaveBeenCalledWith(prompt, 4000)
  })

  it('export returns stripped string', async () => {
    const rawResponse = '```css\n:root { --color: red; }\n```'
    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const prompt = { content: 'test', system: 'sys' }
    const result = await auditor.export(prompt)

    expect(result).toBe(':root { --color: red; }')
    expect(sendPromptSpy).toHaveBeenCalledWith(prompt, 6000)
  })

  it('export returns string unchanged when no fences', async () => {
    const rawResponse = ':root { --color: red; }'
    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.export('test prompt')

    expect(result).toBe(':root { --color: red; }')
  })
})

describe('CssAuditor.stripFences', () => {
  it('strips a js-fenced code block', () => {
    expect(CssAuditor.stripFences('```js\nconst x = 1\n```')).toBe(
      'const x = 1'
    )
  })

  it('strips a css-fenced code block', () => {
    expect(CssAuditor.stripFences('```css\nbody { color: red; }\n```')).toBe(
      'body { color: red; }'
    )
  })

  it('returns unfenced input unchanged', () => {
    expect(CssAuditor.stripFences('const x = 1')).toBe('const x = 1')
  })

  it('strips ```json fenced block', () => {
    expect(CssAuditor.stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })
})
