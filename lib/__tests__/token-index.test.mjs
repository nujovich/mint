import { describe, it, expect } from 'vitest'
import { buildTokenIndex } from '../token-index.mjs'

const TOKENS = {
  brand: 'demo',
  colors: [
    {
      name: 'primary',
      value: '#1976d2',
      scale: { 500: '#1976d2', 600: '#1565c0', 50: '#e3f2fd' },
    },
  ],
  typography: { fontFamilies: { body: 'Inter, sans-serif' } },
  spacing: { 1: '4px', 2: '8px', 6: '24px' },
}

describe('buildTokenIndex', () => {
  it('maps the representative color to the semantic base var', () => {
    const idx = buildTokenIndex(TOKENS)
    expect(idx.colorExact.get('#1976d2')).toBe('--color-primary')
  })

  it('maps non-500 scale steps to numbered vars', () => {
    const idx = buildTokenIndex(TOKENS)
    expect(idx.colorExact.get('#1565c0')).toBe('--color-primary-600')
    expect(idx.colorExact.get('#e3f2fd')).toBe('--color-primary-50')
  })

  it('inverts the spacing scale to px -> var', () => {
    const idx = buildTokenIndex(TOKENS)
    expect(idx.spacingExact.get(4)).toBe('--spacing-1')
    expect(idx.spacingExact.get(8)).toBe('--spacing-2')
    expect(idx.spacingExact.get(24)).toBe('--spacing-6')
  })

  it('maps normalized font families to font vars', () => {
    const idx = buildTokenIndex(TOKENS)
    expect(idx.fontExact.get('inter, sans-serif')).toBe('--font-body')
  })

  it('marks a color shared by two tokens as ambiguous and drops it from colorExact', () => {
    const tokens = {
      ...TOKENS,
      colors: [
        { name: 'primary', value: '#1976d2', scale: { 500: '#1976d2' } },
        { name: 'brandblue', value: '#1976d2', scale: { 500: '#1976d2' } },
      ],
    }
    const idx = buildTokenIndex(tokens)
    expect(idx.ambiguousColors.has('#1976d2')).toBe(true)
    expect(idx.colorExact.has('#1976d2')).toBe(false)
  })

  it('builds colorList and spacingList for fuzzy matching', () => {
    const idx = buildTokenIndex(TOKENS)
    expect(idx.colorList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          r: 25,
          g: 118,
          b: 210,
          varName: '--color-primary',
        }),
      ])
    )
    expect(idx.spacingList).toEqual(
      expect.arrayContaining([{ px: 4, varName: '--spacing-1' }])
    )
  })
})
