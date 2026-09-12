# BUILD-PLAN-issue-24.md — OKLCH adoption audit

**Card:** https://github.com/nujovich/mint-radar/issues/24

**Decision:** PLAN (2026-07-10) defined 4 concrete code milestones.

## Milestones

- [ ] Milestone 1 — Add ColorSpaceAudit type system with legacy (hex, rgb, hsl) vs wide-gamut (oklch, oklab, display-p3) format detection
- [ ] Milestone 2 — Implement parser classifying each color by space, generating OKLCH adoption percentage and a list of legacy colors that are migration candidates
- [ ] Milestone 3 — Add migration suggestions with color-convert to show an OKLCH equivalent for each legacy color
- [ ] Milestone 4 — Add tests with real design palettes in multiple formats
