#!/usr/bin/env node
// Mint CLI — audit a CSS/SCSS directory and export clean design tokens.
// Requires Node 20+ for fs.promises.readdir({ recursive: true }) and global fetch.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  buildAuditPrompt,
  buildResolvePrompt,
  buildExportPrompt,
  EXPORT_OUTPUT,
  ADVERTISED_TARGETS,
  resolveTarget,
  callAnthropic,
  stripFences,
} from '../lib/prompts.mjs'

const VERSION = '0.1.0'
const SOURCE_EXTS = new Set(['.css', '.scss', '.sass', '.less', '.html', '.htm'])
const DEFAULT_TOKENS_FILE = 'mint.tokens.json'
const MAX_CSS_CHARS = 120_000

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
      dim: (s) => s, bold: (s) => s, cyan: (s) => s, green: (s) => s, yellow: (s) => s, red: (s) => s,
    }

function log(...args) { process.stderr.write(args.join(' ') + '\n') }
function die(msg, code = 1) { log(styles.red('✗ ' + msg)); process.exit(code) }

function printHelp() {
  process.stdout.write(`${styles.bold('mint')} — CSS audit & design system generator (v${VERSION})

${styles.bold('USAGE')}
  npx mint-ds <command> [options]

${styles.bold('COMMANDS')}
  audit <dir>                  Analyze CSS/SCSS files in <dir> and write ${DEFAULT_TOKENS_FILE}
  export --target <name>       Generate exports from ${DEFAULT_TOKENS_FILE}

${styles.bold('AUDIT OPTIONS')}
  --out <file>                 Tokens output path (default: ${DEFAULT_TOKENS_FILE})
  --report <file>              Also write the raw audit report to <file>
  --quiet                      Suppress chaos summary

${styles.bold('EXPORT OPTIONS')}
  --target <name>              Required. ${ADVERTISED_TARGETS.slice(0, 5).join(', ')},
                                 ${ADVERTISED_TARGETS.slice(5).join(', ')}
  --tokens <file>              Tokens input path (default: ${DEFAULT_TOKENS_FILE})
  --out <file>                 Override the generated filename
  --stdout                     Print to stdout instead of writing a file

${styles.bold('AUTH (any command)')}
  --api-key <value>            Anthropic API key (overrides ANTHROPIC_API_KEY env var)

${styles.bold('ENVIRONMENT')}
  ANTHROPIC_API_KEY            Required unless --api-key is passed.
                               Get a key at https://console.anthropic.com

${styles.bold('EXAMPLES')}
  npx mint-ds audit ./src/styles
  npx mint-ds export --target tailwind
  npx mint-ds export --target react --out ui/Components.tsx
  npx mint-ds export --target css --stdout > variables.css
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

const API_KEY_HELP =
  'ANTHROPIC_API_KEY is required. Set it in your environment or pass --api-key <value>.\n' +
  '  macOS/Linux:  export ANTHROPIC_API_KEY=sk-ant-...\n' +
  '  PowerShell:   $env:ANTHROPIC_API_KEY = "sk-ant-..."\n' +
  '  Windows CMD:  set ANTHROPIC_API_KEY=sk-ant-...\n' +
  '  Get a key at https://console.anthropic.com'

function resolveApiKey(flags) {
  const fromFlag = typeof flags['api-key'] === 'string' ? flags['api-key'] : null
  return fromFlag || process.env.ANTHROPIC_API_KEY || null
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
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (entry.isFile() && SOURCE_EXTS.has(path.extname(entry.name).toLowerCase())) {
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
      die(`Unsupported file type: ${target} (expected .css/.scss/.sass/.less/.html)`)
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
      log(styles.yellow(`! Reached ${MAX_CSS_CHARS} char budget — skipping remaining files (${files.length - files.indexOf(file)} left)`))
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
    fonts: (audit.fonts || []).filter((f) => !f.isSystemFont).map((f) => f.family),
    spacingScale: audit.spacing?.suggestedScale || {},
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
  if (!target) die('Usage: mint audit <directory>')

  const outFile = String(flags.out || DEFAULT_TOKENS_FILE)
  const reportFile = flags.report ? String(flags.report) : null
  const quiet = Boolean(flags.quiet)

  log(styles.cyan('→') + ` Reading sources from ${styles.bold(target)}…`)
  const { files, css } = await collectSources(target)
  log(styles.dim(`  ${files.length} file(s), ${(css.length / 1000).toFixed(1)}k chars`))

  const apiKey = resolveApiKey(flags)
  if (!apiKey) die(API_KEY_HELP)

  log(styles.cyan('→') + ' Auditing with Claude…')
  const auditText = await callAnthropic({ apiKey, prompt: buildAuditPrompt(css), maxTokens: 3000 })
  let audit
  try {
    audit = JSON.parse(stripFences(auditText))
  } catch {
    die('Could not parse audit JSON from Claude response')
  }

  if (reportFile) {
    await fs.writeFile(reportFile, JSON.stringify(audit, null, 2) + '\n', 'utf8')
    log(styles.dim(`  audit report → ${reportFile}`))
  }

  log(styles.cyan('→') + ' Resolving tokens…')
  const tokensText = await callAnthropic({
    apiKey,
    prompt: buildResolvePrompt(css, defaultDecisions(audit)),
    maxTokens: 4000,
  })
  let tokens
  try {
    tokens = JSON.parse(stripFences(tokensText))
  } catch {
    die('Could not parse tokens JSON from Claude response')
  }

  await fs.writeFile(outFile, JSON.stringify(tokens, null, 2) + '\n', 'utf8')

  if (!quiet) {
    log('')
    log(styles.bold(audit.brand || 'Audit') + styles.dim(`  ·  chaos ${chaosBadge(audit.chaosScore)}`))
    if (audit.summary) log(styles.dim('  ' + audit.summary))
    log(styles.dim(`  ${audit.colorClusters?.length ?? 0} clusters · ${audit.fonts?.length ?? 0} fonts · ${audit.spacing?.found?.length ?? 0} spacing values`))
    log('')
  }
  log(styles.green('✓') + ` Tokens written to ${styles.bold(outFile)}`)
  log(styles.dim(`  next: npx mint-ds export --target tailwind`))
}

async function cmdExport(argv) {
  const { flags } = parseFlags(argv)
  const targetInput = flags.target
  if (!targetInput || targetInput === true) die('Usage: mint export --target <name>  (e.g. tailwind, react, css)')

  const target = resolveTarget(String(targetInput))
  if (!target) {
    die(`Unknown --target "${targetInput}". Try one of: ${ADVERTISED_TARGETS.join(', ')}`)
  }

  const apiKey = resolveApiKey(flags)
  if (!apiKey) die(API_KEY_HELP)

  const tokensPath = String(flags.tokens || DEFAULT_TOKENS_FILE)
  const tokensRaw = await fs.readFile(tokensPath, 'utf8').catch(() => null)
  if (tokensRaw === null) {
    die(`Tokens file not found: ${tokensPath}\n  Run "mint audit <dir>" first, or pass --tokens <file>.`)
  }

  let tokens
  try {
    tokens = JSON.parse(tokensRaw)
  } catch {
    die(`Tokens file is not valid JSON: ${tokensPath}`)
  }

  log(styles.cyan('→') + ` Generating ${styles.bold(target)}…`)
  const code = stripFences(
    await callAnthropic({ apiKey, prompt: buildExportPrompt(tokens, target), maxTokens: 6000 })
  )

  if (flags.stdout) {
    process.stdout.write(code + '\n')
    return
  }

  const meta = EXPORT_OUTPUT[target]
  const outFile = flags.out
    ? String(flags.out)
    : `${meta.filename}.${meta.ext}`
  await fs.writeFile(outFile, code + '\n', 'utf8')
  log(styles.green('✓') + ` Wrote ${styles.bold(outFile)} (${(code.length / 1000).toFixed(1)}k chars)`)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    printHelp()
    return
  }
  if (argv[0] === '-v' || argv[0] === '--version') {
    process.stdout.write(`mint ${VERSION}\n`)
    return
  }

  const [cmd, ...rest] = argv
  try {
    if (cmd === 'audit') await cmdAudit(rest)
    else if (cmd === 'export') await cmdExport(rest)
    else { printHelp(); die(`Unknown command: ${cmd}`) }
  } catch (err) {
    die(err && err.message ? err.message : String(err))
  }
}

main()
