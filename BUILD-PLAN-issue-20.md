# BUILD-PLAN-issue-20.md -- WCAG contrast audit with contrast-color() suggestions

**Card:** https://github.com/nujovich/mint-radar/issues/20

**Decision:** PLAN defined 4 milestones.

## Milestones

- [ ] Milestone 1 -- Extend ColorCluster in lib/types.ts with contrastRatio (number) and failsWCAG ({ aa: boolean; aaa: boolean }) fields
- [ ] Milestone 2 -- Implement WCAG 2.1 contrast ratio calculation for each color-background pair detected in the audited CSS
- [ ] Milestone 3 -- Add failing contrast pairs report in AuditReport with contrast-color() migration suggestions
- [ ] Milestone 4 -- Add tests with WebAIM Million baseline (83.9% fail rate)
