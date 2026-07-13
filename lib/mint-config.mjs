// Mint config loading and scaffolding.
//
// `mint-ds init` writes a `mint.config.mjs` (see CONFIG_TEMPLATE), and the
// audit/export commands load it as a source of defaults. CLI flags always win
// over config values; config values win over the built-in defaults.
//
// The scaffolded file uses `.mjs` on purpose: the package is not `type:module`
// and most consumer projects are CommonJS, so a `mint.config.js` with
// `export default` would throw when loaded via dynamic import. `.mjs` always
// loads as ESM regardless of the host project. An existing `.js`/`.cjs` is
// still recognized by findConfigFile/loadConfig if the user creates one.

import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/** Tokens filename used when neither a flag nor config supplies one. */
export const DEFAULT_TOKENS_FILE = 'mint-ds.tokens.json'

/** Recognized config filenames, in resolution precedence order. */
export const CONFIG_FILENAMES = [
  'mint.config.mjs',
  'mint.config.js',
  'mint.config.cjs',
]

/** Filename `mint-ds init` scaffolds. */
export const DEFAULT_CONFIG_FILE = 'mint.config.mjs'

/** Contents written by `mint-ds init`. */
export const CONFIG_TEMPLATE = `/** @type {import('mint-ds').MintConfig} */
export default {
  // Directory the audit walks by default
  source: './src/styles',
  // Default tokens file
  tokens: '${DEFAULT_TOKENS_FILE}',
  // Default export target
  target: 'tailwind',
  // Where exports are written
  outDir: './design-system',
  // Glob patterns excluded from the audit walk
  ignore: ['**/node_modules/**', '**/dist/**'],
}
`

/**
 * Resolve the first existing config file in `cwd`, honoring CONFIG_FILENAMES
 * precedence. Returns an absolute path, or null when none exists.
 * @param {string} [cwd]
 * @returns {string | null}
 */
export function findConfigFile(cwd = process.cwd()) {
  for (const name of CONFIG_FILENAMES) {
    const candidate = path.join(cwd, name)
    if (existsSync(candidate)) return candidate
  }
  return null
}

/**
 * Load the mint config from `cwd`. Returns the parsed default export (or an
 * empty object when there is no default object export) along with the resolved
 * path. When no config file exists, returns `{ config: {}, path: null }`.
 * Throws a contextual error when the config file fails to load.
 * @param {string} [cwd]
 * @returns {Promise<{ config: object, path: string | null }>}
 */
export async function loadConfig(cwd = process.cwd()) {
  const configPath = findConfigFile(cwd)
  if (!configPath) return { config: {}, path: null }

  let mod
  try {
    mod = await import(pathToFileURL(configPath).href)
  } catch (err) {
    const detail = err && err.message ? err.message : String(err)
    throw new Error(
      `Failed to load config ${path.basename(configPath)}: ${detail}`
    )
  }

  const value = mod?.default
  const config = value && typeof value === 'object' ? value : {}
  return { config, path: configPath }
}

/**
 * Write CONFIG_TEMPLATE to `mint.config.mjs` in `cwd`. Refuses to overwrite any
 * existing config variant unless `force` is set.
 * @param {{ cwd?: string, force?: boolean }} [opts]
 * @returns {Promise<{ path: string }>}
 */
export async function scaffoldConfig({
  cwd = process.cwd(),
  force = false,
} = {}) {
  const existing = findConfigFile(cwd)
  if (existing && !force) {
    throw new Error(
      `${path.basename(existing)} already exists. Re-run with --force to overwrite it.`
    )
  }
  const target = path.join(cwd, DEFAULT_CONFIG_FILE)
  await fs.writeFile(target, CONFIG_TEMPLATE, 'utf8')
  return { path: target }
}

/**
 * Convert a glob pattern (`**`, `*`, `?`) to an anchored RegExp. `**` matches
 * across path separators (including zero leading segments); `*` and `?` stay
 * within a single segment.
 * @param {string} glob
 * @returns {RegExp}
 */
function globToRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*'
        i++
        if (glob[i + 1] === '/') i++ // let **/ match zero directories too
      } else {
        re += '[^/]*'
      }
    } else if (c === '?') {
      re += '[^/]'
    } else if ('.+^${}()|[]\\/'.includes(c)) {
      re += '\\' + c
    } else {
      re += c
    }
  }
  return new RegExp(`^${re}$`)
}

/**
 * Test a repo-relative path against a list of ignore globs. Paths are
 * normalized to posix separators before matching.
 * @param {string} relPath
 * @param {string[]} [patterns]
 * @returns {boolean}
 */
export function matchesIgnore(relPath, patterns = []) {
  if (!patterns || patterns.length === 0) return false
  const normalized = relPath.split('\\').join('/')
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized))
}

/**
 * Resolve audit options from CLI flags/positional args and config, with the
 * precedence: flag > config > built-in default.
 * @param {{ flags?: object, rest?: string[], config?: object }} [input]
 */
export function resolveAuditOptions({
  flags = {},
  rest = [],
  config = {},
} = {}) {
  return {
    dir: rest[0] ?? config.source,
    outFile: flags.out
      ? String(flags.out)
      : (config.tokens ?? DEFAULT_TOKENS_FILE),
    ignore: Array.isArray(config.ignore) ? config.ignore : [],
  }
}

/**
 * Resolve export options from CLI flags and config, with the precedence:
 * flag > config > built-in default. `defaultFilename` is the export target's
 * natural output filename (e.g. `tailwind.config.js`).
 * @param {{ flags?: object, config?: object, defaultFilename?: string }} [input]
 */
export function resolveExportOptions({
  flags = {},
  config = {},
  defaultFilename,
} = {}) {
  return {
    targetInput: flags.target ?? config.target,
    tokensPath: flags.tokens
      ? String(flags.tokens)
      : (config.tokens ?? DEFAULT_TOKENS_FILE),
    outPath: flags.out
      ? String(flags.out)
      : defaultFilename != null
        ? path.join(config.outDir ?? '.', defaultFilename)
        : undefined,
  }
}
