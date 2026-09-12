import { describe, it, expect } from 'vitest'
import {
  normalizeColor,
  parseSpacingPx,
  normalizeFontFamily,
  hexToRgb,
  detectColorSpace,
} from '../css-values.mjs'

describe('normalizeColor', () => {
  it('lowercases and expands hex forms to #rrggbb', () => {
    expect(normalizeColor('#1976D2')).toBe('#1976d2')
    expect(normalizeColor('#abc')).toBe('#aabbcc')
    expect(normalizeColor('#1976d2')).toBe('#1976d2')
    expect(normalizeColor('#197f')).toBe('#119977')
  })

  it('parses rgb() to #rrggbb', () => {
    expect(normalizeColor('rgb(25, 118, 210)')).toBe('#1976d2')
    expect(normalizeColor('rgb(25,118,210)')).toBe('#1976d2')
  })

  it('parses hsl() to #rrggbb', () => {
    expect(normalizeColor('hsl(207, 79%, 46%)')).toBe('#197fd2')
  })

  it('returns null for colors with alpha < 1', () => {
    expect(normalizeColor('rgba(25, 118, 210, 0.5)')).toBeNull()
    expect(normalizeColor('#1976d280')).toBeNull()
    expect(normalizeColor('hsla(207, 79%, 46%, 0.5)')).toBeNull()
    expect(normalizeColor('#1976')).toBeNull()
  })

  it('keeps fully-opaque alpha forms', () => {
    expect(normalizeColor('rgba(25, 118, 210, 1)')).toBe('#1976d2')
    expect(normalizeColor('#1976d2ff')).toBe('#1976d2')
  })

  it('returns null for non-colors', () => {
    expect(normalizeColor('inherit')).toBeNull()
    expect(normalizeColor('')).toBeNull()
    expect(normalizeColor('var(--x)')).toBeNull()
  })
})

describe('parseSpacingPx', () => {
  it('parses px values to a number', () => {
    expect(parseSpacingPx('13px')).toBe(13)
    expect(parseSpacingPx('  8px ')).toBe(8)
    expect(parseSpacingPx('0px')).toBe(0)
  })

  it('returns null for non-px or unitless (except explicit px)', () => {
    expect(parseSpacingPx('1rem')).toBeNull()
    expect(parseSpacingPx('50%')).toBeNull()
    expect(parseSpacingPx('auto')).toBeNull()
    expect(parseSpacingPx('16')).toBeNull()
  })

  it('returns null for malformed multi-dot numeric values', () => {
    expect(parseSpacingPx('1.2.3px')).toBeNull()
  })
})

describe('normalizeFontFamily', () => {
  it('lowercases, trims, and collapses whitespace after commas', () => {
    expect(normalizeFontFamily('Inter,  sans-serif')).toBe('inter, sans-serif')
    expect(normalizeFontFamily('  Inter , sans-serif ')).toBe(
      'inter, sans-serif'
    )
  })

  it('strips surrounding quotes on individual families', () => {
    expect(normalizeFontFamily('"Helvetica Neue", Arial')).toBe(
      'helvetica neue, arial'
    )
    expect(normalizeFontFamily("'Open Sans', sans-serif")).toBe(
      'open sans, sans-serif'
    )
  })
})

describe('hexToRgb', () => {
  it('parses #rrggbb into r/g/b integers', () => {
    expect(hexToRgb('#1976d2')).toEqual({ r: 25, g: 118, b: 210 })
  })
})

describe('detectColorSpace', () => {
  it('classifies hex forms as legacy', () => {
    expect(detectColorSpace('#1976D2')).toEqual({
      format: 'hex',
      category: 'legacy',
    })
    expect(detectColorSpace('#abc')).toEqual({
      format: 'hex',
      category: 'legacy',
    })
    expect(detectColorSpace('#1976d2ff')).toEqual({
      format: 'hex',
      category: 'legacy',
    })
  })

  it('classifies rgb() and hsl() forms as legacy', () => {
    expect(detectColorSpace('rgb(25, 118, 210)')).toEqual({
      format: 'rgb',
      category: 'legacy',
    })
    expect(detectColorSpace('rgba(25, 118, 210, 0.5)')).toEqual({
      format: 'rgb',
      category: 'legacy',
    })
    expect(detectColorSpace('hsl(207, 79%, 46%)')).toEqual({
      format: 'hsl',
      category: 'legacy',
    })
    expect(detectColorSpace('hsla(207, 79%, 46%, 1)')).toEqual({
      format: 'hsl',
      category: 'legacy',
    })
  })

  it('classifies oklch() and oklab() as wide-gamut', () => {
    expect(detectColorSpace('oklch(70% 0.1 250)')).toEqual({
      format: 'oklch',
      category: 'wide-gamut',
    })
    expect(detectColorSpace('oklab(70% 0.1 0.1)')).toEqual({
      format: 'oklab',
      category: 'wide-gamut',
    })
  })

  it('classifies color(display-p3 ...) as wide-gamut', () => {
    expect(detectColorSpace('color(display-p3 1 0.5 0)')).toEqual({
      format: 'display-p3',
      category: 'wide-gamut',
    })
  })

  it('returns null for non-color and unrecognized values', () => {
    expect(detectColorSpace('inherit')).toBeNull()
    expect(detectColorSpace('transparent')).toBeNull()
    expect(detectColorSpace('red')).toBeNull()
    expect(detectColorSpace('var(--brand)')).toBeNull()
    expect(detectColorSpace('color(srgb 1 0 0)')).toBeNull()
    expect(detectColorSpace('')).toBeNull()
    expect(detectColorSpace('   ')).toBeNull()
    expect(detectColorSpace(null)).toBeNull()
    expect(detectColorSpace(42)).toBeNull()
  })
})
