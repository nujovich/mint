# BUILD PLAN — Issue #76: Penpot interop on top of DTCG support

**Card:** https://github.com/nujovich/mint/issues/76

## Milestones

- [x] Milestone 1 — `--target dtcg` export: deterministic converter from mint-ds.tokens.json to DTCG v1 JSON, validated by feeding output through `mint-ds validate --spec dtcg`
- [x] Milestone 2 — Penpot import path documentation: README section and Tokens Studio for Figma
- [ ] ~~Milestone 3 — Penpot API push (optional, exploratory)~~ — **Not addressable.** Penpot exposes token creation only through its Plugins API (client-side, inside an open file); there is no server-side/REST endpoint to push tokens into a project. A headless API push is therefore not possible, so this milestone is dropped in favour of Milestone 4.
- [x] Milestone 4 — Penpot plugin — **Done, merged in #92.** The DTCG-to-Penpot import plugin covers the interop goal that Milestone 3 aimed at, using the only supported surface (the Plugins API).

## Status notes

- Milestone 3 replaces the impossible server-side push with the plugin (Milestone 4). See #92 for the plugin and the Plugins API constraints.
- Milestones 1 and 2 ship in this PR (#85).
