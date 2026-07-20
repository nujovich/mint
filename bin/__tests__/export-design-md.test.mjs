import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// The design-md export is fully deterministic (no network, no LLM), so we can
// drive the real CLI end-to-end and assert on stdout.
const CLI = fileURLToPath(new URL('../mint-ds.mjs', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const TOKENS = resolve(REPO_ROOT, 'examples/frankenstein/mint-ds.tokens.json')

function runExport(args) {
  return spawnSync('node', [CLI, 'export', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
}

describe('mint-ds export --target design-md', () => {
  it('prints the generated DESIGN.md to stdout and exits 0', () => {
    const result = runExport([
      '--target',
      'design-md',
      '--tokens',
      TOKENS,
      '--stdout',
    ])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('# frankenstein Design System')
    expect(result.stdout).toContain('## Colors')
    expect(result.stdout).toContain('### primary')
  })

  it('resolves the "design" alias too', () => {
    const result = runExport([
      '--target',
      'design',
      '--tokens',
      TOKENS,
      '--stdout',
    ])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('# frankenstein Design System')
  })
})
