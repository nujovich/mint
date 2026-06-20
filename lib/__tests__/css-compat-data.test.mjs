import { describe, it, expect } from 'vitest'
import {
  getBaselineStatus,
  isBaseline,
  isWidelyAvailable,
  getSupportInfo,
  getKnownProperties,
  getPropertyCount,
} from '../css-compat-data.mjs'

describe('getBaselineStatus', () => {
  it('returns "high" for a widely available property (display)', () => {
    const status = getBaselineStatus('display')
    expect(status).toBe('high')
  })

  it('returns "high" for a widely available property (color)', () => {
    const status = getBaselineStatus('color')
    expect(status).toBe('high')
  })

  it('returns "low" for a newly available property (backdrop-filter)', () => {
    const status = getBaselineStatus('backdrop-filter')
    // backdrop-filter is Baseline low (newly available)
    expect(status).toBe('low')
  })

  it('returns null for an unknown property', () => {
    const status = getBaselineStatus('nonexistent-property-xyz')
    expect(status).toBeNull()
  })

  it('returns null for empty string', () => {
    const status = getBaselineStatus('')
    expect(status).toBeNull()
  })

  it('handles dashed property names (background-color)', () => {
    const status = getBaselineStatus('background-color')
    // background-color is a well-established property
    expect(status).toBe('high')
  })
})

describe('isBaseline', () => {
  it('returns true for a widely available property', () => {
    expect(isBaseline('display')).toBe(true)
  })

  it('returns false for an unknown property', () => {
    expect(isBaseline('unknown-prop')).toBe(false)
  })
})

describe('isWidelyAvailable', () => {
  it('returns true for a Baseline high property', () => {
    expect(isWidelyAvailable('display')).toBe(true)
  })

  it('returns false for a Baseline low property', () => {
    expect(isWidelyAvailable('backdrop-filter')).toBe(false)
  })

  it('returns false for an unknown property', () => {
    expect(isWidelyAvailable('unknown-prop')).toBe(false)
  })
})

describe('getSupportInfo', () => {
  it('returns structured support info for a known property', () => {
    const info = getSupportInfo('display')
    expect(info).not.toBeNull()
    expect(info).toHaveProperty('featureId')
    expect(info).toHaveProperty('name')
    expect(info).toHaveProperty('baseline')
    expect(info).toHaveProperty('support')
    expect(info.baseline).toBe('high')
  })

  it('returns null for an unknown property', () => {
    expect(getSupportInfo('unknown-prop')).toBeNull()
  })

  it('includes browser support keys when available', () => {
    const info = getSupportInfo('display')
    expect(info.support).toHaveProperty('chrome')
  })
})

describe('getKnownProperties', () => {
  it('returns an array of property names', () => {
    const props = getKnownProperties()
    expect(Array.isArray(props)).toBe(true)
    expect(props.length).toBeGreaterThan(0)
  })

  it('includes common CSS properties', () => {
    const props = getKnownProperties()
    expect(props).toContain('display')
    expect(props).toContain('color')
    expect(props).toContain('background-color')
  })
})

describe('getPropertyCount', () => {
  it('returns a positive number', () => {
    const count = getPropertyCount()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThan(0)
  })

  it('matches the length of getKnownProperties', () => {
    const count = getPropertyCount()
    const props = getKnownProperties()
    expect(count).toBe(props.length)
  })
})
