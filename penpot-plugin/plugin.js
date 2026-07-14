/* eslint-disable */
// GENERATED FILE — DO NOT EDIT.
// Built from src/import-into-catalog.mjs + src/plugin.glue.mjs by build-plugin.mjs (npm run build:plugin).
// Penpot evaluates this as a plain script, so it must stay free of import/export.

/**
 * import-into-catalog — idempotent writer for the Mint Penpot plugin.
 *
 * Drives Penpot's design-tokens Plugins API (`penpot.library.local.tokens`)
 * to import a list of normalized token sets (as produced by `dtcgToTokenOps`).
 *
 * Re-import is idempotent with overwrite (sync) semantics: existing sets are
 * reused (and activated) instead of re-created, and existing tokens are
 * overwritten with the incoming value instead of throwing "already exists".
 *
 * The `catalog` argument is Penpot's `TokenCatalog`; it is injected so the
 * logic can be unit-tested against an in-memory fake.
 *
 * @param {object} catalog Penpot TokenCatalog (`penpot.library.local.tokens`).
 * @param {Array<{ name: string, tokens: Array<{ name: string, type: string|null, value: * }> }>} sets
 * @returns {{ sets: number, tokens: number, skipped: number, errors: string[] }}
 */
function importSets(catalog, sets) {
  const summary = { sets: 0, tokens: 0, skipped: 0, errors: [] }

  for (const set of sets) {
    let tokenSet
    try {
      tokenSet = getOrCreateSet(catalog, set.name)
      summary.sets += 1
    } catch (error) {
      summary.errors.push(`set "${set.name}": ${errorMessage(error)}`)
      continue
    }

    for (const token of set.tokens) {
      // The core marks unsupported DTCG types with `type: null`.
      if (!token.type) {
        summary.skipped += 1
        continue
      }
      try {
        writeToken(tokenSet, token)
        summary.tokens += 1
      } catch (error) {
        summary.errors.push(`${set.name}/${token.name}: ${errorMessage(error)}`)
      }
    }
  }

  return summary
}

// Reuse a set with the same name if it already exists (and ensure it is
// active, so its tokens affect the file); otherwise create a new active set.
function getOrCreateSet(catalog, name) {
  const existing = (catalog.sets || []).find((s) => s.name === name)
  if (existing) {
    existing.active = true
    return existing
  }
  return catalog.addSet({ name, active: true })
}

// Overwrite (sync): create the token fresh, replacing any existing one with the
// same name. `addToken` throws on a name clash, so an existing token is removed
// first — but only after capturing it, so a rejected new value (Penpot throws
// on malformed input) restores the previous token instead of destroying it.
// remove + addToken keeps a single, verified write path for every token type
// (notably `shadow`, whose stored value shape differs from its input shape).
function writeToken(tokenSet, { type, name, value }) {
  const existing = (tokenSet.tokens || []).find((t) => t.name === name)
  if (!existing) {
    tokenSet.addToken({ type, name, value })
    return
  }

  const previous = {
    type: existing.type,
    name: existing.name,
    value: existing.value,
  }
  existing.remove()
  try {
    tokenSet.addToken({ type, name, value })
  } catch (error) {
    tokenSet.addToken(previous)
    throw error
  }
}

function errorMessage(error) {
  return (error && error.message) || String(error)
}

/* global penpot */
/**
 * Mint · DTCG token import — Penpot plugin glue (SOURCE).
 *
 * Runs inside Penpot's plugin sandbox, which evaluates the plugin `code` file
 * as a plain script (no ES module `import` allowed). So this source is bundled
 * with its dependencies into the single-file `plugin.js` by `build-plugin.mjs`
 * (`npm run build:plugin`) — EDIT THIS FILE, not the generated `plugin.js`.
 *
 * It holds no transformation logic: the UI (index.html) computes the normalized
 * token operations with the pure `dtcgToTokenOps` core and posts them here; this
 * file drives the Penpot Plugins API via the pure, unit-tested `importSets`.
 *
 * Token API reference: https://doc.plugins.penpot.app/
 */

penpot.ui.open('Mint · DTCG token import', 'index.html', {
  width: 460,
  height: 560,
})

penpot.ui.onMessage((message) => {
  if (!message || message.type !== 'create-tokens') return

  const sets = Array.isArray(message.sets) ? message.sets : []

  // The design tokens Plugins API lives on the local library's token catalog
  // and only exists in recent Penpot builds (@penpot/plugin-types >= 1.5.0).
  const catalog =
    penpot.library && penpot.library.local && penpot.library.local.tokens
  if (!catalog || typeof catalog.addSet !== 'function') {
    penpot.ui.sendMessage({
      type: 'result',
      summary: {
        sets: 0,
        tokens: 0,
        skipped: 0,
        errors: [
          'This Penpot version does not expose the design tokens Plugins API ' +
            '(penpot.library.local.tokens). It requires a build shipping ' +
            '@penpot/plugin-types 1.5.0+ (currently the beta/next channel).',
        ],
      },
    })
    return
  }

  const summary = importSets(catalog, sets)
  penpot.ui.sendMessage({ type: 'result', summary })
})
