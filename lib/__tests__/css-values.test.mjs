import { describe, it, expect } from 'vitest'
import {
  normalizeColor,
  parseSpacingPx,
  normalizeFontFamily,
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
