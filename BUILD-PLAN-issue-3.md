# BUILD PLAN — Issue #3

Card: https://github.com/nujovich/mint-radar/issues/3

## Milestones

- [x] Milestone 1 -- DTCG parser and structural validation: parse tokens.json against DTCG Format Module v1, validate groups, $type required, $value type checking, invalid nesting
- [ ] Milestone 2 -- Semantic coherence: detect broken references (token pointing to nonexistent token), circular dependencies, naming convention consistency (kebab-case vs camelCase), type-mismatch cross-references
- [ ] Milestone 3 -- CI integration: pre-commit hook, GitHub Actions config template, exit codes (0=ok, 1=warnings, 2=errors), output formats (terminal, JSON)
- [ ] Milestone 4 -- Extras: $extensions validation, snapshot diff (mint-ds diff), relation to card #34
