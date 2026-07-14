import { describe, test, expect } from 'vitest'
import { importSets } from '../src/import-into-catalog.mjs'

// A tiny in-memory stand-in for Penpot's `penpot.library.local.tokens`
// TokenCatalog. It mirrors the one behavior that matters here: Penpot THROWS
// when you add a set or token whose name already exists (the real error is
// "Value not valid: Field 0.name is invalid: A set with the same name already
// exists"). `importSets` must avoid those throws by reusing what's there.
function makeFakeCatalog() {
  class FakeToken {
    constructor(set, { type, name, value }) {
      this._set = set
      this.type = type
      this.name = name
      this.value = value
    }
    remove() {
      const i = this._set.tokens.indexOf(this)
      if (i >= 0) this._set.tokens.splice(i, 1)
    }
  }
  class FakeSet {
    constructor(name, active) {
      this.name = name
      this.active = active
      this.tokens = []
    }
    addToken({ type, name, value }) {
      if (this.tokens.some((t) => t.name === name)) {
        throw new Error(
          `[PENPOT PLUGIN] Value not valid: Field 0.name is invalid: A token with the same name already exists. Code: :error`
        )
      }
      const token = new FakeToken(this, { type, name, value })
      this.tokens.push(token)
      return token
    }
  }
  return {
    sets: [],
    addSet({ name, active = false }) {
      if (this.sets.some((s) => s.name === name)) {
        throw new Error(
          `[PENPOT PLUGIN] Value not valid: Field 0.name is invalid: A set with the same name already exists. Code: :error`
        )
      }
      const set = new FakeSet(name, active)
      this.sets.push(set)
      return set
    },
  }
}

describe('importSets — idempotent re-import', () => {
  test('re-importing the same set reuses it instead of throwing or duplicating', () => {
    const catalog = makeFakeCatalog()
    const sets = [
      {
        name: 'color',
        tokens: [{ name: 'primary.500', type: 'color', value: '#1976d2' }],
      },
    ]

    importSets(catalog, sets)
    const summary = importSets(catalog, sets)

    expect(catalog.sets).toHaveLength(1)
    expect(summary.errors).toEqual([])
  })

  test('overwrites an existing token with the incoming value (sync)', () => {
    const catalog = makeFakeCatalog()
    importSets(catalog, [
      {
        name: 'color',
        tokens: [{ name: 'primary.500', type: 'color', value: '#1976d2' }],
      },
    ])

    importSets(catalog, [
      {
        name: 'color',
        tokens: [{ name: 'primary.500', type: 'color', value: '#0d47a1' }],
      },
    ])

    const set = catalog.sets.find((s) => s.name === 'color')
    expect(set.tokens).toHaveLength(1)
    expect(set.tokens[0].value).toBe('#0d47a1')
  })

  test('adds new tokens to an existing set on re-import', () => {
    const catalog = makeFakeCatalog()
    importSets(catalog, [
      {
        name: 'color',
        tokens: [{ name: 'primary.500', type: 'color', value: '#1976d2' }],
      },
    ])

    const summary = importSets(catalog, [
      {
        name: 'color',
        tokens: [
          { name: 'primary.500', type: 'color', value: '#1976d2' },
          { name: 'primary.700', type: 'color', value: '#0d47a1' },
        ],
      },
    ])

    const set = catalog.sets.find((s) => s.name === 'color')
    expect(set.tokens.map((t) => t.name)).toEqual([
      'primary.500',
      'primary.700',
    ])
    expect(summary.errors).toEqual([])
  })

  test('reused set is (re)activated so its tokens affect the file', () => {
    const catalog = makeFakeCatalog()
    const sets = [
      {
        name: 'color',
        tokens: [{ name: 'primary.500', type: 'color', value: '#1976d2' }],
      },
    ]
    importSets(catalog, sets)
    catalog.sets[0].active = false

    importSets(catalog, sets)

    expect(catalog.sets[0].active).toBe(true)
  })

  test('creates a fresh active set with its tokens on first import', () => {
    const catalog = makeFakeCatalog()

    const summary = importSets(catalog, [
      {
        name: 'color',
        tokens: [{ name: 'primary.500', type: 'color', value: '#1976d2' }],
      },
    ])

    expect(catalog.sets).toHaveLength(1)
    expect(catalog.sets[0].active).toBe(true)
    expect(summary).toMatchObject({
      sets: 1,
      tokens: 1,
      skipped: 0,
      errors: [],
    })
  })

  test('preserves the existing token when overwriting it with a value Penpot rejects', () => {
    const catalog = makeFakeCatalog()
    importSets(catalog, [
      {
        name: 'color',
        tokens: [{ name: 'primary.500', type: 'color', value: '#1976d2' }],
      },
    ])
    // Make Penpot reject the incoming value (e.g. a malformed token value).
    const set = catalog.sets.find((s) => s.name === 'color')
    const addToken = set.addToken.bind(set)
    set.addToken = (input) => {
      if (input.value === 'BAD')
        throw new Error('[PENPOT PLUGIN] Value not valid')
      return addToken(input)
    }

    const summary = importSets(catalog, [
      {
        name: 'color',
        tokens: [{ name: 'primary.500', type: 'color', value: 'BAD' }],
      },
    ])

    // The rejected write is reported, but the previous token must survive.
    expect(summary.errors).toHaveLength(1)
    expect(set.tokens).toHaveLength(1)
    expect(set.tokens[0].value).toBe('#1976d2')
  })

  test('skips tokens the core could not type (type: null)', () => {
    const catalog = makeFakeCatalog()

    const summary = importSets(catalog, [
      {
        name: 'misc',
        tokens: [
          { name: 'ok', type: 'color', value: '#000000' },
          { name: 'unsupported', type: null, value: 'x' },
        ],
      },
    ])

    expect(summary.skipped).toBe(1)
    expect(summary.tokens).toBe(1)
    expect(catalog.sets[0].tokens.map((t) => t.name)).toEqual(['ok'])
  })
})
