import { describe, it, expect, vi } from 'vitest'
import { CssAuditor } from '../css-auditor.mjs'
import { buildAuditPrompt } from '../prompts.mjs'

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

describe('buildAuditPrompt layout a11y', () => {
  it('includes STEP 9 for layout accessibility detection', () => {
    const css = '.flex-parent { display: flex; } .flex-child { order: 1; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('STEP 9')
    expect(prompt.content).toContain('LAYOUT ACCESSIBILITY')
  })

  it('instructs LLM to detect order breaking DOM order', () => {
    const css = '.nav { display: grid; } .nav-item { order: -1; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('ORDER BREAKING DOM ORDER')
    expect(prompt.content).toContain('order')
  })

  it('instructs LLM to check for missing tabindex fallback', () => {
    const css = '.flex { display: flex; } .flex-item { order: 2; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('REORDERING WITHOUT TABINDEX FALLBACK')
    expect(prompt.content).toContain('tabindex')
  })

  it('includes layoutA11yIssues in the output example', () => {
    const css = 'body { color: red; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('layoutA11yIssues')
    expect(prompt.content).toContain('nav-logo')
  })

  it('includes layout a11y in chaos score calculation', () => {
    const css = 'body { color: red; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('layoutA11yIssues.length')
  })
})

describe('CssAuditor layout a11y integration', () => {
  it('audit parses response with layoutA11yIssues', async () => {
    const rawResponse = JSON.stringify({
      brand: 'test',
      chaosScore: 5,
      summary: '',
      colorClusters: [],
      fonts: [],
      spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
      lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
      layoutA11yIssues: [
        {
          selector: '.nav-item',
          property: 'order',
          value: '-1',
          reason: 'Visual order differs from DOM order',
          severity: 'warning',
        },
      ],
    })

    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit({ content: 'test', system: 'sys' })
    expect(result.layoutA11yIssues).toEqual([
      {
        selector: '.nav-item',
        property: 'order',
        value: '-1',
        reason: 'Visual order differs from DOM order',
        severity: 'warning',
      },
    ])
  })

  it('audit handles empty layoutA11yIssues array', async () => {
    const rawResponse = JSON.stringify({
      brand: 'test',
      chaosScore: 3,
      summary: '',
      colorClusters: [],
      fonts: [],
      spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
      lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
      layoutA11yIssues: [],
    })

    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit({ content: 'test', system: 'sys' })
    expect(result.layoutA11yIssues).toEqual([])
  })
})

describe('buildAuditPrompt modern practices', () => {
  it('includes STEP 9 for modern CSS best practices detection', () => {
    const css = '.grid { display: grid; grid-template-columns: 1fr; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('STEP 9')
    expect(prompt.content).toContain('MODERN CSS BEST PRACTICES')
  })

  it('instructs LLM to detect single-column grids', () => {
    const css = '.container { display: grid; grid-template-columns: 1fr; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('SINGLE-COLUMN GRID')
    expect(prompt.content).toContain('grid-when-flexbox-wrap-would-work')
  })

  it('instructs LLM to detect legacy centering techniques', () => {
    const css =
      '.modal { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('LEGACY CENTERING')
    expect(prompt.content).toContain('legacy-centering')
  })

  it('instructs LLM to detect flex min-width zero hack', () => {
    const css = '.parent { display: flex; } .child { min-width: 0; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('FLEX MIN-WIDTH ZERO HACK')
    expect(prompt.content).toContain('flex-min-width-zero-hack')
  })

  it('instructs LLM to detect fragile nested selectors', () => {
    const css = '.card > .header > .title { font-size: 16px; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('FRAGILE NESTED SELECTORS')
    expect(prompt.content).toContain('fragile-nested-selectors')
  })

  it('includes modernPracticeIssues in the output example', () => {
    const css = 'body { color: red; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('modernPracticeIssues')
    expect(prompt.content).toContain('card-grid')
    expect(prompt.content).toContain('fragile-nested-selectors')
  })
})

describe('CssAuditor modernPracticeIssues integration', () => {
  it('audit parses response with modernPracticeIssues', async () => {
    const rawResponse = JSON.stringify({
      brand: 'test',
      chaosScore: 4,
      summary: '',
      colorClusters: [],
      fonts: [],
      spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
      lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
      layoutA11yIssues: [],
      modernPracticeIssues: [
        {
          selector: '.card-grid',
          rule: 'grid-when-flexbox-wrap-would-work',
          severity: 'suggestion',
          reason: 'Single-column grid layout',
        },
      ],
    })

    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit({ content: 'test', system: 'sys' })
    expect(result.modernPracticeIssues).toEqual([
      {
        selector: '.card-grid',
        rule: 'grid-when-flexbox-wrap-would-work',
        severity: 'suggestion',
        reason: 'Single-column grid layout',
      },
    ])
  })

  it('audit handles empty modernPracticeIssues array', async () => {
    const rawResponse = JSON.stringify({
      brand: 'test',
      chaosScore: 3,
      summary: '',
      colorClusters: [],
      fonts: [],
      spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
      lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
      layoutA11yIssues: [],
      modernPracticeIssues: [],
    })

    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit({ content: 'test', system: 'sys' })
    expect(result.modernPracticeIssues).toEqual([])
  })
})

describe('buildAuditPrompt adoption suggestions', () => {
  it('includes STEP 10 for modern feature adoption detection', () => {
    const css = 'body { color: red; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('STEP 10')
    expect(prompt.content).toContain('MODERN FEATURE ADOPTION')
  })

  it('instructs LLM to suggest CSS layers for large projects', () => {
    const css =
      '.a {} .b {} .c {} .d {} .e {} .f {} .g {} .h {} .i {} .j {} .k {} .l {} .m {} .n {} .o {} .p {} .q {} .r {} .s {} .t {} .u {}'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('USE CSS LAYERS')
    expect(prompt.content).toContain('use-css-layers')
  })

  it('instructs LLM to suggest container queries', () => {
    const css = '@media (min-width: 768px) { .card { width: 50%; } }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('USE CONTAINER QUERIES')
    expect(prompt.content).toContain('use-container-queries')
  })

  it('includes adoptionSuggestions in the output example', () => {
    const css = 'body { color: red; }'
    const prompt = buildAuditPrompt(css)
    expect(prompt.content).toContain('adoptionSuggestions')
    expect(prompt.content).toContain('use-css-layers')
    expect(prompt.content).toContain('product-card')
  })
})

describe('CssAuditor adoptionSuggestions integration', () => {
  it('audit parses response with adoptionSuggestions', async () => {
    const rawResponse = JSON.stringify({
      brand: 'test',
      chaosScore: 4,
      summary: '',
      colorClusters: [],
      fonts: [],
      spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
      lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
      layoutA11yIssues: [],
      modernPracticeIssues: [],
      adoptionSuggestions: [
        {
          selector: '',
          rule: 'use-css-layers',
          severity: 'info',
          reason: 'Project has 30 selector rules without @layer organization',
        },
      ],
    })

    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit({ content: 'test', system: 'sys' })
    expect(result.adoptionSuggestions).toEqual([
      {
        selector: '',
        rule: 'use-css-layers',
        severity: 'info',
        reason: 'Project has 30 selector rules without @layer organization',
      },
    ])
  })

  it('audit handles empty adoptionSuggestions array', async () => {
    const rawResponse = JSON.stringify({
      brand: 'test',
      chaosScore: 3,
      summary: '',
      colorClusters: [],
      fonts: [],
      spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
      lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
      layoutA11yIssues: [],
      modernPracticeIssues: [],
      adoptionSuggestions: [],
    })

    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit({ content: 'test', system: 'sys' })
    expect(result.adoptionSuggestions).toEqual([])
  })

  it('audit handles missing adoptionSuggestions gracefully', async () => {
    const rawResponse = JSON.stringify({
      brand: 'test',
      chaosScore: 3,
      summary: '',
      colorClusters: [],
      fonts: [],
      spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
      lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
      layoutA11yIssues: [],
      modernPracticeIssues: [],
    })

    const sendPromptSpy = vi.fn().mockResolvedValue(rawResponse)
    const mockClient = { sendPrompt: sendPromptSpy }
    const auditor = new CssAuditor(mockClient, {
      maxTokens: { audit: 3000, parse: 4000, export: 6000 },
    })

    const result = await auditor.audit({ content: 'test', system: 'sys' })
    expect(result.adoptionSuggestions).toBeUndefined()
  })
})
