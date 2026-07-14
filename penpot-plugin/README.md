# Mint · DTCG token import — Penpot plugin

A small [Penpot plugin](https://help.penpot.app/plugins/getting-started/) that imports a
[W3C DTCG](https://www.designtokens.org/TR/2025.10/format/) tokens file — such as the output of
Mint's `mint-ds export --target dtcg` — into the current Penpot file as native token sets, using
the [Design Tokens Plugins API](https://doc.plugins.penpot.app/) (Penpot 2.14+).

> Penpot already imports DTCG JSON natively (Tokens panel → **Tools** → **Import**). This plugin
> is a convenience for a one-click, in-file import driven by the Plugins API; the manual path works
> just as well and needs no plugin.

## Requirements

The design tokens Plugins API (`penpot.library.local.tokens`) is **recent** — it ships with
`@penpot/plugin-types` **1.5.0+** (currently the `next`/beta channel; Penpot 2.14+ builds). On an
older Penpot the API is absent and the plugin reports a clear error instead of failing silently.
Confirm your instance exposes it before relying on this plugin.

## Architecture

Two layers, deliberately separated so the logic is testable without a running Penpot:

| File                                                         | Runs in                       | Responsibility                                                                                                                                                        |
| ------------------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/dtcg-to-token-ops.mjs`](src/dtcg-to-token-ops.mjs)     | plugin iframe (plain browser) | **Pure core.** Transforms a DTCG object into normalized `{ set, token }` operations. No Penpot dependency; fully unit-tested.                                         |
| [`src/import-into-catalog.mjs`](src/import-into-catalog.mjs) | Penpot sandbox (bundled)      | **Idempotent writer.** Drives `penpot.library.local.tokens`, reusing existing sets and overwriting existing tokens (sync). Catalog injected → unit-tested via a fake. |
| [`src/plugin.glue.mjs`](src/plugin.glue.mjs)                 | Penpot sandbox (bundled)      | Sandbox bootstrap **source**. Opens the UI, receives operations, calls `importSets`. Holds no transformation logic.                                                   |
| [`index.html`](index.html)                                   | plugin iframe                 | UI. Reads the DTCG file, calls the core, posts the operations to the sandbox.                                                                                         |
| [`plugin.js`](plugin.js)                                     | Penpot sandbox                | **Generated** single-file bundle of `import-into-catalog.mjs` + `plugin.glue.mjs` (`npm run build:plugin`). Penpot evals it as a plain script — do not edit by hand.  |

## Token mapping

The importer creates **one token set per top-level DTCG group** (matching Penpot's single-file
import behaviour), flattening nested groups into dotted token names (`primary.500`).

| DTCG source                                      | Penpot `TokenType` | Value                                            |
| ------------------------------------------------ | ------------------ | ------------------------------------------------ |
| `color` (`$type: color`)                         | `color`            | hex string, e.g. `#1976d2`                       |
| `spacing` (`$type: dimension`)                   | `spacing`          | `"<n><unit>"`, e.g. `4px`                        |
| `border-radius` (`$type: dimension`)             | `borderRadius`     | `"<n><unit>"`                                    |
| `shadow` (`$type: shadow`)                       | `shadow`           | single `TokenShadowValueString` (fields strings) |
| `typography → font-family` (`$type: fontFamily`) | `fontFamilies`     | string                                           |
| `typography → font-weight` (`$type: fontWeight`) | `fontWeights`      | string, e.g. `"700"`                             |

DTCG types with no Penpot equivalent are marked `type: null` by the core and **skipped** by the
glue (reported in the result summary, not silently dropped).

### Value-format caveats

Penpot's `addToken` takes the **string** form of every value (numeric types included — `"16"` or
`"16px"`), except `shadow`, whose value is a single `TokenShadowValueString` object (all fields
strings; offsets/blur/spread are plain pixel numbers). Passing an array of shadow layers is a type
mismatch that Penpot silently ignores (the token is created with default values), so single-layer
shadows map to one object. `color`, `fontFamilies` and `fontWeights` are straightforward strings.

## Install & use

**Hosted build:** on every merge to `main` the plugin is published to GitHub Pages by
[`deploy-penpot-plugin.yml`](../.github/workflows/deploy-penpot-plugin.yml). Install it in Penpot
directly from the manifest URL:

```
https://nujovich.github.io/mint/manifest.json
```

To run it locally instead (development, or before it is published):

The plugin ships as static files — serve the `penpot-plugin/` directory over HTTP. A
zero-dependency dev server is bundled (sets the JS MIME type ES modules need and
permissive CORS). It regenerates `plugin.js` from its sources on startup:

```bash
npm run serve:plugin                  # http://localhost:4400/manifest.json (rebuilds plugin.js first)
# or, without the dev server:
npm run build:plugin && npx serve penpot-plugin
```

`plugin.js` is a generated bundle. After editing `src/import-into-catalog.mjs` or
`src/plugin.glue.mjs`, run `npm run build:plugin` (the dev server and the
`build-plugin` test both guard against a stale checkout).

Then, in a Penpot file:

1. Inside an open file, open the Plugin Manager — **Ctrl + Alt + P**, or main menu → **Plugins** →
   **Plugin manager** (the shortcut only works in the design workspace, not the dashboard).
2. Paste the manifest URL (e.g. `http://localhost:4400/manifest.json`) and install.
3. Run **Mint · DTCG token import**.
4. Paste your `mint-ds.tokens.dtcg.json` (or use **load a file…**) and click **Create tokens**.
   A bundled [`example.tokens.dtcg.json`](example.tokens.dtcg.json) (Mint's Frankenstein sample,
   81 tokens / 5 sets) is included to try it end-to-end.

The result summary reports how many sets and tokens were created, how many were skipped
(unsupported types), and any per-token errors.

> Remote installs must be served over HTTPS. `localhost` is allowed for development.

## Permissions

`library:read`, `library:write` — the plugin only creates or updates token sets and tokens in the
open file. Re-import is **idempotent with sync semantics**: existing sets are reused (not
duplicated) and existing tokens are **overwritten** with the incoming DTCG value. It never removes
tokens that are absent from the imported file, and touches nothing outside the token catalog.

## Tests

The pure core is unit-tested with the repository's Vitest setup:

```bash
npx vitest run penpot-plugin/__tests__/dtcg-to-token-ops.test.mjs
```
