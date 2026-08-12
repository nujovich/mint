import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { convertTokensToDTCG, serializeDTCG } from '../dtcg-exporter.mjs'
import { validateDTCG } from '../dtcg-validator.mjs'

const FIXTURE_DIR = resolve(import.meta.dirname, '../../examples/frankenstein')

function readJson(filename) {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, filename), 'utf8'))
}

describe('DTCG Exporter', () => {
  describe('convertTokensToDTCG', () => {
    it('produces valid DTCG v1 output from the frankenstein fixture', () => {
      const tokens = readJson('mint-ds.tokens.json')
      const dtcg = convertTokensToDTCG(tokens)
      const result = validateDTCG(dtcg)
      expect(result.hasErrors).toBe(false)
    })

    it('produces output that matches the golden fixture exactly', () => {
      const tokens = readJson('mint-ds.tokens.json')
      const dtcg = convertTokensToDTCG(tokens)
      const output = serializeDTCG(dtcg)
      const expected = readFileSync(
        resolve(FIXTURE_DIR, 'mint-ds.tokens.dtcg.json'),
        'utf8'
      )
      expect(output).toBe(expected.trimEnd())
    })

    it('maps colors with inherited $type: color', () => {
      const tokens = readJson('mint-ds.tokens.json')
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg.color.$type).toBe('color')
      expect(dtcg.color.primary['500'].$value).toBe('#1976d2')
    })

    it('maps spacing to DTCG dimensions', () => {
      const tokens = readJson('mint-ds.tokens.json')
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg.spacing.$type).toBe('dimension')
      expect(dtcg.spacing['1'].$value).toEqual({ value: 4, unit: 'px' })
      expect(dtcg.spacing['2'].$value).toEqual({ value: 8, unit: 'px' })
    })

    it('maps border radius to DTCG dimensions', () => {
      const tokens = readJson('mint-ds.tokens.json')
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg['border-radius'].$type).toBe('dimension')
      expect(dtcg['border-radius'].sm.$value).toEqual({ value: 4, unit: 'px' })
    })

    it('parses box-shadow into DTCG shadow array', () => {
      const tokens = readJson('mint-ds.tokens.json')
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg.shadow.$type).toBe('shadow')
      expect(dtcg.shadow.sm.$value).toHaveLength(1)
      expect(dtcg.shadow.sm.$value[0].offsetX).toEqual({ value: 0, unit: 'px' })
      expect(dtcg.shadow.sm.$value[0].offsetY).toEqual({ value: 2, unit: 'px' })
      expect(dtcg.shadow.sm.$value[0].blur).toEqual({ value: 4, unit: 'px' })
      expect(dtcg.shadow.sm.$value[0].color).toBe('#0000001a')
    })

    it('maps font families to DTCG fontFamily group', () => {
      const tokens = readJson('mint-ds.tokens.json')
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg.typography['font-family'].$type).toBe('fontFamily')
      expect(dtcg.typography['font-family'].body.$value).toBe('Helvetica Neue')
    })

    it('maps font weights to DTCG fontWeight group', () => {
      const tokens = readJson('mint-ds.tokens.json')
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg.typography['font-weight'].$type).toBe('fontWeight')
      expect(dtcg.typography['font-weight'].bold.$value).toBe(700)
    })

    it('handles empty tokens gracefully', () => {
      const dtcg = convertTokensToDTCG({})
      expect(Object.keys(dtcg)).toHaveLength(0)
    })

    it('handles null/missing sections gracefully', () => {
      const dtcg = convertTokensToDTCG({ brand: 'test' })
      expect(Object.keys(dtcg)).toHaveLength(0)
    })

    it('serializeDTCG preserves $ keys first in output', () => {
      const dtcg = { spacing: { $type: 'dimension', 1: { $value: '4px' } } }
      const out = serializeDTCG(dtcg)
      // $type should appear before the numeric keys in the serialized output
      const typeIdx = out.indexOf('"$type"')
      const valueIdx = out.indexOf('"1"')
      expect(typeIdx).toBeLessThan(valueIdx)
    })
  })

  describe('DTCG output validation (milestone 4)', () => {
    const HELPERS_DIR = resolve(import.meta.dirname, 'helpers')

    function readHelperJson(filename) {
      return JSON.parse(readFileSync(resolve(HELPERS_DIR, filename), 'utf8'))
    }

    it('valid fixture passes DTCG validator with zero errors', () => {
      const dtcg = readHelperJson('dtcg-valid-output.json')
      const result = validateDTCG(dtcg)
      expect(result.hasErrors).toBe(false)
      expect(result.exitCode).toBe(0)
    })

    it('valid fixture has dimension tokens with {value, unit} objects', () => {
      const dtcg = readHelperJson('dtcg-valid-output.json')
      expect(dtcg.spacing.$type).toBe('dimension')
      expect(dtcg.spacing['1'].$value).toEqual({ value: 4, unit: 'px' })
      expect(dtcg.spacing.gutter.$value).toEqual({ value: 1.5, unit: 'rem' })
      expect(dtcg['border-radius'].$type).toBe('dimension')
      expect(dtcg['border-radius'].sm.$value).toEqual({ value: 4, unit: 'px' })
    })

    it('valid fixture has shadow arrays with dimension objects', () => {
      const dtcg = readHelperJson('dtcg-valid-output.json')
      expect(dtcg.shadow.$type).toBe('shadow')
      expect(Array.isArray(dtcg.shadow.sm.$value)).toBe(true)
      expect(dtcg.shadow.sm.$value[0].offsetX).toEqual({ value: 0, unit: 'px' })
      expect(dtcg.shadow.sm.$value[0].offsetY).toEqual({ value: 2, unit: 'px' })
      expect(dtcg.shadow.sm.$value[0].blur).toEqual({ value: 4, unit: 'px' })
      expect(dtcg.shadow.md.$value[0].offsetY).toEqual({ value: 4, unit: 'px' })
    })

    it('valid fixture has typography sub-groups with correct types', () => {
      const dtcg = readHelperJson('dtcg-valid-output.json')
      expect(dtcg.typography['font-family'].$type).toBe('fontFamily')
      expect(dtcg.typography['font-family'].body.$value).toBe('Inter')
      expect(Array.isArray(dtcg.typography['font-family'].heading.$value)).toBe(
        true
      )
      expect(dtcg.typography['font-weight'].$type).toBe('fontWeight')
      expect(dtcg.typography['font-weight'].bold.$value).toBe(700)
      expect(dtcg.typography['font-weight'].normal.$value).toBe(400)
      expect(dtcg.typography['font-size'].$type).toBe('dimension')
      expect(dtcg.typography['font-size'].md.$value).toEqual({
        value: 16,
        unit: 'px',
      })
      expect(dtcg.typography['line-height'].$type).toBe('number')
      expect(dtcg.typography['line-height'].normal.$value).toBe(1.5)
    })

    it('valid fixture has color hex values', () => {
      const dtcg = readHelperJson('dtcg-valid-output.json')
      expect(dtcg.color.$type).toBe('color')
      expect(dtcg.color.primary['500'].$value).toBe('#1976d2')
      expect(dtcg.color.error.$value).toBe('#e53935')
      expect(dtcg.color.background.$value).toBe('#f5f5f5')
    })

    it('valid fixture serializes and re-parses identically', () => {
      const dtcg = readHelperJson('dtcg-valid-output.json')
      const json = serializeDTCG(dtcg)
      const reparsed = JSON.parse(json)
      const result = validateDTCG(reparsed)
      expect(result.hasErrors).toBe(false)
      expect(reparsed.color.$type).toBe('color')
      expect(reparsed.spacing.$type).toBe('dimension')
    })

    it('broken fixture reports the expected validation errors', () => {
      const broken = readFileSync(
        resolve(FIXTURE_DIR, 'mint-ds.tokens.dtcg.broken.json'),
        'utf8'
      )
      const dtcg = JSON.parse(broken)
      const result = validateDTCG(dtcg)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'BROKEN_REFERENCE')).toBe(
        true
      )
      expect(result.errors.some((e) => e.code === 'CIRCULAR_REFERENCE')).toBe(
        true
      )
    })

    it('rejects DTCG output with string dimensions instead of objects', () => {
      const bad = {
        spacing: {
          $type: 'dimension',
          1: { $value: '4px' },
        },
      }
      const result = validateDTCG(bad)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'INVALID_DIMENSION')).toBe(
        true
      )
    })

    it('rejects DTCG output with non-array shadow value', () => {
      const bad = {
        shadow: {
          $type: 'shadow',
          sm: { $value: '0 2px 4px rgba(0,0,0,0.1)' },
        },
      }
      const result = validateDTCG(bad)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'INVALID_SHADOW')).toBe(true)
    })

    it('rejects DTCG output missing $value on leaf token', () => {
      const bad = {
        color: {
          $type: 'color',
          primary: { $type: 'color' },
        },
      }
      const result = validateDTCG(bad)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'MISSING_VALUE')).toBe(true)
    })
  })
})
