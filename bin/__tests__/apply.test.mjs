import { describe, it, expect, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BIN = path.resolve('bin/mint-ds.mjs')
const TMP = path.resolve('node_modules/.tmp-apply')

async function writeRepo(files) {
  await fs.mkdir(TMP, { recursive: true })
  const dir = await fs.mkdtemp(path.join(TMP, 'case-'))
  execFileSync('git', ['init', '-q'], { cwd: dir })
  execFileSync('git', ['config', 'user.email', 't@t.co'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 't'], { cwd: dir })
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir })
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), content, 'utf8')
  }
  await fs.writeFile(
    path.join(dir, 'mint-ds.tokens.json'),
    JSON.stringify({
      colors: [
        { name: 'primary', value: '#1976d2', scale: { 500: '#1976d2' } },
      ],
      typography: { fontFamilies: {} },
      spacing: { 2: '8px' },
    }),
    'utf8'
  )
  execFileSync('git', ['add', '.'], { cwd: dir })
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir })
  return dir
}

function runCli(args, cwd) {
  try {
    const stdout = execFileSync('node', [BIN, ...args], {
      cwd,
      encoding: 'utf8',
    })
    return { code: 0, stdout }
  } catch (e) {
    return { code: e.status || 1, stdout: (e.stdout || '') + (e.stderr || '') }
  }
}

afterEach(async () => {
  await fs.rm(TMP, { recursive: true, force: true })
})

describe('mint-ds apply', () => {
  it('--dry-run prints the diff and writes nothing', async () => {
    const dir = await writeRepo({ 'a.css': '.a { color: #1976d2; }' })
    const res = runCli(['apply', '.', '--dry-run'], dir)
    expect(res.stdout).toContain('var(--color-primary)')
    const after = await fs.readFile(path.join(dir, 'a.css'), 'utf8')
    expect(after).toBe('.a { color: #1976d2; }')
  })

  it('writes in place when the tree is clean', async () => {
    const dir = await writeRepo({
      'a.css': '.a { color: #1976d2; padding: 8px; }',
    })
    const res = runCli(['apply', '.'], dir)
    expect(res.code).toBe(0)
    const after = await fs.readFile(path.join(dir, 'a.css'), 'utf8')
    expect(after).toBe(
      '.a { color: var(--color-primary); padding: var(--spacing-2); }'
    )
  })

  it('refuses to write when a target file is dirty, unless --force', async () => {
    const dir = await writeRepo({ 'a.css': '.a { color: #1976d2; }' })
    await fs.writeFile(
      path.join(dir, 'a.css'),
      '.a { color: #1976d2; /* edit */ }',
      'utf8'
    )
    const refused = runCli(['apply', '.'], dir)
    expect(refused.code).not.toBe(0)
    expect(refused.stdout).toMatch(/uncommitted changes/i)
    expect(await fs.readFile(path.join(dir, 'a.css'), 'utf8')).toContain(
      '/* edit */'
    )
    const forced = runCli(['apply', '.', '--force'], dir)
    expect(forced.code).toBe(0)
    expect(await fs.readFile(path.join(dir, 'a.css'), 'utf8')).toContain(
      'var(--color-primary)'
    )
  })

  it('rejects an unsupported --target', async () => {
    const dir = await writeRepo({ 'a.css': '.a { color: #1976d2; }' })
    const res = runCli(['apply', '.', '--target', 'tailwind-class'], dir)
    expect(res.code).not.toBe(0)
    expect(res.stdout).toMatch(/target/i)
  })

  it('refuses to rewrite a single non-source file', async () => {
    const dir = await writeRepo({ 'a.css': '.a { color: #1976d2; }' })
    await fs.writeFile(path.join(dir, 'notes.txt'), 'raw #1976d2 here', 'utf8')
    const res = runCli(['apply', 'notes.txt'], dir)
    expect(res.code).not.toBe(0)
    expect(res.stdout).toMatch(/unsupported file type/i)
    expect(await fs.readFile(path.join(dir, 'notes.txt'), 'utf8')).toBe(
      'raw #1976d2 here'
    )
  })

  it('rewrites a single source file passed directly', async () => {
    const dir = await writeRepo({ 'a.css': '.a { color: #1976d2; }' })
    const res = runCli(['apply', 'a.css'], dir)
    expect(res.code).toBe(0)
    expect(await fs.readFile(path.join(dir, 'a.css'), 'utf8')).toBe(
      '.a { color: var(--color-primary); }'
    )
  })

  it('refuses to write a file outside the git repo without --force', async () => {
    const dir = await writeRepo({ 'a.css': '.a { color: #1976d2; }' })
    const outside = path.join(TMP, 'outside.css')
    await fs.writeFile(outside, '.x { color: #1976d2; }', 'utf8')
    const res = runCli(['apply', outside], dir)
    expect(res.code).not.toBe(0)
    expect(await fs.readFile(outside, 'utf8')).toBe('.x { color: #1976d2; }') // untouched
  })
})
