import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { diffTokens, diffFiles, TokenDiff } from '../token-diff.mjs'

// Minimal helpers to build tokens objects that match the mint-ds schema.
function color(name, value, scale) {
  return { name, value, ...(scale ? { scale } : {}) }
}

function tokens(overrides = {}) {
  return {
    brand: 'acme',
    colors: [],
    typography: {
      fontFamilies: {},
      fontSizes: {},
      fontWeights: {},
      lineHeights: {},
    },
    spacing: {},
    borderRadius: {},
    shadows: {},
    ...overrides,
  }
}

describe('diffTokens', () => {
  describe('no changes', () => {
    it('reports no changes for identical token sets', () => {
      const a = tokens({ colors: [color('primary', '#1976d2')] })
      const b = tokens({ colors: [color('primary', '#1976d2')] })
      const diff = diffTokens(a, b)
      expect(diff.hasChanges).toBe(false)
      expect(diff.hasBreakingChanges).toBe(false)
      expect(diff.exitCode).toBe(0)
      expect(diff.changes).toEqual([])
    })
  })

  describe('colors', () => {
    it('detects an added color as non-breaking', () => {
      const a = tokens({ colors: [color('primary', '#1976d2')] })
      const b = tokens({
        colors: [color('primary', '#1976d2'), color('accent', '#f59e0b')],
      })
      const diff = diffTokens(a, b)
      expect(diff.added).toHaveLength(1)
      expect(diff.added[0]).toMatchObject({
        category: 'colors',
        type: 'added',
        name: 'accent',
        value: '#f59e0b',
      })
      expect(diff.hasBreakingChanges).toBe(false)
      expect(diff.exitCode).toBe(0)
    })

    it('detects a removed color as breaking', () => {
      const a = tokens({ colors: [color('legacy-blue', '#1a73e8')] })
      const b = tokens({ colors: [] })
      const diff = diffTokens(a, b)
      expect(diff.removed).toHaveLength(1)
      expect(diff.removed[0]).toMatchObject({
        category: 'colors',
        type: 'removed',
        name: 'legacy-blue',
        value: '#1a73e8',
      })
      expect(diff.hasBreakingChanges).toBe(true)
      expect(diff.exitCode).toBe(1)
    })

    it('detects a base value change as breaking', () => {
      const a = tokens({ colors: [color('primary', '#1976d2')] })
      const b = tokens({ colors: [color('primary', '#1f77d8')] })
      const diff = diffTokens(a, b)
      expect(diff.valueChanged).toHaveLength(1)
      expect(diff.valueChanged[0]).toMatchObject({
        category: 'colors',
        type: 'value-changed',
        name: 'primary',
        oldValue: '#1976d2',
        newValue: '#1f77d8',
      })
      expect(diff.exitCode).toBe(1)
    })

    it('detects a renamed color (same value, different name) as non-breaking', () => {
      const a = tokens({ colors: [color('primary', '#1976d2')] })
      const b = tokens({ colors: [color('brand', '#1976d2')] })
      const diff = diffTokens(a, b)
      expect(diff.renamed).toHaveLength(1)
      expect(diff.renamed[0]).toMatchObject({
        category: 'colors',
        type: 'renamed',
        from: 'primary',
        to: 'brand',
        value: '#1976d2',
      })
      expect(diff.removed).toHaveLength(0)
      expect(diff.added).toHaveLength(0)
      expect(diff.hasBreakingChanges).toBe(false)
    })

    it('detects a scale stop value change as breaking', () => {
      const a = tokens({
        colors: [
          color('primary', '#1976d2', { 500: '#1976d2', 700: '#0d47a1' }),
        ],
      })
      const b = tokens({
        colors: [
          color('primary', '#1976d2', { 500: '#1f77d8', 700: '#0d47a1' }),
        ],
      })
      const diff = diffTokens(a, b)
      expect(diff.scaleChanged).toHaveLength(1)
      const change = diff.scaleChanged[0]
      expect(change).toMatchObject({ category: 'colors', name: 'primary' })
      expect(change.stops).toEqual([
        {
          stop: '500',
          type: 'value-changed',
          oldValue: '#1976d2',
          newValue: '#1f77d8',
        },
      ])
      expect(diff.exitCode).toBe(1)
    })

    it('detects added and removed scale stops', () => {
      const a = tokens({
        colors: [color('primary', '#1976d2', { 500: '#1976d2' })],
      })
      const b = tokens({
        colors: [
          color('primary', '#1976d2', { 500: '#1976d2', 600: '#1565c0' }),
        ],
      })
      const diff = diffTokens(a, b)
      expect(diff.scaleChanged[0].stops).toEqual([
        { stop: '600', type: 'added', newValue: '#1565c0' },
      ])
    })

    it('does not report scale change when scales are identical', () => {
      const scale = { 500: '#1976d2', 700: '#0d47a1' }
      const a = tokens({ colors: [color('primary', '#1976d2', { ...scale })] })
      const b = tokens({ colors: [color('primary', '#1976d2', { ...scale })] })
      const diff = diffTokens(a, b)
      expect(diff.scaleChanged).toHaveLength(0)
      expect(diff.hasChanges).toBe(false)
    })
  })

  describe('record categories', () => {
    it('detects added/removed/value-changed spacing tokens', () => {
      const a = tokens({ spacing: { 1: '4px', 2: '8px' } })
      const b = tokens({ spacing: { 1: '4px', 2: '10px', 3: '12px' } })
      const diff = diffTokens(a, b)
      expect(diff.added.map((c) => c.name)).toEqual(['3'])
      expect(diff.valueChanged).toHaveLength(1)
      expect(diff.valueChanged[0]).toMatchObject({
        category: 'spacing',
        name: '2',
        oldValue: '8px',
        newValue: '10px',
      })
    })

    it('detects a renamed spacing key (same value, different key)', () => {
      const a = tokens({ spacing: { 4: '20px' } })
      const b = tokens({ spacing: { 5: '20px' } })
      const diff = diffTokens(a, b)
      expect(diff.renamed).toHaveLength(1)
      expect(diff.renamed[0]).toMatchObject({
        category: 'spacing',
        from: '4',
        to: '5',
        value: '20px',
      })
    })

    it('diffs typography sub-records including numeric fontWeights', () => {
      const a = tokens({
        typography: {
          fontFamilies: { body: 'Arial' },
          fontSizes: {},
          fontWeights: { bold: 700 },
          lineHeights: {},
        },
      })
      const b = tokens({
        typography: {
          fontFamilies: { body: 'Inter' },
          fontSizes: {},
          fontWeights: { bold: 800 },
          lineHeights: {},
        },
      })
      const diff = diffTokens(a, b)
      const cats = diff.valueChanged.map((c) => c.category).sort()
      expect(cats).toEqual(['fontFamilies', 'fontWeights'])
      const weight = diff.valueChanged.find((c) => c.category === 'fontWeights')
      expect(weight).toMatchObject({ oldValue: 700, newValue: 800 })
    })

    it('diffs borderRadius and shadows records', () => {
      const a = tokens({
        borderRadius: { sm: '4px' },
        shadows: { sm: '0 2px 4px rgba(0,0,0,0.1)' },
      })
      const b = tokens({
        borderRadius: { sm: '6px' },
        shadows: {},
      })
      const diff = diffTokens(a, b)
      expect(diff.valueChanged.some((c) => c.category === 'borderRadius')).toBe(
        true
      )
      expect(diff.removed.some((c) => c.category === 'shadows')).toBe(true)
    })
  })

  describe('brand', () => {
    it('reports a brand value change', () => {
      const diff = diffTokens(
        tokens({ brand: 'old' }),
        tokens({ brand: 'new' })
      )
      expect(diff.valueChanged).toHaveLength(1)
      expect(diff.valueChanged[0]).toMatchObject({
        category: 'brand',
        name: 'brand',
        oldValue: 'old',
        newValue: 'new',
      })
    })

    it('reports a brand addition and removal', () => {
      const added = diffTokens(
        tokens({ brand: undefined }),
        tokens({ brand: 'acme' })
      )
      expect(added.added.some((c) => c.category === 'brand')).toBe(true)
      const removed = diffTokens(
        tokens({ brand: 'acme' }),
        tokens({ brand: undefined })
      )
      expect(removed.removed.some((c) => c.category === 'brand')).toBe(true)
    })
  })

  describe('robustness', () => {
    it('handles partial/empty token objects without throwing', () => {
      const diff = diffTokens({}, { colors: [color('primary', '#000')] })
      expect(diff.added).toHaveLength(1)
    })

    it('handles null/undefined inputs', () => {
      expect(() => diffTokens(null, undefined)).not.toThrow()
      expect(diffTokens(null, undefined).hasChanges).toBe(false)
    })

    it('pairs renames greedily when multiple candidates share a value', () => {
      const a = tokens({ spacing: { a: '4px', b: '4px' } })
      const b = tokens({ spacing: { c: '4px' } })
      const diff = diffTokens(a, b)
      expect(diff.renamed).toHaveLength(1)
      expect(diff.removed).toHaveLength(1)
    })
  })
})

describe('TokenDiff output', () => {
  it('prints a clean message when there are no changes', () => {
    const diff = diffTokens(tokens(), tokens())
    expect(diff.print()).toBe('✓ No changes between token files')
  })

  it('groups changes by category with symbols in the human report', () => {
    const a = tokens({
      colors: [color('primary', '#1976d2'), color('legacy-blue', '#1a73e8')],
      spacing: { 4: '20px' },
    })
    const b = tokens({
      colors: [color('primary', '#1f77d8'), color('accent', '#f59e0b')],
      spacing: { 5: '20px' },
    })
    const out = diffTokens(a, b).print()
    expect(out).toContain('colors')
    expect(out).toContain('+ accent (#f59e0b)')
    expect(out).toContain('~ primary: #1976d2 → #1f77d8')
    expect(out).toContain('– legacy-blue (was #1a73e8)')
    expect(out).toContain('↻ renamed "4" → "5" (value 20px)')
  })

  it('renders scale stop changes as name.stop lines', () => {
    const a = tokens({
      colors: [color('primary', '#1976d2', { 500: '#1976d2' })],
    })
    const b = tokens({
      colors: [color('primary', '#1976d2', { 500: '#1f77d8' })],
    })
    const out = diffTokens(a, b).print()
    expect(out).toContain('~ primary.500: #1976d2 → #1f77d8')
  })

  it('produces machine-readable JSON via toJSON', () => {
    const a = tokens({ colors: [color('primary', '#1976d2')] })
    const b = tokens({ colors: [] })
    const json = diffTokens(a, b).toJSON()
    expect(json).toMatchObject({
      changed: true,
      breaking: true,
      summary: { removed: 1 },
    })
    expect(Array.isArray(json.changes)).toBe(true)
    expect(json.changes[0]).toMatchObject({ type: 'removed', name: 'primary' })
  })

  it('exposes a TokenDiff instance', () => {
    expect(diffTokens(tokens(), tokens())).toBeInstanceOf(TokenDiff)
  })
})

describe('diffFiles', () => {
  let dir
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mint-diff-'))
  })
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('reads two files and returns a diff', async () => {
    const oldPath = path.join(dir, 'old.json')
    const newPath = path.join(dir, 'new.json')
    await fs.writeFile(
      oldPath,
      JSON.stringify(tokens({ colors: [color('primary', '#1976d2')] }))
    )
    await fs.writeFile(
      newPath,
      JSON.stringify(tokens({ colors: [color('primary', '#1f77d8')] }))
    )
    const diff = await diffFiles(oldPath, newPath)
    expect(diff.valueChanged).toHaveLength(1)
  })

  it('throws a clear error when a file is missing', async () => {
    await expect(
      diffFiles(path.join(dir, 'nope.json'), path.join(dir, 'nope2.json'))
    ).rejects.toThrow(/not found/i)
  })

  it('throws a clear error on invalid JSON', async () => {
    const badPath = path.join(dir, 'bad.json')
    const goodPath = path.join(dir, 'good.json')
    await fs.writeFile(badPath, '{ not json')
    await fs.writeFile(goodPath, JSON.stringify(tokens()))
    await expect(diffFiles(badPath, goodPath)).rejects.toThrow(
      /not valid JSON/i
    )
  })
})
