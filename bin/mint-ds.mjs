#!/usr/bin/env node
// Mint CLI — audit a CSS/SCSS directory and export clean design tokens.
// Requires Node 20+ for fs.promises.readdir({ recursive: true }) and global fetch.

import { promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import {
  buildAuditPrompt,
  buildResolvePrompt,
  buildExportPrompt,
  preprocessCss,
  EXPORT_OUTPUT,
  ADVERTISED_TARGETS,
  resolveTarget,
} from '../lib/prompts.mjs'
import { getCssAuditor } from '../lib/css-auditor.mjs'
import { validateFile } from '../lib/dtcg-validator.mjs'
import { formatLintSummary } from '../lib/audit-summary.mjs'

const require = createRequire(import.meta.url)
const { version: VERSION } = require('../package.json')
const SOURCE_EXTS = new Set([
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.html',
  '.htm',
])
const DEFAULT_TOKENS_FILE = 'mint-ds.tokens.json'
const CACHE_FILE = 'mint-ds.cache.json'
const MAX_CSS_CHARS = 120_000

function hashCss(css) {
  return createHash('sha256').update(css).digest('hex')
}

async function readCache() {
  try {
    return JSON.parse(await fs.readFile(CACHE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

async function writeCache(cache) {
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n', 'utf8')
}

const styles = process.stdout.isTTY
  ? {
      dim: (s) => `\x1b[2m${s}\x1b[0m`,
      bold: (s) => `\x1b[1m${s}\x1b[0m`,
      cyan: (s) => `\x1b[36m${s}\x1b[0m`,
      green: (s) => `\x1b[32m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
      red: (s) => `\x1b[31m${s}\x1b[0m`,
    }
  : {
      dim: (s) => s,
      bold: (s) => s,
      cyan: (s) => s,
      green: (s) => s,
      yellow: (s) => s,
      red: (s) => s,
    }

function log(...args) {
  process.stderr.write(args.join(' ') + '\n')
}
function die(msg, code = 1) {
  log(styles.red('✗ ' + msg))
  process.exit(code)
}

function printHelp() {
  process.stdout
    .write(`${styles.bold('mint-ds')} — CSS audit & design system generator (v${VERSION})

${styles.bold('USAGE')}
  npx mint-ds <command> [options]

${styles.bold('COMMANDS')}
  audit <dir>                  Analyze CSS/SCSS files in <dir> and write ${DEFAULT_TOKENS_FILE}
  export --target <name>       Generate exports from ${DEFAULT_TOKENS_FILE}
  validate <file> [options]    Validate tokens.json against a spec (e.g. dtcg)
  cache --clear                Delete the local ${CACHE_FILE}

${styles.bold('AUDIT OPTIONS')}
  --out <file>                 Tokens output path (default: ${DEFAULT_TOKENS_FILE})
  --report <file>              Also write the raw audit report to <file>
  --quiet                      Suppress chaos summary
  --no-cache                   Skip cache lookup and overwrite any existing entry

${styles.bold('EXPORT OPTIONS')}
  --target <name>              Required. ${ADVERTISED_TARGETS.slice(0, 5).join(', ')},
                                 ${ADVERTISED_TARGETS.slice(5).join(', ')}
  --tokens <file>              Tokens input path (default: ${DEFAULT_TOKENS_FILE})
  --out <file>                 Override the generated filename
  --stdout                     Print to stdout instead of writing a file

${styles.bold('VALIDATE OPTIONS')}
  --spec <name>                Spec to validate against (default: dtcg). Values: dtcg
  --json                       Output results as JSON
  --quiet                      Suppress non-error output
  --no-semantic                Skip semantic checks (refs, cycles, naming, type mismatch)

${styles.bold('AUTH (any command)')}
  --api-key <value>            LLM provider API key (overrides API_KEY env var)

${styles.bold('PROVIDER')}
  --provider <name>            LLM backend (default: anthropic)
                                 anthropic  — Claude API (default)
                                 ollama     — Local Ollama (no key required)
                                 openrouter — OpenRouter API
  --model <name>               Model name (overrides LLM_MODEL_NAME env var)
  --url <url>                  API endpoint URL (overrides LLM_API_URL env var)

${styles.bold('ENVIRONMENT')}
  API_KEY            LLM provider API key (universal fallback)
                       Anthropic:  https://console.anthropic.com
                       OpenRouter: https://openrouter.ai/keys
  LLM_MODEL_NAME     Model name (universal fallback)
  LLM_API_URL        API endpoint URL (universal fallback)

  Per-provider overrides (take priority over the generic vars):
    API key          ANTHROPIC_API_KEY, OPENROUTER_API_KEY, OLLAMA_API_KEY
    Model            ANTHROPIC_MODEL_NAME, OPENROUTER_MODEL_NAME, OLLAMA_MODEL_NAME
    URL              ANTHROPIC_API_URL, OPENROUTER_API_URL, OLLAMA_API_URL

  Precedence: --flag > {PROVIDER}_ENV > generic env > provider default

${styles.bold('EXAMPLES')}
  npx mint-ds audit ./src/styles
  npx mint-ds audit ./src/styles --provider openrouter
  npx mint-ds export --target tailwind
  npx mint-ds export --target react --out ui/Components.tsx
  npx mint-ds export --target css --stdout > variables.css
  npx mint-ds validate tokens.json --spec dtcg
  npx mint-ds validate tokens.json --spec dtcg --json
`)
}

function parseFlags(argv) {
  const flags = {}
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      rest.push(a)
    }
  }
  return { flags, rest }
}

async function* walk(dir) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (err.code === 'ENOTDIR') {
      yield dir
      return
    }
    throw err
  }
  for (const entry of entries) {
    if (
      entry.name.startsWith('.') ||
      entry.name === 'node_modules' ||
      entry.name === 'dist'
    )
      continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (
      entry.isFile() &&
      SOURCE_EXTS.has(path.extname(entry.name).toLowerCase())
    ) {
      yield full
    }
  }
}

async function collectSources(target) {
  const root = path.resolve(target)
  const stat = await fs.stat(root).catch(() => null)
  if (!stat) die(`Path not found: ${target}`)

  const files = []
  if (stat.isFile()) {
    if (!SOURCE_EXTS.has(path.extname(root).toLowerCase())) {
      die(
        `Unsupported file type: ${target} (expected .css/.scss/.sass/.less/.html)`
      )
    }
    files.push(root)
  } else {
    for await (const file of walk(root)) files.push(file)
  }

  if (files.length === 0) die(`No CSS/SCSS/HTML files found in ${target}`)

  const cwd = process.cwd()
  let combined = ''
  for (const file of files) {
    const rel = path.relative(cwd, file)
    const body = await fs.readFile(file, 'utf8')
    const chunk = `/* === ${rel} === */\n${body}\n\n`
    if (combined.length + chunk.length > MAX_CSS_CHARS) {
      log(
        styles.yellow(
          `! Reached ${MAX_CSS_CHARS} char budget — skipping remaining files (${files.length - files.indexOf(file)} left)`
        )
      )
      break
    }
    combined += chunk
  }
  return { files, css: combined }
}

function defaultDecisions(audit) {
  return {
    colors: (audit.colorClusters || []).map((c) => ({
      clusterId: c.id,
      name: c.suggestedName || 'color',
      value: c.representative,
      include: true,
    })),
    fonts: (audit.fonts || [])
      .filter((f) => !f.isSystemFont)
      .map((f) => f.family),
    spacingScale: audit.spacing?.suggestedScale || {},
    lineHeights: audit.lineHeights?.suggestedScale || {},
    motion: {
      durations: audit.motion?.durations?.suggestedScale || {},
      easings: audit.motion?.easings?.suggestedScale || {},
    },
  }
}

function chaosBadge(score) {
  if (score <= 3) return styles.green(`${score}/10`)
  if (score <= 6) return styles.yellow(`${score}/10`)
  return styles.red(`${score}/10`)
}

async function cmdAudit(argv) {
  const { flags, rest } = parseFlags(argv)
  const target = rest[0]
  if (!target) die('Usage: mint-ds audit <directory>')

  const outFile = String(flags.out || DEFAULT_TOKENS_FILE)
  const reportFile = flags.report ? String(flags.report) : null
  const quiet = Boolean(flags.quiet)
  const noCache = Boolean(flags['no-cache'])

  log(styles.cyan('→') + ` Reading sources from ${styles.bold(target)}…`)
  const { files, css } = await collectSources(target)
  log(
    styles.dim(
      `  ${files.length} file(s), ${(css.length / 1000).toFixed(1)}k chars`
    )
  )

  const processedCss = preprocessCss(css)
  const cssHash = hashCss(processedCss)

  if (!noCache) {
    const cache = await readCache()
    if (cache[cssHash]) {
      const { tokens } = cache[cssHash]
      await fs.writeFile(
        outFile,
        JSON.stringify(tokens, null, 2) + '\n',
        'utf8'
      )
      log(styles.dim(`  cache hit (${cssHash.slice(0, 8)}…)`))
      log(
        styles.green('✓') +
          ` Tokens written to ${styles.bold(outFile)} (from cache)`
      )
      log(styles.dim(`  next: npx mint-ds export --target tailwind`))
      return
    }
  }

  const cssAuditor = getCssAuditor(flags)
  log(styles.cyan('→') + ' Auditing CSS...')
  const audit = await cssAuditor.audit(buildAuditPrompt(css))

  if (reportFile) {
    await fs.writeFile(
      reportFile,
      JSON.stringify(audit, null, 2) + '\n',
      'utf8'
    )
    log(styles.dim(`  audit report → ${reportFile}`))
  }

  log(styles.cyan('→') + ' Processing results...')
  let tokens
  try {
    tokens = await cssAuditor.parse(
      buildResolvePrompt(css, defaultDecisions(audit))
    )
  } catch {
    die('Error parsing response')
  }

  if (!noCache) {
    const cache = await readCache()
    cache[cssHash] = { tokens, savedAt: new Date().toISOString() }
    await writeCache(cache)
  }

  await fs.writeFile(outFile, JSON.stringify(tokens, null, 2) + '\n', 'utf8')

  if (!quiet) {
    log('')
    log(
      styles.bold(audit.brand || 'Audit') +
        styles.dim(`  ·  chaos ${chaosBadge(audit.chaosScore)}`)
    )
    if (audit.summary) log(styles.dim('  ' + audit.summary))
    log(
      styles.dim(
        `  ${audit.colorClusters?.length ?? 0} clusters · ${audit.fonts?.length ?? 0} fonts · ${audit.spacing?.found?.length ?? 0} spacing values · ${audit.motion?.durations?.found?.length ?? 0} motion durations`
      )
    )
    const lintSummary = formatLintSummary(audit)
    if (lintSummary) log(styles.dim(`  ${lintSummary}`))
    log('')
  }
  log(styles.green('✓') + ` Tokens written to ${styles.bold(outFile)}`)
  log(styles.dim(`  next: npx mint-ds export --target tailwind`))
}

async function cmdCache(argv) {
  const { flags } = parseFlags(argv)
  if (flags.clear) {
    await fs.unlink(CACHE_FILE).catch(() => {})
    log(styles.green('✓') + ` Cache cleared (${CACHE_FILE})`)
  } else {
    const cache = await readCache()
    const entries = Object.keys(cache)
    if (entries.length === 0) {
      log(styles.dim('Cache is empty.'))
    } else {
      log(styles.bold(`${entries.length} cached audit(s):`))
      for (const hash of entries) {
        log(
          styles.dim(
            `  ${hash.slice(0, 8)}…  saved ${cache[hash].savedAt ?? 'unknown'}`
          )
        )
      }
    }
  }
}

async function cmdExport(argv) {
  const { flags } = parseFlags(argv)
  const targetInput = flags.target
  if (!targetInput || targetInput === true)
    die('Usage: mint-ds export --target <name>  (e.g. tailwind, react, css)')

  const target = resolveTarget(String(targetInput))
  if (!target) {
    die(
      `Unknown --target "${targetInput}". Try one of: ${ADVERTISED_TARGETS.join(', ')}`
    )
  }

  const tokensPath = String(flags.tokens || DEFAULT_TOKENS_FILE)
  const tokensRaw = await fs.readFile(tokensPath, 'utf8').catch(() => null)
  if (tokensRaw === null) {
    die(
      `Tokens file not found: ${tokensPath}\n  Run "mint-ds audit <dir>" first, or pass --tokens <file>.`
    )
  }

  let tokens
  try {
    tokens = JSON.parse(tokensRaw)
  } catch {
    die(`Tokens file is not valid JSON: ${tokensPath}`)
  }

  log(styles.cyan('→') + ` Generating ${styles.bold(target)}…`)
  const cssAuditor = getCssAuditor(flags)
  const code = await cssAuditor.export(buildExportPrompt(tokens, target))

  if (flags.stdout) {
    process.stdout.write(code + '\n')
    return
  }

  const meta = EXPORT_OUTPUT[target]
  const outFile = flags.out ? String(flags.out) : `${meta.filename}.${meta.ext}`
  await fs.writeFile(outFile, code + '\n', 'utf8')
  log(
    styles.green('✓') +
      ` Wrote ${styles.bold(outFile)} (${(code.length / 1000).toFixed(1)}k chars)`
  )
}

async function cmdValidate(argv) {
  const { flags, rest } = parseFlags(argv)
  const file = rest[0]
  if (!file)
    die(
      'Usage: mint-ds validate <tokens.json> [--spec dtcg] [--json] [--quiet]'
    )

  const spec = String(flags.spec || 'dtcg').toLowerCase()
  if (spec !== 'dtcg') {
    die(`Unknown spec "${spec}". Supported: dtcg`)
  }

  const asJson = Boolean(flags.json)
  const quiet = Boolean(flags.quiet)

  log(
    styles.cyan('→') +
      ` Validating ${styles.bold(file)} against ${styles.bold(spec.toUpperCase())} v1…`
  )

  const result = await validateFile(file, {
    semantic: flags['no-semantic'] !== true,
  })

  if (asJson) {
    process.stdout.write(JSON.stringify(result.toJSON(), null, 2) + '\n')
  } else if (!quiet) {
    const output = result.print(true, false)
    log(output)
  }

  // Exit with appropriate code: 0 = ok, 1 = warnings, 2 = errors
  process.exit(result.exitCode)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    printHelp()
    return
  }
  if (argv[0] === '-v' || argv[0] === '--version') {
    process.stdout.write(`mint-ds ${VERSION}\n`)
    return
  }

  const [cmd, ...rest] = argv
  try {
    if (cmd === 'audit') await cmdAudit(rest)
    else if (cmd === 'export') await cmdExport(rest)
    else if (cmd === 'validate') await cmdValidate(rest)
    else if (cmd === 'cache') await cmdCache(rest)
    else {
      printHelp()
      die(`Unknown command: ${cmd}`)
    }
  } catch (err) {
    die(err && err.message ? err.message : String(err))
  }
}

main()
