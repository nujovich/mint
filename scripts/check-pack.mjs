#!/usr/bin/env node
/**
 * check-pack — guardrail against the "lib file left out of package.json `files`"
 * publish bug (see #79, #89).
 *
 * Walks the static import graph from every `bin` entry, collecting the local
 * modules the CLI needs at runtime, then compares that against the files npm
 * would actually publish (`npm pack --dry-run`). Any reachable local file that
 * would NOT ship fails the check with a non-zero exit code.
 *
 * Run via `npm run check:pack` (also wired into `prepublishOnly` and CI).
 */

import { promises as fs } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const SOURCE_EXTS = new Set(['.mjs', '.js', '.cjs', '.ts', '.tsx', '.jsx'])
// Extension candidates tried when a relative specifier has no usable extension.
const RESOLVE_EXTS = ['.mjs', '.js', '.cjs', '.ts', '.tsx', '.jsx', '.json']

/**
 * Extract relative module specifiers (starting with '.') from source code.
 * Covers `import ... from`, side-effect `import`, `export ... from`,
 * `require(...)`, and dynamic `import(...)`. Bare specifiers (npm packages,
 * `node:` builtins) are ignored.
 * @param {string} source
 * @returns {string[]} unique relative specifiers, in first-seen order
 */
export function parseLocalDeps(source) {
  const patterns = [
    /(?:^|[^.\w])(?:import|export)\s[^;'"]*?\sfrom\s*['"]([^'"]+)['"]/g,
    /(?:^|[^.\w])import\s*['"]([^'"]+)['"]/g,
    /(?:^|[^.\w])import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /(?:^|[^.\w])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  const found = []
  const seen = new Set()
  for (const re of patterns) {
    let match
    while ((match = re.exec(source)) !== null) {
      const spec = match[1]
      if (spec.startsWith('.') && !seen.has(spec)) {
        seen.add(spec)
        found.push(spec)
      }
    }
  }
  return found
}

async function fileExists(p) {
  try {
    const stat = await fs.stat(p)
    return stat.isFile()
  } catch {
    return false
  }
}

/**
 * Resolve a relative specifier from an importer file to an existing file path,
 * or null if it does not resolve. Tries the literal path, common extensions,
 * and `<spec>/index.*`.
 */
async function resolveLocalSpecifier(importerFile, spec) {
  const base = path.resolve(path.dirname(importerFile), spec)
  if (await fileExists(base)) return base
  for (const ext of RESOLVE_EXTS) {
    if (await fileExists(base + ext)) return base + ext
  }
  for (const ext of RESOLVE_EXTS) {
    const indexed = path.join(base, 'index' + ext)
    if (await fileExists(indexed)) return indexed
  }
  return null
}

function toPosixRelative(repoRoot, absPath) {
  return path.relative(repoRoot, absPath).split(path.sep).join('/')
}

/**
 * Breadth-first walk of the import graph starting at `entryFile`. Returns the
 * set of repo-relative (posix) paths of every local file reachable from the
 * entry, including the entry itself. Relative specifiers that do not resolve to
 * an existing file, and files outside `repoRoot`, are skipped.
 * @param {string} entryFile absolute path to the entry module
 * @param {string} repoRoot absolute path to the repo root
 * @returns {Promise<Set<string>>}
 */
export async function collectReachableFiles(entryFile, repoRoot) {
  const reachable = new Set()
  const visited = new Set()
  const queue = [path.resolve(entryFile)]

  while (queue.length > 0) {
    const current = queue.shift()
    if (visited.has(current)) continue
    visited.add(current)

    const rel = toPosixRelative(repoRoot, current)
    if (rel.startsWith('..')) continue // outside the repo — ignore
    reachable.add(rel)

    if (!SOURCE_EXTS.has(path.extname(current))) continue // e.g. .json — no deps to parse

    let source
    try {
      source = await fs.readFile(current, 'utf8')
    } catch {
      continue
    }

    for (const spec of parseLocalDeps(source)) {
      const resolved = await resolveLocalSpecifier(current, spec)
      if (resolved && !visited.has(resolved)) queue.push(resolved)
    }
  }

  return reachable
}

/** Read the `bin` entry paths (absolute) from package.json. */
async function getBinEntries(repoRoot) {
  const pkg = JSON.parse(
    await fs.readFile(path.join(repoRoot, 'package.json'), 'utf8')
  )
  const bin = pkg.bin
  const entries =
    typeof bin === 'string'
      ? [bin]
      : bin && typeof bin === 'object'
        ? Object.values(bin)
        : []
  return entries.map((e) => path.resolve(repoRoot, e))
}

/** The set of repo-relative (posix) paths npm would publish. */
function getPackedFiles(repoRoot) {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const parsed = JSON.parse(out)
  const files = parsed?.[0]?.files ?? []
  return new Set(files.map((f) => f.path.split(path.sep).join('/')))
}

/**
 * Verify every local file reachable from the bin entries would be published.
 * @returns {Promise<{ ok: boolean, missing: string[], reachable: string[] }>}
 */
export async function verifyPackCompleteness(repoRoot = process.cwd()) {
  const entries = await getBinEntries(repoRoot)
  const reachable = new Set()
  for (const entry of entries) {
    for (const f of await collectReachableFiles(entry, repoRoot)) {
      reachable.add(f)
    }
  }
  const packed = getPackedFiles(repoRoot)
  const missing = [...reachable].filter((f) => !packed.has(f)).sort()
  return { ok: missing.length === 0, missing, reachable: [...reachable].sort() }
}

async function main() {
  const repoRoot = process.cwd()
  let result
  try {
    result = await verifyPackCompleteness(repoRoot)
  } catch (err) {
    console.error(`✗ check-pack failed to run: ${err.message}`)
    process.exit(2)
  }

  if (result.ok) {
    console.log(
      `✓ check-pack: all ${result.reachable.length} file(s) reachable from bin are in the published tarball`
    )
    process.exit(0)
  }

  console.error(
    `✗ check-pack: ${result.missing.length} file(s) imported by the CLI are missing from package.json "files":`
  )
  for (const f of result.missing) console.error(`    - ${f}`)
  console.error(
    '\n  Add them to the "files" allowlist so they ship in the npm tarball.'
  )
  process.exit(1)
}

// Run only when executed directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
