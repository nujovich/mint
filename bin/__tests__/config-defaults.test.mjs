import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Integration tests that mint.config.mjs feeds the audit/export defaults and
// that CLI flags override config. All assertions hit early validation/`die`
// paths that run BEFORE any LLM call, so no network or API key is involved.
const CLI = fileURLToPath(new URL('../mint-ds.mjs', import.meta.url))

function run(cwd, args) {
  return spawnSync('node', [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, API_KEY: '', ANTHROPIC_API_KEY: '' },
  })
}

async function writeConfig(cwd, obj) {
  const body = `export default ${JSON.stringify(obj, null, 2)}\n`
  await fs.writeFile(path.join(cwd, 'mint.config.mjs'), body, 'utf8')
}

let dir
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mint-cfg-'))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('audit reads config defaults', () => {
  it('falls back to config.source when no directory is passed', async () => {
    await writeConfig(dir, { source: './missing-src' })
    const result = run(dir, ['audit'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/Path not found: \.\/missing-src/)
  })

  it('lets a positional directory override config.source', async () => {
    await writeConfig(dir, { source: './missing-src' })
    const result = run(dir, ['audit', './other-missing'])
    expect(result.stderr).toMatch(/Path not found: \.\/other-missing/)
  })

  it('applies config.ignore to the source walk', async () => {
    await writeConfig(dir, { ignore: ['**/*.css'] })
    await fs.mkdir(path.join(dir, 'styles'))
    await fs.writeFile(path.join(dir, 'styles', 'a.css'), 'a{color:red}\n')
    const result = run(dir, ['audit', './styles'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/No CSS.*files found/)
  })
})

describe('export reads config defaults', () => {
  it('uses config.target when --target is absent', async () => {
    await writeConfig(dir, { target: 'css' })
    const result = run(dir, ['export'])
    // Passed target validation using config.target, then failed on tokens.
    expect(result.stderr).toMatch(/Tokens file not found/)
    expect(result.stderr).not.toMatch(/--target/)
  })

  it('uses config.tokens for the input path', async () => {
    await writeConfig(dir, { target: 'css', tokens: 'custom.tokens.json' })
    const result = run(dir, ['export'])
    expect(result.stderr).toMatch(/custom\.tokens\.json/)
  })

  it('lets --tokens override config.tokens', async () => {
    await writeConfig(dir, { target: 'css', tokens: 'cfg.json' })
    const result = run(dir, ['export', '--tokens', 'flag.json'])
    expect(result.stderr).toMatch(/flag\.json/)
    expect(result.stderr).not.toMatch(/cfg\.json/)
  })
})
