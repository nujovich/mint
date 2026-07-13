import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseLocalDeps, collectReachableFiles } from '../check-pack.mjs'

describe('parseLocalDeps', () => {
  it('extracts relative specifiers from import/export/require/dynamic-import forms', () => {
    const source = `
      import { a } from '../lib/foo.mjs'
      import '../lib/side-effect.mjs'
      export { b } from './bar.mjs'
      const pkg = require('../package.json')
      const mod = await import('./dyn.mjs')
    `
    expect(parseLocalDeps(source).sort()).toEqual(
      [
        '../lib/foo.mjs',
        '../lib/side-effect.mjs',
        './bar.mjs',
        '../package.json',
        './dyn.mjs',
      ].sort()
    )
  })

  it('ignores bare specifiers and node: builtins', () => {
    const source = `
      import { features } from 'web-features'
      import { promises as fs } from 'node:fs'
      const bl = require('browserslist')
      import x from '@scope/pkg'
    `
    expect(parseLocalDeps(source)).toEqual([])
  })

  it('deduplicates repeated specifiers', () => {
    const source = `
      import { a } from './x.mjs'
      import { b } from './x.mjs'
    `
    expect(parseLocalDeps(source)).toEqual(['./x.mjs'])
  })
})

describe('collectReachableFiles', () => {
  let root
  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'pack-check-'))
    await fs.mkdir(path.join(root, 'bin'))
    await fs.mkdir(path.join(root, 'lib'))
    await fs.writeFile(
      path.join(root, 'bin/entry.mjs'),
      `import { a } from '../lib/a.mjs'\nimport { features } from 'web-features'\n`
    )
    await fs.writeFile(
      path.join(root, 'lib/a.mjs'),
      `import { b } from './b.mjs'\nconst pkg = require('../package.json')\n`
    )
    await fs.writeFile(path.join(root, 'lib/b.mjs'), `export const b = 1\n`)
    await fs.writeFile(path.join(root, 'package.json'), `{"name":"fixture"}\n`)
  })
  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('returns the transitive set of local files reachable from the entry (incl. the entry)', async () => {
    const reachable = await collectReachableFiles(
      path.join(root, 'bin/entry.mjs'),
      root
    )
    expect([...reachable].sort()).toEqual(
      ['bin/entry.mjs', 'lib/a.mjs', 'lib/b.mjs', 'package.json'].sort()
    )
  })

  it('does not include bare npm dependencies', async () => {
    const reachable = await collectReachableFiles(
      path.join(root, 'bin/entry.mjs'),
      root
    )
    expect([...reachable].some((f) => f.includes('web-features'))).toBe(false)
  })

  it('skips relative specifiers that do not resolve to an existing file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pack-check-missing-'))
    await fs.writeFile(
      path.join(dir, 'entry.mjs'),
      `import { x } from './does-not-exist.mjs'\n`
    )
    const reachable = await collectReachableFiles(
      path.join(dir, 'entry.mjs'),
      dir
    )
    expect([...reachable]).toEqual(['entry.mjs'])
    await fs.rm(dir, { recursive: true, force: true })
  })
})
