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

| File                                                     | Runs in                       | Responsibility                                                                                                                            |
| -------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/dtcg-to-token-ops.mjs`](src/dtcg-to-token-ops.mjs) | plugin iframe (plain browser) | **Pure core.** Transforms a DTCG object into normalized `{ set, token }` operations. No Penpot dependency; fully unit-tested.             |
| [`index.html`](index.html)                               | plugin iframe                 | UI. Reads the DTCG file, calls the core, posts the operations to the sandbox.                                                             |
| [`plugin.js`](plugin.js)                                 | Penpot sandbox                | Thin glue. Receives operations and calls `penpot.library.local.tokens.addSet(…)` / `tokenSet.addToken(…)`. Holds no transformation logic. |

## Token mapping

The importer creates **one token set per top-level DTCG group** (matching Penpot's single-file
import behaviour), flattening nested groups into dotted token names (`primary.500`).

| DTCG source                                      | Penpot `TokenType` | Value                                           |
| ------------------------------------------------ | ------------------ | ----------------------------------------------- |
| `color` (`$type: color`)                         | `color`            | hex string, e.g. `#1976d2`                      |
| `spacing` (`$type: dimension`)                   | `spacing`          | `"<n><unit>"`, e.g. `4px`                       |
| `border-radius` (`$type: dimension`)             | `borderRadius`     | `"<n><unit>"`                                   |
| `shadow` (`$type: shadow`)                       | `shadow`           | `TokenShadowValueString[]` (all fields strings) |
| `typography → font-family` (`$type: fontFamily`) | `fontFamilies`     | string                                          |
| `typography → font-weight` (`$type: fontWeight`) | `fontWeights`      | string, e.g. `"700"`                            |

DTCG types with no Penpot equivalent are marked `type: null` by the core and **skipped** by the
glue (reported in the result summary, not silently dropped).

### Value-format caveats

Penpot's `addToken` takes the **string** form of every value (numeric types included — `"16"` or
`"16px"`), except `shadow`, whose value is an array of `TokenShadowValueString` objects. The core
follows that contract, but the exact pixel formatting for dimension/shadow fields is still
best-effort until confirmed against a real Penpot file. `color`, `fontFamilies` and `fontWeights`
are straightforward strings.

## Install & use

The plugin is static files — serve the `penpot-plugin/` directory over HTTP. A
zero-dependency dev server is bundled (sets the JS MIME type ES modules need and
permissive CORS):

```bash
node penpot-plugin/serve-plugin.mjs   # http://localhost:4400/manifest.json
# or: npx serve penpot-plugin
```

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

`library:read`, `library:write` — the plugin only creates token sets and tokens in the open file.
Token creation is **additive**; it does not delete or overwrite existing tokens.

## Tests

The pure core is unit-tested with the repository's Vitest setup:

```bash
npx vitest run penpot-plugin/__tests__/dtcg-to-token-ops.test.mjs
```
