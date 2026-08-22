import { describe, it, expect } from 'vitest'
import {
  parseSrgbColor,
  relativeLuminance,
  contrastRatio,
  evaluateContrast,
  annotateColorClusters,
} from '../css-contrast.mjs'

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

/**
 * Milestone 2: WCAG 2.1 contrast ratio calculation.
 */
describe('parseSrgbColor', () => {
  it('parses hex literals to 0-255 triples', () => {
    expect(parseSrgbColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseSrgbColor('#000000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(parseSrgbColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    expect(parseSrgbColor('#767676')).toEqual({ r: 118, g: 118, b: 118 })
  })

  it('parses 3-digit shorthand and uppercase hex', () => {
    expect(parseSrgbColor('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseSrgbColor('#FFF')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('parses rgb() and hsl() literals', () => {
    expect(parseSrgbColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0 })
    expect(parseSrgbColor('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0 })
  })

  it('returns null for keywords, variables, and non-opaque colors', () => {
    expect(parseSrgbColor('red')).toBeNull()
    expect(parseSrgbColor('var(--brand)')).toBeNull()
    expect(parseSrgbColor('#ffffff80')).toBeNull()
    expect(parseSrgbColor('')).toBeNull()
    expect(parseSrgbColor(null)).toBeNull()
  })

  it('parses oklch() and oklab() wide-gamut colors as their sRGB fallback', () => {
    expect(parseSrgbColor('oklch(1 0 0)')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseSrgbColor('oklch(0 0 0)')).toEqual({ r: 0, g: 0, b: 0 })
    expect(parseSrgbColor('oklab(1 0 0)')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('clamps out-of-gamut oklch() colors to finite 0-255 channels', () => {
    const rgb = parseSrgbColor('oklch(0.8 0.3 140)')
    expect(rgb).not.toBeNull()
    for (const ch of [rgb.r, rgb.g, rgb.b]) {
      expect(Number.isFinite(ch)).toBe(true)
      expect(ch).toBeGreaterThanOrEqual(0)
      expect(ch).toBeLessThanOrEqual(255)
    }
  })
})

describe('relativeLuminance', () => {
  it('returns 1.0 for white and 0.0 for black', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5)
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5)
  })

  it('is symmetric in the sense that channel order matters only by weight', () => {
    // Red carries the least luminance weight (0.2126), blue the least of the
    // primaries after green (0.7152).
    const red = relativeLuminance({ r: 255, g: 0, b: 0 })
    const green = relativeLuminance({ r: 0, g: 255, b: 0 })
    expect(red).toBeCloseTo(0.2126, 3)
    expect(green).toBeCloseTo(0.7152, 3)
  })
})

describe('contrastRatio', () => {
  it('returns 21:1 for black on white and white on black', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
  })

  it('returns the WCAG reference values for mid-grays', () => {
    // Well-known WCAG anchors: #767676 passes AA (4.54:1), #777777 fails (4.48:1).
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })

  it('accepts rgb triples as well as strings', () => {
    expect(
      contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })
    ).toBeCloseTo(21, 5)
  })

  it('returns null when either color is unparseable', () => {
    expect(contrastRatio('var(--brand)', '#ffffff')).toBeNull()
    expect(contrastRatio('#ffffff', 'currentColor')).toBeNull()
  })

  it('computes contrast for wide-gamut oklch() colors', () => {
    expect(contrastRatio('oklch(1 0 0)', 'oklch(0 0 0)')).toBeCloseTo(21, 5)
  })
})

describe('evaluateContrast', () => {
  it('flags AA and AAA failures at the WCAG 2.1 thresholds', () => {
    expect(evaluateContrast('#767676', '#ffffff')).toEqual({
      contrastRatio: 4.54,
      failsWCAG: { aa: false, aaa: true },
    })
    expect(evaluateContrast('#777777', '#ffffff')).toEqual({
      contrastRatio: 4.48,
      failsWCAG: { aa: true, aaa: true },
    })
    expect(evaluateContrast('#000000', '#ffffff')).toEqual({
      contrastRatio: 21,
      failsWCAG: { aa: false, aaa: false },
    })
  })

  it('returns null for unparseable colors', () => {
    expect(evaluateContrast('var(--brand)', '#ffffff')).toBeNull()
  })
})

describe('annotateColorClusters', () => {
  const clusters = [
    {
      id: 'cluster-0',
      suggestedName: 'background',
      representative: '#ffffff',
      samples: [{ hex: '#ffffff', usageCount: 10, contexts: ['body'] }],
    },
    {
      id: 'cluster-1',
      suggestedName: 'text',
      representative: '#000000',
      samples: [{ hex: '#000000', usageCount: 8, contexts: ['body'] }],
    },
    {
      id: 'cluster-2',
      suggestedName: 'primary',
      representative: '#777777',
      samples: [{ hex: '#777777', usageCount: 3, contexts: ['.btn'] }],
    },
    {
      id: 'cluster-3',
      suggestedName: 'accent',
      representative: 'var(--brand)',
      samples: [{ hex: 'var(--brand)', usageCount: 1, contexts: ['.badge'] }],
    },
  ]

  it('computes contrast against the background cluster and skips it itself', () => {
    const annotated = annotateColorClusters(clusters)
    expect(annotated[0].contrastRatio).toBeUndefined()
    expect(annotated[1].contrastRatio).toBeCloseTo(21, 5)
    expect(annotated[1].failsWCAG).toEqual({ aa: false, aaa: false })
    expect(annotated[2].contrastRatio).toBeCloseTo(4.48, 2)
    expect(annotated[2].failsWCAG).toEqual({ aa: true, aaa: true })
  })

  it('leaves unparseable colors untouched', () => {
    const annotated = annotateColorClusters(clusters)
    expect(annotated[3].contrastRatio).toBeUndefined()
    expect(annotated[3].failsWCAG).toBeUndefined()
  })

  it('defaults to white when no background/surface cluster is present', () => {
    const noBg = clusters.filter((c) => c.suggestedName !== 'background')
    const annotated = annotateColorClusters(noBg)
    expect(annotated[0].contrastRatio).toBeCloseTo(21, 5)
  })

  it('does not mutate the input array', () => {
    const snapshot = JSON.parse(JSON.stringify(clusters))
    annotateColorClusters(clusters)
    expect(clusters).toEqual(snapshot)
  })

  it('handles empty and non-array input', () => {
    expect(annotateColorClusters([])).toEqual([])
    expect(annotateColorClusters(null)).toEqual(null)
  })
})
