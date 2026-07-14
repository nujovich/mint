// Zero-dependency bundler for the Penpot plugin sandbox file.
//
//   node penpot-plugin/build-plugin.mjs   # regenerates penpot-plugin/plugin.js
//
// Penpot evaluates the plugin `code` file as a plain script (no ES module
// `import`/`export`). This concatenates the pure, unit-tested writer with the
// sandbox glue into a single self-contained `plugin.js`, stripping the module
// syntax that ties the sources together. No runtime/dev dependencies.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { argv } from 'node:process'

// Concatenation order matters only for readability — `importSets` is a hoisted
// function declaration, so the glue can reference it regardless.
const SOURCES = ['src/import-into-catalog.mjs', 'src/plugin.glue.mjs']

const HEADER = `/* eslint-disable */
// GENERATED FILE — DO NOT EDIT.
// Built from ${SOURCES.join(' + ')} by build-plugin.mjs (npm run build:plugin).
// Penpot evaluates this as a plain script, so it must stay free of import/export.
`

// Drop the internal `import ... from '...'` lines that wire the sources
// together, and unexport declarations so they become plain top-level bindings.
function stripModuleSyntax(source) {
  return source
    .split('\n')
    .filter((line) => !/^\s*import\s.+\sfrom\s.+$/.test(line))
    .join('\n')
    .replace(/^export\s+/gm, '')
    .trim()
}

export function buildPlugin() {
  const parts = SOURCES.map((rel) =>
    stripModuleSyntax(
      readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
    )
  )
  return `${HEADER}\n${parts.join('\n\n')}\n`
}

// CLI: write the bundle to plugin.js when run directly.
if (fileURLToPath(import.meta.url) === argv[1]) {
  const out = fileURLToPath(new URL('plugin.js', import.meta.url))
  writeFileSync(out, buildPlugin())
  // eslint-disable-next-line no-console
  console.log(`Wrote ${out}`)
}
