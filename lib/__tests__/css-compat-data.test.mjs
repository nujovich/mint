import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join as joinPath } from 'node:path'
import {
  getBaselineStatus,
  isBaseline,
  isWidelyAvailable,
  getSupportInfo,
  getKnownProperties,
  getPropertyCount,
  getProjectBrowserslist,
  getResolvedBrowsers,
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

// ---------------------------------------------------------------------------
// Milestone 2: project browserslist reading
// ---------------------------------------------------------------------------

function makeTmpProject(files) {
  const dir = mkdtempSync(joinPath(tmpdir(), 'mint-bl-'))
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(joinPath(dir, name), content)
  }
  return dir
}

describe('getProjectBrowserslist', () => {
  it('reads a browserslist key from package.json', () => {
    const dir = makeTmpProject({
      'package.json': JSON.stringify({
        name: 'demo',
        browserslist: ['last 2 Chrome versions', 'not dead'],
      }),
    })
    try {
      const result = getProjectBrowserslist(dir)
      expect(result.source).toBe('package.json')
      expect(result.queries).toEqual(['last 2 Chrome versions', 'not dead'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reads browserslist.production when only env blocks exist', () => {
    const dir = makeTmpProject({
      'package.json': JSON.stringify({
        browserslist: {
          production: ['chrome >= 120'],
          development: ['last 1 version'],
        },
      }),
    })
    try {
      const result = getProjectBrowserslist(dir)
      expect(result.source).toBe('package.json')
      expect(result.queries).toEqual(['chrome >= 120'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prefers .browserslistrc over the package.json default', () => {
    const dir = makeTmpProject({
      'package.json': JSON.stringify({ name: 'demo' }),
      '.browserslistrc': '> 1%\n# comment\nsafari >= 14\n',
    })
    try {
      const result = getProjectBrowserslist(dir)
      expect(result.source).toBe('.browserslistrc')
      expect(result.queries).toEqual(['> 1%', 'safari >= 14'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('falls back to the browserslist default when no config exists', () => {
    const dir = makeTmpProject({
      'package.json': JSON.stringify({ name: 'demo' }),
    })
    try {
      const result = getProjectBrowserslist(dir)
      expect(result.source).toBe('default')
      expect(result.queries).toEqual([
        '> 0.5%',
        'last 2 versions',
        'Firefox ESR',
        'not dead',
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('getResolvedBrowsers', () => {
  it('resolves queries into concrete browser identifiers', () => {
    const dir = makeTmpProject({
      'package.json': JSON.stringify({
        browserslist: ['chrome >= 120'],
      }),
    })
    try {
      const result = getResolvedBrowsers(dir)
      expect(result.source).toBe('package.json')
      expect(result.browsers.length).toBeGreaterThan(0)
      expect(result.browsers.every((b) => typeof b === 'string')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ---------------------------------------------------------------------------
// Milestone 3: static Interop-2026 adoption rules
// ---------------------------------------------------------------------------

import {
  lintPropertyNotSupported,
  lintPropertyExperimental,
  getInteropScore,
  getFeatureSuggestion,
  formatCompatFindings,
  checkCompat,
} from '../css-compat-data.mjs'

describe('getInteropScore', () => {
  it('returns null for properties without an interop figure', () => {
    // The bundled web-features data does not populate status.interop for most
    // properties; the rule falls back to Baseline status instead.
    expect(getInteropScore('display')).toBeNull()
  })
})

describe('lintPropertyNotSupported', () => {
  it('warns when a below-Baseline property is missing from target browsers', () => {
    const dir = makeTmpProject({
      'package.json': JSON.stringify({ browserslist: ['last 2 versions'] }),
    })
    try {
      const css = '.card { anchor-name: --a; display: grid; }'
      const { findings } = lintPropertyNotSupported(css, dir)
      const anchor = findings.find((f) => f.property === 'anchor-name')
      expect(anchor).toBeDefined()
      expect(anchor.pattern).toBe('property-not-supported')
      expect(anchor.severity).toBe('warning')
      expect(Array.isArray(anchor.unsupportedBrowsers)).toBe(true)
      expect(anchor.unsupportedBrowsers.length).toBeGreaterThan(0)
      // Baseline-high props must not be flagged.
      expect(findings.find((f) => f.property === 'display')).toBeUndefined()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('does not flag a property that is supported in every target browser', () => {
    const dir = makeTmpProject({
      'package.json': JSON.stringify({ browserslist: ['chrome 150'] }),
    })
    try {
      const css = '.card { text-box-trim: both; }'
      const { findings } = lintPropertyNotSupported(css, dir)
      // text-box-trim is below Baseline but chrome 150 supports it, so it is
      // not "not supported" for this single-browser target.
      expect(
        findings.find((f) => f.property === 'text-box-trim')
      ).toBeUndefined()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('lintPropertyExperimental', () => {
  it('informs when a Baseline-low property is used (interop fallback)', () => {
    const css = '.card { backdrop-filter: blur(4px); display: grid; }'
    const { findings } = lintPropertyExperimental(css, { interopThreshold: 90 })
    const bf = findings.find((f) => f.property === 'backdrop-filter')
    expect(bf).toBeDefined()
    expect(bf.pattern).toBe('property-experimental')
    expect(bf.severity).toBe('info')
    // Baseline-high props are not experimental.
    expect(findings.find((f) => f.property === 'display')).toBeUndefined()
  })

  it('flags a Baseline-low property even with a high custom threshold', () => {
    const css = '.card { backdrop-filter: blur(4px); }'
    // backdrop-filter is Baseline low; the interop fallback always reports it
    // as experimental (below any realistic threshold), so it must still warn.
    const { findings } = lintPropertyExperimental(css, { interopThreshold: 95 })
    expect(findings.find((f) => f.property === 'backdrop-filter')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Milestone 4: CLI output (feature suggestions + interop percentages)
// ---------------------------------------------------------------------------

describe('getFeatureSuggestion', () => {
  it('returns the human-readable feature name for a known property', () => {
    const s = getFeatureSuggestion('backdrop-filter')
    expect(s.name).not.toBeNull()
    expect(typeof s.name).toBe('string')
    expect(s.name.length).toBeGreaterThan(0)
  })

  it('returns null fields for an unknown property', () => {
    const s = getFeatureSuggestion('this-is-not-real-xyz')
    expect(s.featureId).toBeNull()
    expect(s.name).toBeNull()
  })
})

describe('formatCompatFindings', () => {
  it('attaches a feature name and a concrete suggestion to each finding', () => {
    const dir = makeTmpProject({
      'package.json': JSON.stringify({ browserslist: ['last 2 versions'] }),
    })
    try {
      const css = '.card { anchor-name: --a; backdrop-filter: blur(2px); }'
      const { findings } = lintPropertyNotSupported(css, dir)
      const exp = lintPropertyExperimental(css, { interopThreshold: 90 })
      const formatted = formatCompatFindings([...findings, ...exp.findings])
      for (const f of formatted) {
        expect(f).toHaveProperty('feature')
        expect(f).toHaveProperty('suggestion')
        expect(typeof f.suggestion).toBe('string')
        expect(f.suggestion.length).toBeGreaterThan(0)
      }
      // The not-supported finding should name the feature and the missing browsers.
      const anchor = formatted.find((f) => f.property === 'anchor-name')
      expect(anchor.suggestion).toContain('@supports')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('includes the interop percentage in experimental suggestions', () => {
    const css = '.card { backdrop-filter: blur(2px); }'
    const { findings } = lintPropertyExperimental(css, { interopThreshold: 90 })
    const formatted = formatCompatFindings(findings)
    expect(formatted[0].suggestion).toContain('Interop 2026')
  })
})

describe('checkCompat', () => {
  it('runs both rules and returns formatted CLI-ready findings', () => {
    const dir = makeTmpProject({
      'package.json': JSON.stringify({ browserslist: ['last 2 versions'] }),
    })
    try {
      const css =
        '.card { anchor-name: --a; backdrop-filter: blur(2px); display: grid; }'
      const { findings } = checkCompat(css, { projectDir: dir })
      // anchor-name (not-supported) + backdrop-filter (experimental)
      expect(findings.length).toBeGreaterThanOrEqual(2)
      const anchor = findings.find((f) => f.property === 'anchor-name')
      expect(anchor).toBeDefined()
      expect(anchor.pattern).toBe('property-not-supported')
      const bf = findings.find((f) => f.property === 'backdrop-filter')
      expect(bf).toBeDefined()
      expect(bf.pattern).toBe('property-experimental')
      // Baseline-high props are never reported.
      expect(findings.find((f) => f.property === 'display')).toBeUndefined()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns no findings for fully-supported, Baseline-high CSS', () => {
    const dir = makeTmpProject({
      'package.json': JSON.stringify({ browserslist: ['last 2 versions'] }),
    })
    try {
      const css = '.card { display: grid; color: #fff; font-weight: 600; }'
      const { findings } = checkCompat(css, { projectDir: dir })
      expect(findings).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
