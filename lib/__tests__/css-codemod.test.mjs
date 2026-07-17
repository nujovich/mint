import { describe, it, expect } from 'vitest'
import { applyCodemod } from '../css-codemod.mjs'
import { buildTokenIndex } from '../token-index.mjs'

const INDEX = buildTokenIndex({
  colors: [
    {
      name: 'primary',
      value: '#1976d2',
      scale: { 500: '#1976d2', 600: '#1565c0' },
    },
  ],
  typography: { fontFamilies: { body: 'Inter, sans-serif' } },
  spacing: { 1: '4px', 2: '8px' },
})

const run = (src, opts) => applyCodemod(src, INDEX, opts)

describe('applyCodemod — exact', () => {
  it('replaces an exact representative color with the semantic base var', () => {
    const { output } = run('.a { color: #1976d2; }')
    expect(output).toBe('.a { color: var(--color-primary); }')
  })

  it('normalizes format before matching (uppercase hex, rgb form)', () => {
    expect(run('.a { color: #1976D2; }').output).toBe(
      '.a { color: var(--color-primary); }'
    )
    expect(run('.a { color: rgb(25, 118, 210); }').output).toBe(
      '.a { color: var(--color-primary); }'
    )
  })

  it('replaces a non-500 scale step with its numbered var', () => {
    expect(run('.a { border-color: #1565c0; }').output).toBe(
      '.a { border-color: var(--color-primary-600); }'
    )
  })

  it('replaces exact spacing only in spacing properties', () => {
    expect(run('.a { padding: 8px; }').output).toBe(
      '.a { padding: var(--spacing-2); }'
    )
    expect(run('.a { width: 8px; }').output).toBe('.a { width: 8px; }')
  })

  it('replaces each token in a multi-value shorthand', () => {
    expect(run('.a { padding: 4px 8px; }').output).toBe(
      '.a { padding: var(--spacing-1) var(--spacing-2); }'
    )
  })

  it('replaces an exact font-family', () => {
    expect(run('.a { font-family: Inter, sans-serif; }').output).toBe(
      '.a { font-family: var(--font-body); }'
    )
  })

  it('is idempotent — already-var values are left alone', () => {
    const once = run('.a { color: #1976d2; }').output
    expect(run(once).output).toBe(once)
  })

  it('never touches values inside url() or comments', () => {
    expect(run('.a { background: url(#1976d2.png); }').output).toBe(
      '.a { background: url(#1976d2.png); }'
    )
    expect(run('/* #1976d2 */ .a { top: 0; }').output).toBe(
      '/* #1976d2 */ .a { top: 0; }'
    )
  })

  it('reports edits', () => {
    const { edits } = run('.a { color: #1976d2; padding: 8px; }')
    expect(edits).toEqual([
      {
        kind: 'color',
        from: '#1976d2',
        to: 'var(--color-primary)',
        lossy: false,
      },
      { kind: 'spacing', from: '8px', to: 'var(--spacing-2)', lossy: false },
    ])
  })
})

describe('applyCodemod — fuzzy', () => {
  it('does nothing near-duplicate without --fuzzy', () => {
    expect(run('.a { color: #1a75d1; }').output).toBe('.a { color: #1a75d1; }')
  })

  it('snaps a near-duplicate color with a comment when fuzzy', () => {
    const { output, edits } = run('.a { color: #1a75d1; }', { fuzzy: true })
    expect(output).toBe('.a { color: var(--color-primary) /* was #1a75d1 */; }')
    expect(edits[0]).toEqual({
      kind: 'color',
      from: '#1a75d1',
      to: 'var(--color-primary) /* was #1a75d1 */',
      lossy: true,
    })
  })

  it('snaps an off-scale spacing to the nearest step with a comment when fuzzy', () => {
    expect(run('.a { padding: 9px; }', { fuzzy: true }).output).toBe(
      '.a { padding: var(--spacing-2) /* was 9px */; }'
    )
  })

  it('leaves far-off values untouched even with fuzzy', () => {
    expect(run('.a { color: #00ff00; }', { fuzzy: true }).output).toBe(
      '.a { color: #00ff00; }'
    )
    expect(run('.a { padding: 13px; }', { fuzzy: true }).output).toBe(
      '.a { padding: 13px; }'
    )
  })
})

describe('applyCodemod — protected spans', () => {
  it('leaves token-matching literals inside an inline comment untouched', () => {
    expect(run('.a { color: #1976d2 /* keep #1565c0 */; }').output).toBe(
      '.a { color: var(--color-primary) /* keep #1565c0 */; }'
    )
  })

  it('does not substitute a raw literal inside an existing var() fallback', () => {
    expect(run('.a { color: var(--brand, #1976d2); }').output).toBe(
      '.a { color: var(--brand, #1976d2); }'
    )
  })

  it('fuzzy output is idempotent when re-run', () => {
    const once = run('.a { color: #1a75d1; padding: 9px; }', {
      fuzzy: true,
    }).output
    const twice = run(once, { fuzzy: true }).output
    expect(twice).toBe(once)
  })

  it('exact output is idempotent when re-run', () => {
    const once = run('.a { color: #1976d2; padding: 8px; }').output
    expect(run(once).output).toBe(once)
  })
})

describe('applyCodemod — html', () => {
  it('rewrites CSS in <style> blocks but leaves inline style attributes untouched', () => {
    expect(run('<style>.a{color:#1976d2}</style>').output).toBe(
      '<style>.a{color:var(--color-primary)}</style>'
    )
    expect(run('<div style="color:#1976d2"></div>').output).toBe(
      '<div style="color:#1976d2"></div>'
    )
  })
})
