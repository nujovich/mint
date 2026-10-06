import { describe, it, expect, vi } from 'vitest'
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

    it('maps font sizes to DTCG dimension group', () => {
      const tokens = {
        typography: {
          fontSizes: {
            sm: '14px',
            base: '16px',
            lg: '1.25rem',
            xl: 20,
          },
        },
      }
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg.typography['font-size'].$type).toBe('dimension')
      expect(dtcg.typography['font-size'].sm.$value).toEqual({
        value: 14,
        unit: 'px',
      })
      expect(dtcg.typography['font-size'].base.$value).toEqual({
        value: 16,
        unit: 'px',
      })
      expect(dtcg.typography['font-size'].lg.$value).toEqual({
        value: 1.25,
        unit: 'rem',
      })
      expect(dtcg.typography['font-size'].xl.$value).toEqual({
        value: 20,
        unit: 'px',
      })
      const result = validateDTCG(dtcg)
      expect(result.hasErrors).toBe(false)
    })

    it('maps unitless line heights to DTCG number group', () => {
      const tokens = {
        typography: {
          lineHeights: {
            tight: 1.2,
            normal: 1.5,
            relaxed: '1.7',
          },
        },
      }
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg.typography['line-height'].$type).toBe('number')
      expect(dtcg.typography['line-height'].tight.$value).toBe(1.2)
      expect(dtcg.typography['line-height'].normal.$value).toBe(1.5)
      expect(dtcg.typography['line-height'].relaxed.$value).toBe(1.7)
      const result = validateDTCG(dtcg)
      expect(result.hasErrors).toBe(false)
    })

    it('maps dimension line heights to DTCG dimension group', () => {
      const tokens = {
        typography: {
          lineHeights: {
            tight: '18px',
            normal: '24px',
          },
        },
      }
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg.typography['line-height'].$type).toBe('dimension')
      expect(dtcg.typography['line-height'].tight.$value).toEqual({
        value: 18,
        unit: 'px',
      })
      expect(dtcg.typography['line-height'].normal.$value).toEqual({
        value: 24,
        unit: 'px',
      })
      const result = validateDTCG(dtcg)
      expect(result.hasErrors).toBe(false)
    })

    it('maps mixed line heights with per-token $type override', () => {
      const tokens = {
        typography: {
          lineHeights: {
            tight: 1.2,
            fixed: '24px',
          },
        },
      }
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg.typography['line-height'].$type).toBe('number')
      expect(dtcg.typography['line-height'].tight.$value).toBe(1.2)
      expect(dtcg.typography['line-height'].fixed.$type).toBe('dimension')
      expect(dtcg.typography['line-height'].fixed.$value).toEqual({
        value: 24,
        unit: 'px',
      })
      const result = validateDTCG(dtcg)
      expect(result.hasErrors).toBe(false)
    })

    it('maps motion durations to DTCG duration group', () => {
      const tokens = {
        typography: {
          motion: {
            durations: {
              fast: '150ms',
              base: '200ms',
              slow: '300ms',
              instant: 50,
            },
          },
        },
      }
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg.motion.duration.$type).toBe('duration')
      expect(dtcg.motion.duration.fast.$value).toEqual({
        value: 150,
        unit: 'ms',
      })
      expect(dtcg.motion.duration.base.$value).toEqual({
        value: 200,
        unit: 'ms',
      })
      expect(dtcg.motion.duration.slow.$value).toEqual({
        value: 300,
        unit: 'ms',
      })
      expect(dtcg.motion.duration.instant.$value).toEqual({
        value: 50,
        unit: 'ms',
      })
      const result = validateDTCG(dtcg)
      expect(result.hasErrors).toBe(false)
    })

    it('normalizes duration units and handles leading decimals and uppercase', () => {
      const tokens = {
        typography: {
          motion: {
            durations: {
              decimalSeconds: '.2s',
              upperSeconds: '1.5S',
              invalid: 'fast-forward',
            },
          },
        },
      }
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg.motion.duration.decimalSeconds.$value).toEqual({
        value: 0.2,
        unit: 's',
      })
      expect(dtcg.motion.duration.upperSeconds.$value).toEqual({
        value: 1.5,
        unit: 's',
      })
      expect(dtcg.motion.duration.invalid).toBeUndefined()
      const result = validateDTCG(dtcg)
      expect(result.hasErrors).toBe(false)
    })

    it('handles edge cases in font sizes, line heights, and easings', () => {
      const tokens = {
        typography: {
          fontSizes: {
            upperUnit: '1.25REM',
            unparseable: 'clamp(2rem, 5vw, 4rem)',
          },
          lineHeights: {
            percent: '150%',
            emVal: '1.5em',
            upperRem: '1.5REM',
            nonNumeric: 'normal',
            cssVar: 'var(--lh)',
          },
          motion: {
            easings: {
              malformed: 'cubic-bezier(0.4,,0.2,1)',
              steps: 'steps(4)',
              cssVar: 'var(--ease)',
            },
          },
        },
      }
      const dtcg = convertTokensToDTCG(tokens)

      // Font sizes: normalizes unit case and skips unparseable (not 0px)
      expect(dtcg.typography['font-size'].upperUnit.$value).toEqual({
        value: 1.25,
        unit: 'rem',
      })
      expect(dtcg.typography['font-size'].unparseable).toBeUndefined()

      // Line heights: 150% and 1.5em become number 1.5, 1.5REM becomes dimension, non-numerics skipped
      expect(dtcg.typography['line-height'].percent.$value).toBe(1.5)
      expect(dtcg.typography['line-height'].emVal.$value).toBe(1.5)
      expect(dtcg.typography['line-height'].upperRem.$value).toEqual({
        value: 1.5,
        unit: 'rem',
      })
      expect(dtcg.typography['line-height'].upperRem.$type).toBe('dimension')
      expect(dtcg.typography['line-height'].nonNumeric).toBeUndefined()
      expect(dtcg.typography['line-height'].cssVar).toBeUndefined()

      // Easings: malformed/unsupported easings are cleanly skipped
      expect(dtcg.motion).toBeUndefined()

      const result = validateDTCG(dtcg)
      expect(result.hasErrors).toBe(false)
    })

    it('skips dimension units outside DTCG spec (em, %, vw) and warns', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const tokens = {
        spacing: {
          percent: '50%',
          viewport: '10vw',
        },
        typography: {
          fontSizes: {
            emSize: '0.875em',
            validRem: '1rem',
          },
        },
      }
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg.spacing).toBeUndefined()
      expect(dtcg.typography['font-size'].emSize).toBeUndefined()
      expect(dtcg.typography['font-size'].validRem.$value).toEqual({
        value: 1,
        unit: 'rem',
      })
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('enforces range checks: skips negative durations, negative line heights, and invalid bezier coordinates', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const tokens = {
        typography: {
          lineHeights: {
            negative: -1,
            negativeRem: '-1.5rem',
            valid: 1.5,
          },
          motion: {
            durations: {
              negative: '-150ms',
              valid: '200ms',
            },
            easings: {
              outOfRangeX1: 'cubic-bezier(-0.1, 0, 1, 1)',
              outOfRangeX2: 'cubic-bezier(0.4, 3, 2, 1)',
              valid: 'cubic-bezier(0.2, 0, 0, 1)',
            },
          },
        },
      }
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg.typography['line-height'].negative).toBeUndefined()
      expect(dtcg.typography['line-height'].negativeRem).toBeUndefined()
      expect(dtcg.typography['line-height'].valid.$value).toBe(1.5)

      expect(dtcg.motion.duration.negative).toBeUndefined()
      expect(dtcg.motion.duration.valid.$value).toEqual({
        value: 200,
        unit: 'ms',
      })

      expect(dtcg.motion.easing.outOfRangeX1).toBeUndefined()
      expect(dtcg.motion.easing.outOfRangeX2).toBeUndefined()
      expect(dtcg.motion.easing.valid.$value).toEqual([0.2, 0, 0, 1])
      warnSpy.mockRestore()
    })

    it('maps motion easings (cubic-bezier and named) to DTCG cubicBezier group', () => {
      const tokens = {
        typography: {
          motion: {
            easings: {
              standard: 'cubic-bezier(0.2, 0, 0, 1)',
              ease: 'ease',
              linear: 'linear',
              custom: [0.42, 0, 0.58, 1],
            },
          },
        },
      }
      const dtcg = convertTokensToDTCG(tokens)
      expect(dtcg.motion.easing.$type).toBe('cubicBezier')
      expect(dtcg.motion.easing.standard.$value).toEqual([0.2, 0, 0, 1])
      expect(dtcg.motion.easing.ease.$value).toEqual([0.25, 0.1, 0.25, 1])
      expect(dtcg.motion.easing.linear.$value).toEqual([0, 0, 1, 1])
      expect(dtcg.motion.easing.custom.$value).toEqual([0.42, 0, 0.58, 1])
      const result = validateDTCG(dtcg)
      expect(result.hasErrors).toBe(false)
    })

    it('produces fully valid DTCG output when full typography and motion are present', () => {
      const tokens = {
        typography: {
          fontFamilies: { body: 'Inter, sans-serif' },
          fontWeights: { normal: 400, bold: 700 },
          fontSizes: { base: '16px', lg: '18px' },
          lineHeights: { normal: 1.5, relaxed: 1.7 },
          motion: {
            durations: { fast: '150ms', slow: '300ms' },
            easings: { standard: 'cubic-bezier(0.2, 0, 0, 1)' },
          },
        },
      }
      const dtcg = convertTokensToDTCG(tokens)
      const result = validateDTCG(dtcg)
      expect(result.hasErrors).toBe(false)

      const serialized = serializeDTCG(dtcg)
      expect(typeof serialized).toBe('string')
      expect(JSON.parse(serialized)).toEqual(dtcg)
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
