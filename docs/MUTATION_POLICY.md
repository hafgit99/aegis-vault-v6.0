# Mutation Testing Policy

Mutation testing is intentionally separated from the normal pull request gate because it is slower than unit, coverage, build, and E2E checks.

## Profiles

| Script | Scope | When to run |
| --- | --- | --- |
| `npm run test:mutation` | Core security libraries, importer, vault service, localized messages | Weekly, manually before release, and after sensitive crypto/import changes |
| `npm run test:mutation:release` | Core, Secure Share, SQLite, hooks, Settings, and DatabaseModal release profiles | Manual release hardening and weekly scheduled CI |
| `npm run test:mutation:secure-share` | Secure Share bundle format, manifest integrity, import workflow, and security error taxonomy | Weekly, manually before release, and after Secure Share, import, or backup-transfer changes |
| `npm run test:mutation:sqlite` | SQLite OPFS persistence layer | Weekly, manually before release, and after database/storage changes |
| `npm run test:mutation:hooks` | App lifecycle hooks, Settings import/export hooks, auto-lock, notifications, and vault entry operations | Weekly, manually before release, and after hook/state-management changes |
| `npm run test:mutation:settings` | Settings security, backup, import, master-password, and reset interaction panels | Weekly, manually before release, and after Settings changes |
| `npm run test:mutation:database` | Database management and backup modal | Weekly, manually before release, and after DatabaseModal changes |
| `npm run test:mutation:app` | App integration shell and lifecycle handlers | Manual, after App shell or state lifecycle changes |
| `npm run test:mutation:ui` | App, Settings, and DatabaseModal combined UI profile | Manual deep check before major releases |

## CI Strategy

- Pull requests run fast deterministic gates: lint, production audit, coverage thresholds, build, build budget, and E2E.
- `Mutation Testing` runs on a weekly schedule and can be started manually.
- Release candidates should pass `Release Preflight` first, then selected mutation profiles for the affected area.

## Thresholds

Thresholds are configured in each `stryker.*.config.json` file. They are intentionally different by area:

- Core library profiles have higher thresholds because they are deterministic and security-critical.
- Secure Share has a high threshold because bundle manifest validation and import integrity are security-sensitive. Its current enforced baseline is `high: 85`, `low: 80`, `break: 75`.
- UI profiles have lower thresholds because UI rendering branches and async interaction states produce more equivalent or low-value mutants.
- Settings mutation targets the interactive backup, import, master-password, and reset panels. The top-level `Settings.tsx` container and passive diagnostics/health panels are covered by unit, coverage, and E2E gates because they mostly compose hooks, layout, motion props, metrics display, and localized copy after the refactor.
- Settings UI mutation excludes `StringLiteral` and `ObjectLiteral` mutations so the profile focuses on interaction logic, disabled states, visibility branches, conflict-mode branches, and callbacks instead of localized copy, CSS utility classes, icon props, and animation object literals.
- Thresholds should only be raised after the matching tests have been improved and the profile is stable.

## Latest Release Evidence

Last updated: 2026-06-05

- `npm run test:mutation:release` passed across core, Secure Share, SQLite, hooks, Settings, and DatabaseModal profiles.
- `npm run test:mutation:hooks` passed with 55.01% mutation score after expanded hook unit coverage.
- `npm run test:mutation:settings` passed with 37.50% mutation score on focused Settings interaction panels.
- `npm run test:mutation:database` passed with 39.06% mutation score on `DatabaseModal.tsx`.

## Triage Rules

When mutation fails:

1. Prefer adding a focused test that captures user-visible or security-relevant behavior.
2. Avoid testing implementation details solely to kill a mutant.
3. If a mutant is equivalent, document the reason in the PR instead of weakening the profile.
4. Keep mutation profile scope narrow; broad profiles are slower and harder to triage.
