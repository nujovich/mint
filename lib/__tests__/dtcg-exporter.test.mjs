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
})
