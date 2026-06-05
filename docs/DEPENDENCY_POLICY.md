# Dependency Update Policy

This policy defines how AegisVault handles dependency updates before public release, desktop packaging, and future cloud/team work.

## Scope

The policy covers:

- npm production dependencies.
- npm development dependencies.
- Rust/Cargo dependencies under `src-tauri`.
- GitHub Actions updates.
- Dependency review findings on pull requests.

## Automated Update Schedule

Dependabot is configured in `.github/dependabot.yml`.

| Ecosystem | Schedule | Limit | Notes |
| --- | --- | --- | --- |
| npm | Weekly, Monday 04:00 Europe/Istanbul | 5 open PRs | Production and development updates are grouped separately. |
| Cargo | Weekly, Monday 04:30 Europe/Istanbul | 5 open PRs | Applies to the Tauri desktop shell. |
| GitHub Actions | Weekly, Monday 05:00 Europe/Istanbul | 5 open PRs | Keeps CI actions current. |

## Review Rules

Production dependency updates:

- Must pass `npm run audit:prod`.
- Must pass `npm run test:coverage`.
- Must pass `npm run build` and `npm run build:budget`.
- Must be reviewed more carefully when they touch cryptography, storage, build tooling, or desktop packaging.

Development dependency updates:

- Must pass `npm run lint`.
- Must pass the relevant unit or E2E gate for the affected tooling.
- Must not weaken coverage, mutation, or release checks.

GitHub Actions updates:

- Must pass `npm run security:workflows`.
- Must preserve minimum required permissions.
- Must not introduce `pull_request_target` without a dedicated security review.

## Pull Request Dependency Review

Quality Gate runs GitHub Dependency Review on pull requests and fails on high severity findings. A failing dependency review must not be bypassed unless the finding is proven not exploitable in AegisVault's local-first release and the decision is recorded in release evidence.

## Triage SLA

| Severity | Triage Target | Release Rule |
| --- | --- | --- |
| Critical | Same day | Release blocker until resolved or formally accepted. |
| High | 2 business days | Release blocker for public builds. |
| Moderate | 7 business days | Must be reviewed before the next scheduled release. |
| Low | Next dependency maintenance cycle | Track with normal maintenance. |

## Manual Release Checks

Before tagging a release:

```bash
npm run security:dependencies
npm run audit:all
npm run security:sbom
```

The SBOM artifact must be uploaded with release evidence.
