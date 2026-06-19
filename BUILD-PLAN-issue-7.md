# BUILD #7: CSS gap decorations linting rules

Card: https://github.com/nujovich/mint-radar/issues/7

## Milestones

- [x] Add `gap-decoration-hack` rule -- detect manual gap styling patterns (border on children, pseudo-elements, background with gap) and suggest migrating to native `gap-rule-*` properties
- [ ] Add `gap-decorations-compat` rule -- warn when project uses gap decorations but browserslist does not support them, suggest fallback
- [ ] Add adoption estimation report -- audit how many project stylesheets use hacks that gap decorations would replace, output in `mint-ds audit` under "Modern CSS Opportunities"
