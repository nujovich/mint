import { describe, it, expect, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BIN = path.resolve('bin/mint-ds.mjs')
const TMP = path.resolve('node_modules/.tmp-complexity')

async function writeRepo(files) {
  await fs.mkdir(TMP, { recursive: true })
  const dir = await fs.mkdtemp(path.join(TMP, 'case-'))
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), content, 'utf8')
  }
  return dir
}

function runCli(args, cwd) {
  try {
    const stdout = execFileSync('node', [BIN, ...args], {
      cwd,
      encoding: 'utf8',
    })
    return { code: 0, stdout, stderr: '' }
  } catch (e) {
    return {
      code: e.status || 1,
      stdout: e.stdout || '',
      stderr: e.stderr || '',
    }
  }
}

afterEach(async () => {
  await fs.rm(TMP, { recursive: true, force: true })
})

describe('mint-ds complexity', () => {
  it('emits a JSON report with metrics and exits 0 on a clean stylesheet', async () => {
    const dir = await writeRepo({ 'a.css': '.a { color: red; }' })
    const res = runCli(['complexity', '.', '--json'], dir)
    expect(res.code).toBe(0)
    const report = JSON.parse(res.stdout)
    expect(report.files).toBe(1)
    expect(report.status).toBe('pass')
    expect(report.exitCode).toBe(0)
    expect(report.metrics.selectorCount).toBe(1)
    expect(report.thresholds.maxSelectors).toBe(1000)
  })

  it('exits 1 when a threshold is exceeded', async () => {
    const dir = await writeRepo({
      'a.css': '#a #b #c { color: red; }',
    })
    const res = runCli(
      ['complexity', '.', '--json', '--max-specificity', '10'],
      dir
    )
    expect(res.code).toBe(1)
    const report = JSON.parse(res.stdout)
    expect(report.status).toBe('fail')
    expect(report.exceeded.maxSpecificity).toBe(true)
  })

  it('emits a Markdown table with --markdown and exits 0 on clean CSS', async () => {
    const dir = await writeRepo({ 'a.css': '.a { color: red; }' })
    const res = runCli(['complexity', '.', '--markdown'], dir)
    expect(res.code).toBe(0)
    expect(res.stdout).toContain('## CSS Complexity Metrics')
    expect(res.stdout).toContain('| Selectors |')
  })

  it('respects --max-selectors and exits 1 when exceeded', async () => {
    const dir = await writeRepo({
      'a.css': '.a, .b, .c { color: red; }',
    })
    const res = runCli(
      ['complexity', '.', '--json', '--max-selectors', '1'],
      dir
    )
    expect(res.code).toBe(1)
    const report = JSON.parse(res.stdout)
    expect(report.exceeded.maxSelectors).toBe(true)
  })
})
