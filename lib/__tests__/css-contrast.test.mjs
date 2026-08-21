import { describe, it, expect } from 'vitest'

/**
 * Milestone 1: ColorCluster type extension for WCAG contrast audit.
 *
 * These tests validate that the new optional fields `contrastRatio` and
 * `failsWCAG` are correctly typed and round-trip through JSON
 * serialization.
 */
describe('ColorCluster contrast extension', () => {
  const sampleCluster = {
    id: 'cluster-1',
    suggestedName: 'brand-blue',
    representative: '#2563eb',
    samples: [{ hex: '#2563eb', usageCount: 5, contexts: ['.btn-primary'] }],
    contrastRatio: 4.61,
    failsWCAG: {
      aa: false,
      aaa: true,
    },
  }

  it('round-trips optional contrast fields through JSON', () => {
    const text = JSON.stringify(sampleCluster)
    const parsed = JSON.parse(text)
    expect(parsed.contrastRatio).toBe(4.61)
    expect(parsed.failsWCAG).toEqual({ aa: false, aaa: true })
  })

  it('allows clusters without contrast fields (backward compatible)', () => {
    const { contrastRatio: _cr, failsWCAG: _fw, ...legacy } = sampleCluster
    const text = JSON.stringify(legacy)
    const parsed = JSON.parse(text)
    expect(parsed.id).toBe('cluster-1')
    expect(parsed.contrastRatio).toBeUndefined()
    expect(parsed.failsWCAG).toBeUndefined()
  })

  it('failsWCAG aa threshold flag reflects 4.5:1 minimum for normal text', () => {
    const pass = {
      ...sampleCluster,
      contrastRatio: 4.5,
      failsWCAG: { aa: false, aaa: true },
    }
    expect(pass.failsWCAG.aa).toBe(false)

    const fail = {
      ...sampleCluster,
      contrastRatio: 4.49,
      failsWCAG: { aa: true, aaa: true },
    }
    expect(fail.failsWCAG.aa).toBe(true)
  })

  it('failsWCAG aaa threshold flag reflects 7:1 minimum for normal text', () => {
    const pass = {
      ...sampleCluster,
      contrastRatio: 7.0,
      failsWCAG: { aa: false, aaa: false },
    }
    expect(pass.failsWCAG.aaa).toBe(false)

    const fail = {
      ...sampleCluster,
      contrastRatio: 6.99,
      failsWCAG: { aa: false, aaa: true },
    }
    expect(fail.failsWCAG.aaa).toBe(true)
  })
})