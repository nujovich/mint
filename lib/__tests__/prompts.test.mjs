import { describe, it, expect } from 'vitest'
import {
  stripFences,
  resolveTarget,
  preprocessCss,
} from '../prompts.mjs'

describe('stripFences', () => {
  it('strips a js-fenced code block', () => {
    expect(stripFences('```js\nconst x = 1\n```')).toBe('const x = 1')
  })

  it('strips a css-fenced code block', () => {
    expect(stripFences('```css\nbody { color: red; }\n```')).toBe('body { color: red; }')
  })

  it('returns unfenced input unchanged', () => {
    expect(stripFences('const x = 1')).toBe('const x = 1')
  })
})

describe('resolveTarget', () => {
  it('returns a canonical target key unchanged', () => {
    expect(resolveTarget('css-variables')).toBe('css-variables')
  })

  it('resolves a short alias to its canonical key', () => {
    expect(resolveTarget('react')).toBe('react-component')
  })

  it('resolves tailwind alias', () => {
    expect(resolveTarget('tailwind')).toBe('tailwind-config')
  })

  it('returns null for an unknown target', () => {
    expect(resolveTarget('unknown-xyz')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(resolveTarget(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(resolveTarget('')).toBeNull()
  })
})

describe('preprocessCss', () => {
  it('strips block comments', () => {
    expect(preprocessCss('/* comment */ body { color: red; }')).toBe('body { color: red; }')
  })

  it('strips line comments', () => {
    expect(preprocessCss('// comment\nbody { color: red; }')).toBe('body { color: red; }')
  })

  it('collapses multiple whitespace to a single space', () => {
    expect(preprocessCss('body  {   color:   red;   }')).toBe('body { color: red; }')
  })

  it('returns already-clean input unchanged', () => {
    expect(preprocessCss('body { color: red; }')).toBe('body { color: red; }')
  })
})
