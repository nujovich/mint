import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildPlugin } from '../build-plugin.mjs'

const pluginJs = () =>
  readFileSync(fileURLToPath(new URL('../plugin.js', import.meta.url)), 'utf8')

describe('build-plugin', () => {
  test('output has no ES module import/export statements (Penpot evals as a script)', () => {
    const out = buildPlugin()
    const offending = out
      .split('\n')
      .filter((line) => /^\s*(import|export)\s/.test(line))
    expect(offending).toEqual([])
  })

  test('bundles the importSets writer together with the sandbox glue', () => {
    const out = buildPlugin()
    expect(out).toContain('function importSets')
    expect(out).toContain('penpot.ui.onMessage')
  })

  test('committed plugin.js is up to date with the sources (run npm run build:plugin)', () => {
    expect(pluginJs()).toBe(buildPlugin())
  })
})
