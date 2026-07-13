import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dtcgToTokenOps } from '../src/dtcg-to-token-ops.mjs'

const fixture = (name) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
      'utf8'
    )
  )

describe('dtcgToTokenOps — color', () => {
  test('maps a color group to a set of color tokens, flattening nested groups to dotted names', () => {
    const dtcg = {
      color: {
        $type: 'color',
        primary: {
          50: { $value: '#e3f2fd' },
          500: { $value: '#1976d2' },
        },
      },
    }

    const ops = dtcgToTokenOps(dtcg)

    expect(ops).toEqual([
      {
        name: 'color',
        tokens: [
          { name: 'primary.50', type: 'color', value: '#e3f2fd' },
          { name: 'primary.500', type: 'color', value: '#1976d2' },
        ],
      },
    ])
  })
})

describe('dtcgToTokenOps — spacing', () => {
  test('maps a spacing group ($type dimension) to spacing tokens with "<n><unit>" values', () => {
    const dtcg = {
      spacing: {
        $type: 'dimension',
        1: { $value: { value: 4, unit: 'px' } },
        2: { $value: { value: 8, unit: 'px' } },
      },
    }

    const ops = dtcgToTokenOps(dtcg)

    expect(ops).toEqual([
      {
        name: 'spacing',
        tokens: [
          { name: '1', type: 'spacing', value: '4px' },
          { name: '2', type: 'spacing', value: '8px' },
        ],
      },
    ])
  })
})

describe('dtcgToTokenOps — border-radius', () => {
  test('maps a border-radius group ($type dimension) to borderRadius tokens', () => {
    const dtcg = {
      'border-radius': {
        $type: 'dimension',
        sm: { $value: { value: 4, unit: 'px' } },
        md: { $value: { value: 8, unit: 'px' } },
      },
    }

    const ops = dtcgToTokenOps(dtcg)

    expect(ops).toEqual([
      {
        name: 'border-radius',
        tokens: [
          { name: 'sm', type: 'borderRadius', value: '4px' },
          { name: 'md', type: 'borderRadius', value: '8px' },
        ],
      },
    ])
  })
})

describe('dtcgToTokenOps — typography', () => {
  test('maps font-family/font-weight sub-groups to fontFamilies/fontWeights (values as strings)', () => {
    const dtcg = {
      typography: {
        'font-family': {
          $type: 'fontFamily',
          body: { $value: 'Helvetica Neue' },
        },
        'font-weight': {
          $type: 'fontWeight',
          bold: { $value: 700 },
          extrabold: { $value: 800 },
        },
      },
    }

    const ops = dtcgToTokenOps(dtcg)

    expect(ops).toEqual([
      {
        name: 'typography',
        tokens: [
          {
            name: 'font-family.body',
            type: 'fontFamilies',
            value: 'Helvetica Neue',
          },
          { name: 'font-weight.bold', type: 'fontWeights', value: '700' },
          { name: 'font-weight.extrabold', type: 'fontWeights', value: '800' },
        ],
      },
    ])
  })
})

describe('dtcgToTokenOps — edge cases', () => {
  test('returns an empty list for an empty tokens object', () => {
    expect(dtcgToTokenOps({})).toEqual([])
  })

  test('emits type null for a DTCG type with no Penpot mapping (glue skips these)', () => {
    const dtcg = {
      opacity: {
        $type: 'opacity',
        disabled: { $value: 0.5 },
      },
    }

    expect(dtcgToTokenOps(dtcg)).toEqual([
      {
        name: 'opacity',
        tokens: [{ name: 'disabled', type: null, value: '0.5' }],
      },
    ])
  })
})

describe('dtcgToTokenOps — shadow', () => {
  test('maps a shadow group to shadow tokens, normalizing nested dimensions to strings', () => {
    const dtcg = {
      shadow: {
        $type: 'shadow',
        sm: {
          $value: [
            {
              offsetX: { value: 0, unit: 'px' },
              offsetY: { value: 2, unit: 'px' },
              blur: { value: 4, unit: 'px' },
              spread: { value: 0, unit: 'px' },
              color: '#0000001a',
            },
          ],
        },
      },
    }

    const ops = dtcgToTokenOps(dtcg)

    // Penpot's TokenShadowValueString: every field is a string, offsets/blur/spread
    // are plain pixel numbers, plus an `inset` flag (DTCG drop shadows -> "false").
    expect(ops).toEqual([
      {
        name: 'shadow',
        tokens: [
          {
            name: 'sm',
            type: 'shadow',
            value: [
              {
                color: '#0000001a',
                inset: 'false',
                offsetX: '0',
                offsetY: '2',
                blur: '4',
                spread: '0',
              },
            ],
          },
        ],
      },
    ])
  })
})

describe('dtcgToTokenOps — full Mint DTCG output', () => {
  test('produces one set per top-level category, preserving order and token types', () => {
    const ops = dtcgToTokenOps(fixture('mint-ds.tokens.dtcg.json'))

    expect(ops.map((s) => s.name)).toEqual([
      'color',
      'spacing',
      'border-radius',
      'shadow',
      'typography',
    ])

    const byName = Object.fromEntries(ops.map((s) => [s.name, s]))
    expect(byName.color.tokens).toContainEqual({
      name: 'primary.500',
      type: 'color',
      value: '#1976d2',
    })
    expect(byName.spacing.tokens[0]).toEqual({
      name: '1',
      type: 'spacing',
      value: '4px',
    })
    expect(byName.typography.tokens).toContainEqual({
      name: 'font-weight.bold',
      type: 'fontWeights',
      value: '700',
    })

    // Every emitted token carries a name; only unsupported types are null.
    for (const set of ops) {
      for (const t of set.tokens) {
        expect(t.name).toBeTruthy()
        expect(t.type).not.toBeUndefined()
      }
    }
  })
})
