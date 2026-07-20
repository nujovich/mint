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
import { diffFiles } from '../lib/token-diff.mjs'
import { convertTokensToDTCG, serializeDTCG } from '../lib/dtcg-exporter.mjs'
import { convertTokensToDesignMd } from '../lib/design-md.mjs'
import { formatLintSummary } from '../lib/audit-summary.mjs'
import { checkCompat } from '../lib/css-compat-data.mjs'
import { lintCss, lintGapDecorationAdoption } from '../lib/css-lint-rules.mjs'
import { applyWsl2DnsWorkaround } from '../lib/net-utils.mjs'
import { buildTokenIndex } from '../lib/token-index.mjs'
import { applyCodemod } from '../lib/css-codemod.mjs'
import { getDirtyFiles } from '../lib/git-status.mjs'
import {
  DEFAULT_TOKENS_FILE,
  loadConfig,
  scaffoldConfig,
  matchesIgnore,
  resolveAuditOptions,
  resolveExportOptions,
} from '../lib/mint-config.mjs'
import {
  computeMetrics,
  buildHealthReport,
  renderHealthReport,
  DEFAULT_SEVERITY_THRESHOLDS,
} from '../lib/css-health-score.mjs'

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
  init                         Scaffold a mint.config.mjs with project defaults
  audit <dir>                  Analyze CSS/SCSS files in <dir> and write ${DEFAULT_TOKENS_FILE}
  export --target <name>       Generate exports from ${DEFAULT_TOKENS_FILE}
  validate <file> [options]    Validate tokens.json against a spec (e.g. dtcg)
  diff <old> <new>             Show changes between two token files
  cache --clear                Delete the local ${CACHE_FILE}
  apply <path>                 Rewrite source CSS to use generated token variables
  compat <dir>                 Scan CSS for Interop 2026 browser-compat issues (warnings + suggestions)
  lint <dir>                   Run static CSS lint rules on files in <dir>
  score <dir>                  Compute the CSS health score and per-metric breakdown
  score <dir> --json           Emit the structured report (status, exitCode) as JSON
  score <dir> --thresholds-warning <n>   Percentile below which a metric is a warning (0-100)
  score <dir> --thresholds-error <n>     Percentile below which a metric is an error (0-100)

${styles.bold('INIT OPTIONS')}
  --force                      Overwrite an existing mint.config.{mjs,js,cjs}

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

${styles.bold('APPLY OPTIONS')}
  --tokens <file>               Tokens file (default: ${DEFAULT_TOKENS_FILE})
  --target <name>               Codemod target (default: css-var; only value supported for now)
  --fuzzy                       Also snap near-duplicate/off-scale values
  --dry-run                     Print the diff without writing
  --force                       Skip the git-clean check

${styles.bold('VALIDATE OPTIONS')}
  --spec <name>                Spec to validate against (default: dtcg). Values: dtcg
  --json                       Output results as JSON
  --quiet                      Suppress non-error output
  --no-semantic                Skip semantic checks (refs, cycles, naming, type mismatch)

${styles.bold('DIFF OPTIONS')}
  --json                       Output the diff as JSON (for CI / PR bots)
                                 Exits non-zero on breaking changes (removed / value-changed)

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
  npx mint-ds init
  npx mint-ds audit ./src/styles
  npx mint-ds audit ./src/styles --provider openrouter
  npx mint-ds export --target tailwind
  npx mint-ds export --target react --out ui/Components.tsx
  npx mint-ds export --target css --stdout > variables.css
  npx mint-ds export --target design-md > DESIGN.md
  npx mint-ds validate tokens.json --spec dtcg
  npx mint-ds validate tokens.json --spec dtcg --json
  npx mint-ds diff old.tokens.json mint-ds.tokens.json
  npx mint-ds lint ./src/styles
  npx mint-ds score ./src/styles
  npx mint-ds score ./src/styles --json
  npx mint-ds apply ./src/styles --dry-run
  npx mint-ds apply ./src/styles
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

async function* walk(dir, root, ignore = []) {
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
    if (matchesIgnore(path.relative(root, full), ignore)) continue
    if (entry.isDirectory()) {
      yield* walk(full, root, ignore)
    } else if (
      entry.isFile() &&
      SOURCE_EXTS.has(path.extname(entry.name).toLowerCase())
    ) {
      yield full
    }
  }
}

async function collectSources(target, ignore = []) {
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
    for await (const file of walk(root, root, ignore)) files.push(file)
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
  const { config } = await loadConfig(process.cwd())
  const {
    dir: target,
    outFile,
    ignore,
  } = resolveAuditOptions({
    flags,
    rest,
    config,
  })
  if (!target) die('Usage: mint-ds audit <directory>')

  const reportFile = flags.report ? String(flags.report) : null
  const quiet = Boolean(flags.quiet)
  const noCache = Boolean(flags['no-cache'])

  log(styles.cyan('→') + ` Reading sources from ${styles.bold(target)}…`)
  const { files, css } = await collectSources(target, ignore)
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

async function cmdCompat(argv) {
  const { flags, rest } = parseFlags(argv)
  const target = rest[0]
  if (!target) die('Usage: mint-ds compat <directory>')

  const quiet = Boolean(flags.quiet)
  const projectDir = flags['project-dir']
    ? String(flags['project-dir'])
    : process.cwd()

  log(
    styles.cyan('→') +
      ` Scanning ${styles.bold(target)} for Interop 2026 adoption issues…`
  )
  const { files, css } = await collectSources(target)
  log(
    styles.dim(
      `  ${files.length} file(s), ${(css.length / 1000).toFixed(1)}k chars`
    )
  )

  const { findings } = checkCompat(css, { projectDir })
  if (findings.length === 0) {
    log('')
    log(
      styles.green('✓') +
        ' No browser-compat issues found (all used properties are Baseline or supported by the target browsers).'
    )
    return
  }

  // Sort: warnings (not-supported) first, then info (experimental).
  const order = { warning: 0, info: 1 }
  findings.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))

  let warnCount = 0
  let infoCount = 0
  for (const f of findings) {
    const sevColor = f.severity === 'warning' ? styles.yellow : styles.cyan
    const tag = f.severity === 'warning' ? 'WARNING' : 'INFO'
    if (f.severity === 'warning') warnCount++
    else infoCount++

    log('')
    log(sevColor('[' + tag + ']') + ' ' + styles.bold(f.property))
    log('  ' + f.message)
    if (f.feature) log(styles.dim('  feature: ' + f.feature))
    if (typeof f.interop === 'number') {
      log(styles.dim('  interop 2026: ' + f.interop + '%'))
    }
    log('  → ' + f.suggestion)
  }

  log('')
  log(
    styles.bold('Summary:') +
      ` ${warnCount} warning(s), ${infoCount} info(s) across ${files.length} file(s).`
  )
  if (!quiet) {
    log(
      styles.dim(
        '  Tip: add @supports fallbacks or a polyfill for unsupported features before shipping.'
      )
    )
  }
}

async function cmdInit(argv) {
  const { flags } = parseFlags(argv)
  const { path: written } = await scaffoldConfig({
    cwd: process.cwd(),
    force: Boolean(flags.force),
  })
  const rel = path.relative(process.cwd(), written) || written
  log(styles.green('✓') + ` Created ${styles.bold(rel)}`)
  log(styles.dim('  next: npx mint-ds audit ./src/styles'))
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

async function cmdLint(argv) {
  const { rest } = parseFlags(argv)
  const target = rest[0]
  if (!target) die('Usage: mint-ds lint <directory>')

  log(styles.cyan('→') + ` Linting sources from ${styles.bold(target)}…`)
  const { files, css } = await collectSources(target)
  log(
    styles.dim(
      `  ${files.length} file(s), ${(css.length / 1000).toFixed(1)}k chars`
    )
  )

  const result = lintCss(css)
  const { findings } = result

  if (findings.length === 0) {
    log(styles.green('✓') + ' No lint issues found.')
  } else {
    log('')
    log(styles.bold(`Found ${findings.length} issue(s):`))
    log('')

    for (const finding of findings) {
      const badge =
        finding.severity === 'warning'
          ? styles.yellow('WARN')
          : styles.dim('INFO')
      log(`  ${badge}  ${finding.selector}`)
      log(styles.dim(`       ${finding.message}`))
      log('')
    }
  }

  // Modern CSS Opportunities: adoption report for gap decorations.
  const { adoption } = lintGapDecorationAdoption(css, {
    stylesheetCount: files.length,
  })
  if (adoption.hacksTotal > 0) {
    log('')
    log(styles.bold('Modern CSS Opportunities'))
    log(
      styles.dim(
        `  ${adoption.stylesheetsWithHacks}/${adoption.stylesheetsScanned} stylesheet(s) use gap-decoration hacks`
      )
    )
    log(
      styles.dim(
        `  ${adoption.hacksTotal} hack(s) could be replaced by native gap-rule-* (Chrome 149+, Firefox 132+)`
      )
    )
    for (const [pattern, count] of Object.entries(adoption.byPattern)) {
      log(styles.dim(`    - ${pattern}: ${count}`))
    }
    log('')
  }
}

async function cmdExport(argv) {
  const { flags } = parseFlags(argv)
  const { config } = await loadConfig(process.cwd())
  const { targetInput, tokensPath } = resolveExportOptions({ flags, config })
  if (!targetInput || targetInput === true)
    die('Usage: mint-ds export --target <name>  (e.g. tailwind, react, css)')

  const target = resolveTarget(String(targetInput))
  if (!target) {
    die(
      `Unknown --target "${targetInput}". Try one of: ${ADVERTISED_TARGETS.join(', ')}`
    )
  }

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

  let code

  if (target === 'dtcg') {
    // Deterministic conversion — no LLM
    const dtcg = convertTokensToDTCG(tokens)
    code = serializeDTCG(dtcg)
  } else if (target === 'design-md') {
    // Deterministic conversion — no LLM
    code = convertTokensToDesignMd(tokens)
  } else {
    const cssAuditor = getCssAuditor(flags)
    code = await cssAuditor.export(buildExportPrompt(tokens, target))
  }

  if (flags.stdout) {
    process.stdout.write(code + '\n')
    return
  }

  const meta = EXPORT_OUTPUT[target]
  const defaultFilename = `${meta.filename}.${meta.ext}`
  const { outPath } = resolveExportOptions({ flags, config, defaultFilename })
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, code + '\n', 'utf8')
  log(
    styles.green('✓') +
      ` Wrote ${styles.bold(outPath)} (${(code.length / 1000).toFixed(1)}k chars)`
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

async function cmdDiff(argv) {
  const { flags, rest } = parseFlags(argv)
  const oldPath = rest[0]
  const newPath = rest[1]
  if (!oldPath || !newPath) {
    die('Usage: mint-ds diff <old.tokens.json> <new.tokens.json> [--json]')
  }

  const asJson = Boolean(flags.json)

  let diff
  try {
    diff = await diffFiles(oldPath, newPath)
  } catch (err) {
    die(err && err.message ? err.message : String(err))
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(diff.toJSON(), null, 2) + '\n')
  } else {
    log(
      styles.cyan('→') +
        ` Diffing ${styles.bold(oldPath)} → ${styles.bold(newPath)}…`
    )
    log('')
    log(diff.print())
  }

  // Exit non-zero when breaking changes (removed / value-changed) are present.
  process.exit(diff.exitCode)
}

async function cmdScore(argv) {
  const { flags, rest } = parseFlags(argv)
  const target = rest[0]
  if (!target) die('Usage: mint-ds score <directory-or-file>')

  // Optional severity-threshold overrides (Milestone 5). Both flags accept a
  // 0-100 percentile; only the provided one(s) override the defaults.
  const thresholds = { ...DEFAULT_SEVERITY_THRESHOLDS }
  if (flags['thresholds-error'] != null) {
    const v = Number(flags['thresholds-error'])
    if (Number.isNaN(v)) die('--thresholds-error must be a number (0-100)')
    thresholds.error = v
  }
  if (flags['thresholds-warning'] != null) {
    const v = Number(flags['thresholds-warning'])
    if (Number.isNaN(v)) die('--thresholds-warning must be a number (0-100)')
    thresholds.warning = v
  }
  if (thresholds.error > thresholds.warning) {
    die('--thresholds-error must be <= --thresholds-warning')
  }

  log(styles.cyan('→') + ` Reading sources from ${styles.bold(target)}…`)
  const { files, css } = await collectSources(target)
  log(
    styles.dim(
      `  ${files.length} file(s), ${(css.length / 1000).toFixed(1)}k chars`
    )
  )

  const metrics = computeMetrics(css)

  if (flags.json) {
    const report = buildHealthReport(metrics, thresholds)
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
    if (report.exitCode) process.exit(report.exitCode)
    return
  }

  log('')
  log(renderHealthReport(metrics, thresholds))
  // Surface the computed status as a CLI exit code: 0 ok, 1 warning, 2 error.
  const report = buildHealthReport(metrics, thresholds)
  if (report.exitCode) process.exit(report.exitCode)
}

// Walk `target` (file or directory) for source files, reusing the same walk
// used by `collectSources` but returning individual file paths rather than a
// combined CSS blob — `apply` rewrites each file separately.
async function collectSourceFiles(target, ignore = []) {
  const root = path.resolve(target)
  const stat = await fs.stat(root).catch(() => null)
  if (!stat) die(`Path not found: ${target}`)

  if (stat.isFile()) {
    if (!SOURCE_EXTS.has(path.extname(root).toLowerCase())) {
      die(
        `Unsupported file type: ${target} (expected .css/.scss/.sass/.less/.html)`
      )
    }
    // apply writes to disk — respect the ignore list even for an explicit file
    if (matchesIgnore(path.relative(process.cwd(), root), ignore)) return []
    return [root]
  }

  const files = []
  for await (const file of walk(root, root, ignore)) files.push(file)
  return files
}

async function cmdApply(argv) {
  const { flags, rest } = parseFlags(argv)
  const target = rest[0] || '.'

  const targetFormat = flags.target ? String(flags.target) : 'css-var'
  if (targetFormat !== 'css-var') {
    die(
      `Unsupported --target "${targetFormat}". Slice 1 supports only "css-var".`
    )
  }

  const { config } = await loadConfig(process.cwd())
  const { ignore } = resolveAuditOptions({ config })
  const tokensPath = flags.tokens
    ? String(flags.tokens)
    : (config.tokens ?? DEFAULT_TOKENS_FILE)

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
  const index = buildTokenIndex(tokens)

  log(styles.cyan('→') + ` Reading sources from ${styles.bold(target)}…`)
  const files = await collectSourceFiles(target, ignore)
  if (files.length === 0) {
    process.stdout.write('No source files found.\n')
    return
  }

  const fuzzy = Boolean(flags.fuzzy)
  const dryRun = Boolean(flags['dry-run'])
  const force = Boolean(flags.force)

  const results = []
  for (const abs of files) {
    const src = await fs.readFile(abs, 'utf8')
    const { output, edits } = applyCodemod(src, index, { fuzzy })
    if (edits.length > 0) results.push({ abs, output, edits })
  }

  if (results.length === 0) {
    process.stdout.write('No substitutions to make.\n')
    return
  }

  if (dryRun) {
    for (const r of results) {
      process.stdout.write(`\n--- ${path.relative(process.cwd(), r.abs)}\n`)
      for (const e of r.edits) {
        process.stdout.write(`  ${e.from}  ->  ${e.to}\n`)
      }
    }
    const total = results.reduce((n, r) => n + r.edits.length, 0)
    process.stdout.write(
      `\n${total} substitution(s) in ${results.length} file(s) (dry run).\n`
    )
    return
  }

  if (!force) {
    const rel = results.map((r) => path.relative(process.cwd(), r.abs))
    let status
    try {
      status = getDirtyFiles(rel, process.cwd())
    } catch (err) {
      die(
        `Could not verify git status (${String(err.message).split('\n')[0]}); commit your changes or pass --force.`
      )
    }
    if (!status.isRepo) {
      die(
        'Not a git repository — cannot verify a clean tree. Re-run with --force to proceed.'
      )
    }
    if (status.dirty.length > 0) {
      die(
        `${status.dirty.length} file(s) have uncommitted changes; commit them or pass --force:\n  ` +
          status.dirty.join('\n  ')
      )
    }
  }

  let total = 0
  let lossy = 0
  for (const r of results) {
    await fs.writeFile(r.abs, r.output, 'utf8')
    total += r.edits.length
    lossy += r.edits.filter((e) => e.lossy).length
  }
  process.stdout.write(
    `Rewrote ${results.length} file(s), ${total} substitution(s)` +
      (lossy > 0 ? ` (${lossy} lossy)` : '') +
      '.\n'
  )
}

async function main() {
  // Mitigate WSL2 IPv6 fetch hangs to remote LLM APIs (issue #19).
  applyWsl2DnsWorkaround()
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
    if (cmd === 'init') await cmdInit(rest)
    else if (cmd === 'audit') await cmdAudit(rest)
    else if (cmd === 'export') await cmdExport(rest)
    else if (cmd === 'validate') await cmdValidate(rest)
    else if (cmd === 'diff') await cmdDiff(rest)
    else if (cmd === 'cache') await cmdCache(rest)
    else if (cmd === 'compat') await cmdCompat(rest)
    else if (cmd === 'lint') await cmdLint(rest)
    else if (cmd === 'score') await cmdScore(rest)
    else if (cmd === 'apply') await cmdApply(rest)
    else {
      printHelp()
      die(`Unknown command: ${cmd}`)
    }
  } catch (err) {
    die(err && err.message ? err.message : String(err))
  }
}

main()
