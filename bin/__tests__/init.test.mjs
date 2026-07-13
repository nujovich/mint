import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Integration tests for `mint-ds init`. The CLI runs as a real child process
// (no network, no LLM), so we can drive it end-to-end and assert on exit codes.
const CLI = fileURLToPath(new URL('../mint-ds.mjs', import.meta.url))

function runInit(cwd, args = []) {
  return spawnSync('node', [CLI, 'init', ...args], { cwd, encoding: 'utf8' })
}

let dir
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mint-init-'))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('mint-ds init', () => {
  it('scaffolds mint.config.mjs and exits 0', () => {
    const result = runInit(dir)
    expect(result.status).toBe(0)
    expect(existsSync(path.join(dir, 'mint.config.mjs'))).toBe(true)
  })

  it('refuses to overwrite an existing config and exits non-zero', () => {
    runInit(dir)
    const result = runInit(dir)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/already exists/i)
  })

  it('overwrites an existing config when --force is passed', () => {
    runInit(dir)
    const result = runInit(dir, ['--force'])
    expect(result.status).toBe(0)
  })
})
