import { describe, it, expect } from 'vitest'
import { validateDTCG, ValidationResult, Severity } from '../dtcg-validator.mjs'

describe('DTCG Validator', () => {
  describe('validateDTCG', () => {
    it('accepts a valid DTCG tokens file', () => {
      const tokens = {
        color: {
          $type: 'color',
          primary: {
            $value: '#1976d2',
            $type: 'color',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(false)
      expect(result.exitCode).toBe(0)
    })

    it('rejects token missing $value', () => {
      const tokens = {
        color: {
          primary: {
            $type: 'color',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'MISSING_VALUE')).toBe(true)
    })

    it('rejects token missing $type with no inherited type', () => {
      const tokens = {
        color: {
          primary: {
            $value: '#1976d2',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'MISSING_TYPE')).toBe(true)
    })

    it('accepts token with inherited type from parent group', () => {
      const tokens = {
        color: {
          $type: 'color',
          primary: {
            $value: '#1976d2',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(false)
    })

    it('validates color value format', () => {
      const tokens = {
        color: {
          $type: 'color',
          primary: {
            $value: 'not-a-color',
            $type: 'color',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasWarnings).toBe(true)
      expect(result.warnings.some((w) => w.code === 'COLOR_FORMAT')).toBe(true)
    })

    it('validates dimension value structure', () => {
      const tokens = {
        spacing: {
          $type: 'dimension',
          small: {
            $value: { value: 'not-a-number', unit: 'px' },
            $type: 'dimension',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'INVALID_DIMENSION')).toBe(
        true
      )
    })

    it('accepts valid dimension value', () => {
      const tokens = {
        spacing: {
          $type: 'dimension',
          small: {
            $value: { value: 4, unit: 'px' },
            $type: 'dimension',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(false)
    })

    it('accepts color object format', () => {
      const tokens = {
        color: {
          $type: 'color',
          primary: {
            $value: {
              colorSpace: 'srgb',
              components: [1, 0, 0],
              hex: '#ff0000',
            },
            $type: 'color',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(false)
    })

    it('rejects invalid color object', () => {
      const tokens = {
        color: {
          $type: 'color',
          primary: {
            $value: { colorSpace: 'srgb' },
            $type: 'color',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'INVALID_COLOR_OBJECT')).toBe(
        true
      )
    })

    it('accepts duration format', () => {
      const tokens = {
        duration: {
          $type: 'duration',
          fast: {
            $value: '150ms',
            $type: 'duration',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(false)
    })

    it('rejects invalid duration format', () => {
      const tokens = {
        duration: {
          $type: 'duration',
          fast: {
            $value: '150',
            $type: 'duration',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'INVALID_DURATION')).toBe(
        true
      )
    })

    it('accepts fontFamily as string or array', () => {
      const tokens = {
        typography: {
          $type: 'fontFamilies',
          body: {
            $value: 'Inter',
            $type: 'fontFamily',
          },
          heading: {
            $value: ['Roboto', 'sans-serif'],
            $type: 'fontFamily',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(false)
    })

    it('accepts references (curly brace syntax) without value validation', () => {
      const tokens = {
        color: {
          $type: 'color',
          primary: {
            $value: '#1976d2',
            $type: 'color',
          },
        },
        semantic: {
          text: {
            $value: '{color.primary}',
            $type: 'color',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(false)
      expect(result.hasWarnings).toBe(false)
    })

    it('validates $description is string', () => {
      const tokens = {
        color: {
          $type: 'color',
          primary: {
            $value: '#1976d2',
            $type: 'color',
            $description: 123,
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'INVALID_DESCRIPTION')).toBe(
        true
      )
    })

    it('validates $deprecated format', () => {
      const tokens = {
        color: {
          $type: 'color',
          primary: {
            $value: '#1976d2',
            $type: 'color',
            $deprecated: 123,
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'INVALID_DEPRECATED')).toBe(
        true
      )
    })

    it('accepts valid $deprecated values', () => {
      const tokens = {
        color: {
          $type: 'color',
          old: {
            $value: '#1976d2',
            $type: 'color',
            $deprecated: true,
          },
          oldWithReason: {
            $value: '#1976d2',
            $type: 'color',
            $deprecated: 'Use primary instead',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(false)
    })

    it('validates $extensions is object', () => {
      const tokens = {
        color: {
          $type: 'color',
          primary: {
            $value: '#1976d2',
            $type: 'color',
            $extensions: 'not-an-object',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'INVALID_EXTENSIONS')).toBe(
        true
      )
    })

    it('warns on unknown token properties', () => {
      const tokens = {
        color: {
          $type: 'color',
          primary: {
            $value: '#1976d2',
            $type: 'color',
            customProp: 'value',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasWarnings).toBe(true)
      expect(result.warnings.some((w) => w.code === 'UNKNOWN_PROPERTY')).toBe(
        true
      )
    })

    it('validates group $type is string', () => {
      const tokens = {
        color: {
          $type: 123,
          primary: {
            $value: '#1976d2',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'INVALID_GROUP_TYPE')).toBe(
        true
      )
    })

    it('warns on non-standard group type', () => {
      const tokens = {
        customGroup: {
          $type: 'customType',
          primary: {
            $value: '#1976d2',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasWarnings).toBe(true)
      expect(
        result.warnings.some((w) => w.code === 'NON_STANDARD_GROUP_TYPE')
      ).toBe(true)
    })

    it('rejects invalid $extends', () => {
      const tokens = {
        base: {
          $type: 'color',
          primary: {
            $value: '#1976d2',
          },
        },
        derived: {
          $extends: 123,
          secondary: {
            $value: '#9c27b0',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'INVALID_EXTENDS')).toBe(true)
    })

    it('rejects circular $extends', () => {
      const tokens = {
        a: {
          $extends: '{a}',
          primary: {
            $value: '#1976d2',
            $type: 'color',
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'CIRCULAR_EXTENDS')).toBe(
        true
      )
    })

    it('validates token name rules', () => {
      const tokens = {
        'color.primary': {
          // contains '.'
          $value: '#1976d2',
          $type: 'color',
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'INVALID_TOKEN_NAME')).toBe(
        true
      )
    })

    it('rejects token name starting with $', () => {
      const tokens = {
        $color: {
          $value: '#1976d2',
          $type: 'color',
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(true)
      expect(result.errors.some((e) => e.code === 'INVALID_TOKEN_NAME')).toBe(
        true
      )
    })

    it('handles nested groups', () => {
      const tokens = {
        color: {
          $type: 'color',
          brand: {
            $type: 'color',
            primary: {
              $value: '#1976d2',
            },
            secondary: {
              $value: '#9c27b0',
            },
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.hasErrors).toBe(false)
    })

    it('returns correct exit codes', () => {
      const valid = {
        color: { $type: 'color', primary: { $value: '#1976d2' } },
      }
      const warningsOnly = {
        color: {
          $type: 'color',
          primary: { $value: 'not-a-color', $type: 'color' },
        },
      }
      const errors = { color: { primary: { $value: '#1976d2' } } }

      expect(validateDTCG(valid).exitCode).toBe(0)
      expect(validateDTCG(warningsOnly).exitCode).toBe(1)
      expect(validateDTCG(errors).exitCode).toBe(2)
    })

    it('rejects invalid root', () => {
      const result = validateDTCG(null)
      expect(result.hasErrors).toBe(true)
      expect(result.errors[0].code).toBe('INVALID_ROOT')
    })

    it('rejects array as root', () => {
      const result = validateDTCG([])
      expect(result.hasErrors).toBe(true)
      expect(result.errors[0].code).toBe('INVALID_ROOT')
    })
  })

  describe('semantic coherence (milestone 2)', () => {
    it('reports broken references', () => {
      const tokens = {
        color: {
          $type: 'color',
          primary: { $value: '#1976d2' },
          alias: { $value: '{color.nope}' },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.errors.some((e) => e.code === 'BROKEN_REFERENCE')).toBe(
        true
      )
    })

    it('accepts valid references between tokens', () => {
      const tokens = {
        color: {
          $type: 'color',
          primary: { $value: '#1976d2' },
          alias: { $value: '{color.primary}' },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.errors.some((e) => e.code === 'BROKEN_REFERENCE')).toBe(
        false
      )
    })

    it('detects circular references', () => {
      const tokens = {
        color: {
          $type: 'color',
          a: { $value: '{color.b}' },
          b: { $value: '{color.a}' },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.errors.some((e) => e.code === 'CIRCULAR_REFERENCE')).toBe(
        true
      )
    })

    it('flags type mismatch on referenced tokens', () => {
      const tokens = {
        color: {
          $type: 'color',
          primary: { $value: '#1976d2' },
        },
        spacing: {
          $type: 'dimension',
          weird: { $value: '{color.primary}' },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.warnings.some((w) => w.code === 'TYPE_MISMATCH')).toBe(true)
    })

    it('extracts references from composite (object) values', () => {
      const tokens = {
        color: {
          $type: 'color',
          base: { $value: '#000' },
        },
        border: {
          $type: 'border',
          thin: {
            $value: {
              width: { value: 1, unit: 'px' },
              style: 'solid',
              color: '{color.missing}',
            },
          },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.errors.some((e) => e.code === 'BROKEN_REFERENCE')).toBe(
        true
      )
    })

    it('warns when naming conventions are mixed', () => {
      const tokens = {
        color: {
          $type: 'color',
          'primary-light': { $value: '#aaa' },
          'primary-dark': { $value: '#000' },
          primaryAccent: { $value: '#fff' },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.warnings.some((w) => w.code === 'NAMING_CONVENTION')).toBe(
        true
      )
    })

    it('does not warn when naming is consistent', () => {
      const tokens = {
        color: {
          $type: 'color',
          'primary-light': { $value: '#aaa' },
          'primary-dark': { $value: '#000' },
        },
      }
      const result = validateDTCG(tokens)
      expect(result.warnings.some((w) => w.code === 'NAMING_CONVENTION')).toBe(
        false
      )
    })

    it('can disable semantic checks via option', () => {
      const tokens = {
        color: {
          $type: 'color',
          alias: { $value: '{color.nope}' },
        },
      }
      const result = validateDTCG(tokens, { semantic: false })
      expect(result.errors.some((e) => e.code === 'BROKEN_REFERENCE')).toBe(
        false
      )
    })
  })

  describe('ValidationResult', () => {
    it('tracks errors, warnings, infos separately', () => {
      const result = new ValidationResult()
      result.addError('path1', 'error1', 'CODE1')
      result.addWarning('path2', 'warning1', 'CODE2')
      result.addInfo('path3', 'info1', 'CODE3')

      expect(result.errors.length).toBe(1)
      expect(result.warnings.length).toBe(1)
      expect(result.infos.length).toBe(1)
    })

    it('toJSON serializes correctly', () => {
      const result = new ValidationResult()
      result.addError('path1', 'error1', 'CODE1')
      const json = result.toJSON()
      expect(json.valid).toBe(false)
      expect(json.errors.length).toBe(1)
      expect(json.errors[0]).toEqual({
        path: 'path1',
        message: 'error1',
        code: 'CODE1',
      })
    })

    it('print formats output correctly', () => {
      const result = new ValidationResult()
      result.addError('color.primary', 'Missing $type', 'MISSING_TYPE')
      result.addWarning('color.primary', 'Weird color', 'COLOR_FORMAT')
      const output = result.print()
      expect(output).toContain('✗ color.primary: Missing $type [MISSING_TYPE]')
      expect(output).toContain('⚠ color.primary: Weird color [COLOR_FORMAT]')
    })
  })
})
