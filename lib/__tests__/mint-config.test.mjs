import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  CONFIG_FILENAMES,
  DEFAULT_CONFIG_FILE,
  DEFAULT_TOKENS_FILE,
  findConfigFile,
  loadConfig,
  scaffoldConfig,
  CONFIG_TEMPLATE,
  matchesIgnore,
  resolveAuditOptions,
  resolveExportOptions,
} from '../mint-config.mjs'

// Temp dirs live under node_modules (gitignored, and within Vite's fs allow
// list) so loadConfig's dynamic import of a scaffolded config resolves under
// the Vitest module runner, which will not serve files outside the project.
const TMP_ROOT = path.join(process.cwd(), 'node_modules', '.tmp-mint-config')

let dir
beforeEach(async () => {
  await fs.mkdir(TMP_ROOT, { recursive: true })
  dir = await fs.mkdtemp(path.join(TMP_ROOT, 'case-'))
})
afterEach(async () => {
  await fs.rm(TMP_ROOT, { recursive: true, force: true })
})

describe('CONFIG_FILENAMES', () => {
  it('lists the three recognized filenames in precedence order', () => {
    expect(CONFIG_FILENAMES).toEqual([
      'mint.config.mjs',
      'mint.config.js',
      'mint.config.cjs',
    ])
  })
})

describe('findConfigFile', () => {
  it('returns null when no config file is present', () => {
    expect(findConfigFile(dir)).toBeNull()
  })

  it('finds mint.config.mjs', async () => {
    await fs.writeFile(path.join(dir, 'mint.config.mjs'), 'export default {}\n')
    const found = findConfigFile(dir)
    expect(path.isAbsolute(found)).toBe(true)
    expect(path.basename(found)).toBe('mint.config.mjs')
  })

  it('finds mint.config.js when it is the only variant', async () => {
    await fs.writeFile(path.join(dir, 'mint.config.js'), 'export default {}\n')
    expect(path.basename(findConfigFile(dir))).toBe('mint.config.js')
  })

  it('finds mint.config.cjs when it is the only variant', async () => {
    await fs.writeFile(
      path.join(dir, 'mint.config.cjs'),
      'module.exports = {}\n'
    )
    expect(path.basename(findConfigFile(dir))).toBe('mint.config.cjs')
  })

  it('prefers .mjs over .js and .cjs when several exist', async () => {
    await fs.writeFile(path.join(dir, 'mint.config.cjs'), 'module.exports={}\n')
    await fs.writeFile(path.join(dir, 'mint.config.js'), 'export default {}\n')
    await fs.writeFile(path.join(dir, 'mint.config.mjs'), 'export default {}\n')
    expect(path.basename(findConfigFile(dir))).toBe('mint.config.mjs')
  })
})

describe('loadConfig', () => {
  it('returns an empty config and null path when no file exists', async () => {
    const result = await loadConfig(dir)
    expect(result).toEqual({ config: {}, path: null })
  })

  it('loads the default export of a valid .mjs config', async () => {
    await fs.writeFile(
      path.join(dir, 'mint.config.mjs'),
      `export default { source: './s', target: 'tailwind' }\n`
    )
    const { config, path: p } = await loadConfig(dir)
    expect(config).toEqual({ source: './s', target: 'tailwind' })
    expect(path.basename(p)).toBe('mint.config.mjs')
  })

  it('treats a config without an object default export as empty', async () => {
    await fs.writeFile(
      path.join(dir, 'mint.config.mjs'),
      `export const something = 1\n`
    )
    const { config } = await loadConfig(dir)
    expect(config).toEqual({})
  })

  it('throws a contextual error when the config file is malformed', async () => {
    await fs.writeFile(
      path.join(dir, 'mint.config.mjs'),
      `export default { oops \n`
    )
    await expect(loadConfig(dir)).rejects.toThrow(/mint\.config\.mjs/)
  })
})

describe('scaffoldConfig', () => {
  it('writes mint.config.mjs with the template contents', async () => {
    const { path: written } = await scaffoldConfig({ cwd: dir })
    expect(path.basename(written)).toBe(DEFAULT_CONFIG_FILE)
    const body = await fs.readFile(written, 'utf8')
    expect(body).toBe(CONFIG_TEMPLATE)
  })

  it('produces a file that loads into a config with the documented defaults', async () => {
    await scaffoldConfig({ cwd: dir })
    const { config } = await loadConfig(dir)
    expect(config).toMatchObject({
      source: expect.any(String),
      tokens: expect.any(String),
      target: expect.any(String),
      outDir: expect.any(String),
      ignore: expect.arrayContaining(['**/node_modules/**']),
    })
  })

  it('refuses to overwrite an existing config file without force', async () => {
    await fs.writeFile(path.join(dir, 'mint.config.js'), 'export default {}\n')
    await expect(scaffoldConfig({ cwd: dir })).rejects.toThrow(
      /already exists/i
    )
  })

  it('overwrites an existing config when force is true', async () => {
    await fs.writeFile(path.join(dir, 'mint.config.mjs'), '// stale sentinel\n')
    await scaffoldConfig({ cwd: dir, force: true })
    const body = await fs.readFile(path.join(dir, 'mint.config.mjs'), 'utf8')
    expect(body).toBe(CONFIG_TEMPLATE)
  })
})

describe('matchesIgnore', () => {
  it('matches a top-level and nested node_modules glob', () => {
    expect(matchesIgnore('node_modules/foo.css', ['**/node_modules/**'])).toBe(
      true
    )
    expect(
      matchesIgnore('packages/a/node_modules/b.css', ['**/node_modules/**'])
    ).toBe(true)
  })

  it('matches a dist glob', () => {
    expect(matchesIgnore('dist/bundle.css', ['**/dist/**'])).toBe(true)
  })

  it('treats * as a single path segment wildcard', () => {
    expect(matchesIgnore('foo.css', ['*.css'])).toBe(true)
    expect(matchesIgnore('a/foo.css', ['*.css'])).toBe(false)
  })

  it('treats ? as a single character wildcard', () => {
    expect(matchesIgnore('a.css', ['?.css'])).toBe(true)
    expect(matchesIgnore('ab.css', ['?.css'])).toBe(false)
  })

  it('returns false when nothing matches or there are no patterns', () => {
    expect(matchesIgnore('src/app.css', ['**/dist/**'])).toBe(false)
    expect(matchesIgnore('src/app.css', [])).toBe(false)
    expect(matchesIgnore('src/app.css')).toBe(false)
  })

  it('normalizes backslash paths before matching', () => {
    expect(matchesIgnore('dist\\bundle.css', ['**/dist/**'])).toBe(true)
  })
})

describe('resolveAuditOptions', () => {
  it('prefers the positional dir over config.source', () => {
    const { dir: d } = resolveAuditOptions({
      rest: ['./cli'],
      config: { source: './cfg' },
    })
    expect(d).toBe('./cli')
  })

  it('falls back to config.source when no positional dir', () => {
    const { dir: d } = resolveAuditOptions({
      rest: [],
      config: { source: './cfg' },
    })
    expect(d).toBe('./cfg')
  })

  it('prefers --out over config.tokens over the built-in default', () => {
    expect(
      resolveAuditOptions({
        flags: { out: 'a.json' },
        config: { tokens: 'b.json' },
      }).outFile
    ).toBe('a.json')
    expect(resolveAuditOptions({ config: { tokens: 'b.json' } }).outFile).toBe(
      'b.json'
    )
    expect(resolveAuditOptions({}).outFile).toBe(DEFAULT_TOKENS_FILE)
  })

  it('returns config.ignore as an array, defaulting to empty', () => {
    expect(
      resolveAuditOptions({ config: { ignore: ['**/x/**'] } }).ignore
    ).toEqual(['**/x/**'])
    expect(resolveAuditOptions({}).ignore).toEqual([])
  })
})

describe('resolveExportOptions', () => {
  it('prefers --target over config.target', () => {
    expect(
      resolveExportOptions({
        flags: { target: 'react' },
        config: { target: 'vue' },
      }).targetInput
    ).toBe('react')
    expect(
      resolveExportOptions({ config: { target: 'vue' } }).targetInput
    ).toBe('vue')
  })

  it('prefers --tokens over config.tokens over the default for the input path', () => {
    expect(
      resolveExportOptions({
        flags: { tokens: 'in.json' },
        config: { tokens: 'c.json' },
      }).tokensPath
    ).toBe('in.json')
    expect(
      resolveExportOptions({ config: { tokens: 'c.json' } }).tokensPath
    ).toBe('c.json')
    expect(resolveExportOptions({}).tokensPath).toBe(DEFAULT_TOKENS_FILE)
  })

  it('uses --out verbatim for the output path when given', () => {
    expect(
      resolveExportOptions({
        flags: { out: 'ui/Comp.tsx' },
        config: { outDir: './ds' },
        defaultFilename: 'tailwind.config.js',
      }).outPath
    ).toBe('ui/Comp.tsx')
  })

  it('joins config.outDir with the default filename when --out is absent', () => {
    expect(
      resolveExportOptions({
        config: { outDir: './ds' },
        defaultFilename: 'tailwind.config.js',
      }).outPath
    ).toBe(path.join('./ds', 'tailwind.config.js'))
  })

  it('writes to the current directory when neither --out nor outDir is set', () => {
    expect(
      resolveExportOptions({ defaultFilename: 'variables.css' }).outPath
    ).toBe(path.join('.', 'variables.css'))
  })
})
