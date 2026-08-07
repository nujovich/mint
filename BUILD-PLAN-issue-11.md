# BUILD PLAN — Card #11: Style Dictionary v5.4.0 — DTCG dimension tokens

- **Card:** https://github.com/nujovich/mint-radar/issues/11
- **Decision:** Nadia chose Option B (code implementation as planned)

## Milestones

- [ ] Milestone 1 — Add dtcg export prompt to EXPORT_PROMPTS in lib/prompts.mjs with DTCG {value, unit} dimension token instructions
- [ ] Milestone 2 — Add DTCG type definitions to lib/types.ts for dimension, typography, and shadow tokens
- [ ] Milestone 3 — Update bin/mint-ds.mjs to support --format dtcg flag for token generation flow
- [ ] Milestone 4 — Add test fixture and tests for DTCG output validation
