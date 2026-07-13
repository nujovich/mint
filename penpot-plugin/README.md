# Mint · DTCG token import — Penpot plugin

A small [Penpot plugin](https://help.penpot.app/plugins/getting-started/) that imports a
[W3C DTCG](https://www.designtokens.org/TR/2025.10/format/) tokens file — such as the output of
Mint's `mint-ds export --target dtcg` — into the current Penpot file as native token sets, using
the [Design Tokens Plugins API](https://doc.plugins.penpot.app/) (Penpot 2.14+).

> Penpot already imports DTCG JSON natively (Tokens panel → **Tools** → **Import**). This plugin
> is a convenience for a one-click, in-file import driven by the Plugins API; the manual path works
> just as well and needs no plugin.

## Architecture

Two layers, deliberately separated so the logic is testable without a running Penpot:

| File                                                     | Runs in                       | Responsibility                                                                                                                |
| -------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [`src/dtcg-to-token-ops.mjs`](src/dtcg-to-token-ops.mjs) | plugin iframe (plain browser) | **Pure core.** Transforms a DTCG object into normalized `{ set, token }` operations. No Penpot dependency; fully unit-tested. |
| [`index.html`](index.html)                               | plugin iframe                 | UI. Reads the DTCG file, calls the core, posts the operations to the sandbox.                                                 |
| [`plugin.js`](plugin.js)                                 | Penpot sandbox                | Thin glue. Receives operations and calls `penpot.tokens.createSet(…)` / `set.createToken(…)`. Holds no transformation logic.  |

## Token mapping

The importer creates **one token set per top-level DTCG group** (matching Penpot's single-file
import behaviour), flattening nested groups into dotted token names (`primary.500`).

| DTCG source                                      | Penpot `TokenType` | Value                                           |
| ------------------------------------------------ | ------------------ | ----------------------------------------------- |
| `color` (`$type: color`)                         | `color`            | hex string, e.g. `#1976d2`                      |
| `spacing` (`$type: dimension`)                   | `spacing`          | `"<n><unit>"`, e.g. `4px`                       |
| `border-radius` (`$type: dimension`)             | `borderRadius`     | `"<n><unit>"`                                   |
| `shadow` (`$type: shadow`)                       | `shadow`           | array of shadow layers (dimensions stringified) |
| `typography → font-family` (`$type: fontFamily`) | `fontFamilies`     | string                                          |
| `typography → font-weight` (`$type: fontWeight`) | `fontWeights`      | string, e.g. `"700"`                            |

DTCG types with no Penpot equivalent are marked `type: null` by the core and **skipped** by the
glue (reported in the result summary, not silently dropped).

### Value-format caveats

The exact value serialization Penpot's Plugins API expects for **dimension** and **shadow** tokens
is not covered by the published type docs. The shapes above are DTCG-faithful and were confirmed
against the transformation contract in tests, but the **shadow** value shape in particular must be
verified against a real Penpot file — treat it as best-effort until confirmed. `color`,
`fontFamilies` and `fontWeights` are straightforward strings.

## Install & use

The plugin is static files — serve the `penpot-plugin/` directory over HTTP:

```bash
npx serve penpot-plugin        # or any static file server
```

Then, in a Penpot file:

1. Open the Plugin Manager with **Ctrl + Alt + P**.
2. Paste the manifest URL (e.g. `http://localhost:3000/manifest.json`) and install.
3. Run **Mint · DTCG token import**.
4. Paste your `mint-ds.tokens.dtcg.json` (or use **load a file…**) and click **Create tokens**.

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
