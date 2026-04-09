# Contributing

Thanks for your interest in contributing to AndroidIRCX.

This project is meant to be maintained like a serious production open-source application. Changes
are expected to be reviewable, tested, and consistent with the existing architecture.

## Ways to Contribute

- Report bugs and request features via GitHub Issues.
- Improve documentation.
- Submit code changes through pull requests.
- Help reproduce issues, review pull requests, or improve test coverage.

## Ground Rules

- Keep changes focused. Do not mix refactors, formatting sweeps, dependency churn, and feature work
  in the same pull request unless they are tightly coupled.
- Prefer TypeScript for new code and keep modules small, explicit, and easy to test.
- Follow existing architectural patterns before introducing new abstractions.
- Do not silently change app behavior, build tooling, or CI policy without documenting it in the PR.
- Security-sensitive changes should be called out explicitly and linked to [SECURITY.md](SECURITY.md)
  when relevant.

## Development Workflow

1. Fork the repo and create a feature branch from `master` or the current active development base.
2. Keep commits clear and focused. Separate mechanical changes from behavioral changes whenever
   possible.
3. Run the required local verification before opening a PR.
4. Open a pull request with a clear summary, test evidence, and screenshots for UI changes.
5. Address review feedback with follow-up commits instead of force-pushing opaque history rewrites
   unless a maintainer asks for cleanup.

## Required Local Checks

Before opening or updating a pull request, run:

```bash
yarn format-check
yarn lint:ci
yarn type-check
yarn test:ci
```

These commands mirror the CI quality gates and test suite. A pull request is not ready for review
if these checks fail locally.

## Code Style and Scope

- Use Prettier formatting and do not hand-format files against project conventions.
- ESLint warnings should be treated as failures. CI enforces zero warnings.
- Add or update tests when behavior changes.
- Avoid drive-by edits in unrelated files.
- Document any non-obvious tradeoffs in code comments or in the PR description, not in commit
  messages alone.

## Pull Request Expectations

Each pull request should include:

- A concise description of what changed and why.
- Linked issues when applicable.
- A testing summary listing what was run locally.
- Screenshots or recordings for UI changes.
- Notes about migrations, follow-up work, risks, or intentionally deferred cleanup.

Pull requests may be closed or asked to be split if they are too broad to review safely.

## Reporting Bugs

Please include:

- Steps to reproduce.
- Expected behavior and actual behavior.
- Device, OS version, and app version.
- Logs, screenshots, or screen recordings when possible.
- Whether the issue reproduces on the latest `master`.

## Branch Protection and CI

Maintainers should keep GitHub branch protection enabled for protected branches and require the CI
checks from `.github/workflows/test.yml` to pass before merge.

Recommended required checks:

- `Quality Gates`
- `Test Suite`

Recommended repository settings:

- Require pull request reviews before merging.
- Dismiss stale approvals when new commits are pushed.
- Require branches to be up to date before merging.
- Block force-pushes to protected branches.

## License

By contributing, you agree that your contributions will be licensed under the GPL-3.0-or-later.
