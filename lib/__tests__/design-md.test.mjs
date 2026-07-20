import { describe, it, expect } from 'vitest'
import { convertTokensToDesignMd } from '../design-md.mjs'

describe('convertTokensToDesignMd', () => {
  it('falls back to "Design System" title when brand is empty/missing', () => {
    expect(convertTokensToDesignMd({})).toBe('# Design System')
    expect(convertTokensToDesignMd({ brand: '' })).toBe('# Design System')
    expect(convertTokensToDesignMd({ brand: '   ' })).toBe('# Design System')
  })

  it('uses the brand in the title when present', () => {
    expect(convertTokensToDesignMd({ brand: 'Acme' })).toBe(
      '# Acme Design System'
    )
  })

  it('renders a per-color subsection with a Step | Value table', () => {
    const md = convertTokensToDesignMd({
      colors: [{ name: 'primary', scale: { 50: '#eef', 500: '#123456' } }],
    })
    expect(md).toContain('## Colors')
    expect(md).toContain('### primary')
    expect(md).toContain('| Step | Value |')
    expect(md).toContain('| 50 | #eef |')
    expect(md).toContain('| 500 | #123456 |')
  })

  it('renders a color description as an emphasized note only when non-empty', () => {
    const withDesc = convertTokensToDesignMd({
      colors: [
        {
          name: 'primary',
          scale: { 500: '#123' },
          description: 'Primary actions',
        },
      ],
    })
    expect(withDesc).toContain('_Primary actions_')

    const withoutDesc = convertTokensToDesignMd({
      colors: [{ name: 'primary', scale: { 500: '#123' }, description: '' }],
    })
    expect(withoutDesc).not.toContain('_')
  })

  it('skips colors that have no scale', () => {
    const md = convertTokensToDesignMd({ colors: [{ name: 'ghost' }] })
    expect(md).not.toContain('### ghost')
    expect(md).not.toContain('## Colors')
  })

  it('renders typography sub-maps as Token | Value tables', () => {
    const md = convertTokensToDesignMd({
      typography: {
        fontFamilies: { body: 'Inter' },
        fontSizes: { base: '16px' },
        fontWeights: { bold: 700 },
        lineHeights: { tight: 1.2 },
      },
    })
    expect(md).toContain('## Typography')
    expect(md).toContain('### Font families')
    expect(md).toContain('| body | Inter |')
    expect(md).toContain('### Font sizes')
    expect(md).toContain('| base | 16px |')
    expect(md).toContain('### Font weights')
    expect(md).toContain('| bold | 700 |')
    expect(md).toContain('### Line heights')
    expect(md).toContain('| tight | 1.2 |')
  })

  it('renders motion (from typography.motion) as its own section', () => {
    const md = convertTokensToDesignMd({
      typography: {
        motion: {
          durations: { fast: '150ms' },
          easings: { standard: 'cubic-bezier(0.4, 0, 0.2, 1)' },
        },
      },
    })
    expect(md).toContain('## Motion')
    expect(md).toContain('### Durations')
    expect(md).toContain('| fast | 150ms |')
    expect(md).toContain('### Easings')
    expect(md).toContain('| standard | cubic-bezier(0.4, 0, 0.2, 1) |')
  })

  it('renders spacing, border radius and shadows as Token | Value tables', () => {
    const md = convertTokensToDesignMd({
      spacing: { 1: '4px' },
      borderRadius: { sm: '4px' },
      shadows: { sm: '0 1px 2px rgba(0,0,0,0.05)' },
    })
    expect(md).toContain('## Spacing')
    expect(md).toContain('| 1 | 4px |')
    expect(md).toContain('## Border radius')
    expect(md).toContain('| sm | 4px |')
    expect(md).toContain('## Shadows')
    expect(md).toContain('| sm | 0 1px 2px rgba(0,0,0,0.05) |')
  })

  it('omits empty categories entirely (no heading, no empty table)', () => {
    const md = convertTokensToDesignMd({
      brand: 'Min',
      typography: { fontSizes: {}, lineHeights: {} },
      spacing: {},
      shadows: {},
    })
    expect(md).toBe('# Min Design System')
  })

  it('is deterministic — identical input yields byte-identical output', () => {
    const tokens = {
      brand: 'Acme',
      colors: [{ name: 'primary', scale: { 500: '#123' } }],
      spacing: { 1: '4px', 2: '8px' },
    }
    expect(convertTokensToDesignMd(tokens)).toBe(
      convertTokensToDesignMd(tokens)
    )
  })
})
