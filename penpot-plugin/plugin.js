/* global penpot */
/**
 * Mint · DTCG token import — Penpot plugin glue.
 *
 * Runs inside Penpot's plugin sandbox. It is intentionally tiny and holds no
 * transformation logic: the UI (index.html) computes the normalized token
 * operations with the pure `dtcgToTokenOps` core and posts them here; this file
 * only drives the Penpot Plugins API.
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
  const summary = { sets: 0, tokens: 0, skipped: 0, errors: [] }

  for (const set of sets) {
    let tokenSet
    try {
      tokenSet = penpot.tokens.createSet(set.name)
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
        tokenSet.createToken({
          name: token.name,
          type: token.type,
          value: token.value,
        })
        summary.tokens += 1
      } catch (error) {
        summary.errors.push(`${set.name}/${token.name}: ${errorMessage(error)}`)
      }
    }
  }

  penpot.ui.sendMessage({ type: 'result', summary })
})

function errorMessage(error) {
  return (error && error.message) || String(error)
}
