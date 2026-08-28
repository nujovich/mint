# BUILD-PLAN-issue-21.md — CSS Cascade Layers (@layer) audit

**Card:** https://github.com/nujovich/mint-radar/issues/21

**Decision:** PLAN defined 4 milestones (static detection, no LLM step needed).

## Milestones

- [ ] Milestone 1 — Add `CascadeLayerAudit` type system with detection of layer names, declaration order, and rules outside any layer
- [ ] Milestone 2 — Implement @layer parser that groups rules by layer and detects anti-patterns (post-layer specificity, !important inside layers)
- [ ] Milestone 3 — Add layer hierarchy visualization to the CLI output, with warnings for implicit vs explicit order
- [ ] Milestone 4 — Add test fixture with real-world multi-layer projects and tests
