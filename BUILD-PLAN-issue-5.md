# BUILD #5 — CSS layout linting rules for a11y and modern practices

Card: https://github.com/nujovich/mint-radar/issues/5

Based on pain points from Patrick Brosset's analysis and State of CSS 2025 data.

## Milestones

- [ ] Milestone 1 — Layout ordering accessibility rules: detect flex/grid order that breaks DOM order, and visual reordering without tabindex fallback
- [ ] Milestone 2 — Modern CSS best practice rules: detect grid misuse (single-column grids), legacy centering techniques, min-width:0 hacks, and fragile nested selectors
- [ ] Milestone 3 — Modern feature adoption suggestions: detect opportunities to use @layer and @container queries
- [ ] Milestone 4 — Overflow and wrap safety rules: detect missing overflow handling in grid/flex containers and flex containers without flex-wrap
