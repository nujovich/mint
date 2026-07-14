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
import { importSets } from './import-into-catalog.mjs'

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
