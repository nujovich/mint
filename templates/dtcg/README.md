# DTCG validation in CI

Two ready-made templates to gate `tokens.json` changes against the W3C Design Tokens
Community Group (DTCG) Format Module v1 spec.

## GitHub Actions

Copy `github-action.yml` into `.github/workflows/dtcg-validate.yml`. The job
runs on every PR that touches a `tokens.json` file and fails the check if the
file is structurally invalid or has broken token references.

## Pre-commit hook

`pre-commit.sh` blocks a commit when the staged `tokens.json` does not pass
validation. Install it directly:

```bash
cp templates/dtcg/pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Or wire it through [husky](https://typicode.github.io/husky):

```bash
npx husky add .husky/pre-commit "sh templates/dtcg/pre-commit.sh"
```

## Exit codes

The `mint-ds validate` command exits with:

- `0` — no errors and no warnings
- `1` — warnings only
- `2` — at least one error

Pass `--json` for machine-readable output suitable for downstream tools.
