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
export function importSets(catalog, sets) {
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
