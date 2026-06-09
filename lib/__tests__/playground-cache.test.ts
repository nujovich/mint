import { webcrypto } from 'node:crypto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  preprocessCss,
  hashContent,
  readAuditCache,
  writeAuditCache,
  readResolveCache,
  writeResolveCache,
  clearPlaygroundCache,
} from '../playground-cache'
import type { AuditReport, DSTokens, UserDecisions } from '../types'

// ── In-memory localStorage mock ───────────────────────────────────────────────

function makeLocalStorageMock() {
  let store: Record<string, string> = {}

  return {
    get length() {
      return Object.keys(store).length
    },
    key(i: number): string | null {
      return Object.keys(store)[i] ?? null
    },
    getItem(k: string): string | null {
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null
    },
    setItem(k: string, v: string): void {
      store[k] = v
    },
    removeItem(k: string): void {
      delete store[k]
    },
    clear(): void {
      store = {}
    },
  }
}

const localStorageMock = makeLocalStorageMock()

vi.stubGlobal('crypto', webcrypto)
vi.stubGlobal('localStorage', localStorageMock)

beforeEach(() => {
  localStorageMock.clear()
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AUDIT: AuditReport = {
  brand: 'TestBrand',
  chaosScore: 4,
  summary: 'Some chaos detected.',
  colorClusters: [],
  fonts: [],
  spacing: { found: [], suggestedScale: {}, nonScaleValues: [] },
  lineHeights: { found: [], suggestedScale: {}, unitlessMix: false },
}

const TOKENS: DSTokens = {
  brand: 'TestBrand',
  colors: [],
  typography: { fontFamilies: {}, fontSizes: {}, fontWeights: {}, lineHeights: {} },
  spacing: {},
  borderRadius: {},
  shadows: {},
}

const DECISIONS: UserDecisions = {
  colors: [{ clusterId: 'c1', name: 'primary', value: '#6366f1', include: true }],
  fonts: ['Inter'],
  spacingScale: { '1': '4px', '2': '8px' },
  lineHeights: {},
}

const CSS = 'body { color: #6366f1; font-size: 16px; }'

// ── preprocessCss ─────────────────────────────────────────────────────────────

describe('preprocessCss', () => {
  it('strips block comments', () => {
    expect(preprocessCss('/* comment */ body { color: red; }')).toBe('body { color: red; }')
  })

  it('strips line comments', () => {
    expect(preprocessCss('// comment\nbody { color: red; }')).toBe('body { color: red; }')
  })

  it('collapses multiple whitespace into a single space', () => {
    expect(preprocessCss('body  {   color:   red;   }')).toBe('body { color: red; }')
  })

  it('trims leading and trailing whitespace', () => {
    expect(preprocessCss('  body { color: red; }  ')).toBe('body { color: red; }')
  })
})

// ── hashContent ───────────────────────────────────────────────────────────────

describe('hashContent', () => {
  it('returns a 64-character hex string', async () => {
    const hash = await hashContent('hello')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('returns the same hash for the same input', async () => {
    const a = await hashContent('same input')
    const b = await hashContent('same input')
    expect(a).toBe(b)
  })

  it('returns a different hash for different input', async () => {
    const a = await hashContent('input-a')
    const b = await hashContent('input-b')
    expect(a).not.toBe(b)
  })
})

// ── audit cache ───────────────────────────────────────────────────────────────

describe('audit cache', () => {
  it('readAuditCache returns null on miss', async () => {
    const result = await readAuditCache(CSS)
    expect(result).toBeNull()
  })

  it('writeAuditCache then readAuditCache returns the saved audit', async () => {
    await writeAuditCache(CSS, AUDIT)
    const result = await readAuditCache(CSS)
    expect(result).toEqual(AUDIT)
  })

  it('same CSS with comment/whitespace differences hits the same cache entry', async () => {
    await writeAuditCache(CSS, AUDIT)
    // CSS with a block comment and extra spaces should normalize to the same key
    const cssWithNoise = `/* header */ ${CSS.replace(/ /g, '   ')}`
    const result = await readAuditCache(cssWithNoise)
    expect(result).toEqual(AUDIT)
  })

  it('different CSS is a miss even when audit was written for other CSS', async () => {
    await writeAuditCache(CSS, AUDIT)
    const result = await readAuditCache('h1 { color: blue; }')
    expect(result).toBeNull()
  })
})

// ── resolve cache ─────────────────────────────────────────────────────────────

describe('resolve cache', () => {
  it('readResolveCache returns null on miss', async () => {
    const result = await readResolveCache(CSS, DECISIONS)
    expect(result).toBeNull()
  })

  it('writeResolveCache then readResolveCache returns the saved tokens', async () => {
    await writeResolveCache(CSS, DECISIONS, TOKENS)
    const result = await readResolveCache(CSS, DECISIONS)
    expect(result).toEqual(TOKENS)
  })

  it('same CSS + different decisions = miss', async () => {
    await writeResolveCache(CSS, DECISIONS, TOKENS)
    const otherDecisions: UserDecisions = { ...DECISIONS, fonts: ['Roboto'] }
    const result = await readResolveCache(CSS, otherDecisions)
    expect(result).toBeNull()
  })

  it('different CSS + same decisions = miss', async () => {
    await writeResolveCache(CSS, DECISIONS, TOKENS)
    const result = await readResolveCache('h1 { color: blue; }', DECISIONS)
    expect(result).toBeNull()
  })
})

// ── clearPlaygroundCache ──────────────────────────────────────────────────────

describe('clearPlaygroundCache', () => {
  it('removes mint-audit-cache-* entries', async () => {
    await writeAuditCache(CSS, AUDIT)
    clearPlaygroundCache()
    const result = await readAuditCache(CSS)
    expect(result).toBeNull()
  })

  it('removes mint-resolve-cache-* entries', async () => {
    await writeResolveCache(CSS, DECISIONS, TOKENS)
    clearPlaygroundCache()
    const result = await readResolveCache(CSS, DECISIONS)
    expect(result).toBeNull()
  })

  it('does NOT remove unrelated keys', async () => {
    localStorageMock.setItem('mint-flavor', 'playground')
    localStorageMock.setItem('mint-audit-history', '[]')
    await writeAuditCache(CSS, AUDIT)
    clearPlaygroundCache()
    expect(localStorageMock.getItem('mint-flavor')).toBe('playground')
    expect(localStorageMock.getItem('mint-audit-history')).toBe('[]')
  })
})
