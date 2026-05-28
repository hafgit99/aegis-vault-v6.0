# AegisVault

[![Quality Gate](https://github.com/hafgit99/aegis-vault-v6.0/actions/workflows/quality-gate.yml/badge.svg)](https://github.com/hafgit99/aegis-vault-v6.0/actions/workflows/quality-gate.yml)
[![Release Preflight](https://github.com/hafgit99/aegis-vault-v6.0/actions/workflows/release-preflight.yml/badge.svg)](https://github.com/hafgit99/aegis-vault-v6.0/actions/workflows/release-preflight.yml)
[![Desktop Packaging](https://github.com/hafgit99/aegis-vault-v6.0/actions/workflows/desktop-packaging.yml/badge.svg)](https://github.com/hafgit99/aegis-vault-v6.0/actions/workflows/desktop-packaging.yml)

AegisVault is a local-first password vault built with React, Vite, SQLite WASM, and OPFS-backed browser storage. The application focuses on offline security workflows, encrypted backup/export, cross-platform import, multilingual UI, browser-based quality gates, and a future Tauri desktop distribution path.

Repository: [github.com/hafgit99/aegis-vault-v6.0](https://github.com/hafgit99/aegis-vault-v6.0)

## Local Development

Prerequisites:

- Node.js 22+
- npm

Install dependencies:

```bash
git clone https://github.com/hafgit99/aegis-vault-v6.0.git
cd aegis-vault-v6.0
npm ci
```

Start the app:

```bash
npm run dev
```

Build production assets:

```bash
npm run build
```

Run the desktop shell locally after installing the Tauri system prerequisites for your OS:

```bash
npm run desktop:dev
```

Build a local desktop package:

```bash
npm run desktop:build
```

Check production bundle budgets:

```bash
npm run build:budget
```

## Quality Gates

Run TypeScript checks:

```bash
npm run lint
```

Run production dependency audit:

```bash
npm run audit:prod
```

Run the security regression scan:

```bash
npm run security:scan
```

Generate the security evidence bundle:

```bash
npm run security:evidence
```

Run unit coverage:

```bash
npm run test:coverage
```

Run the release-ready E2E gate:

```bash
npm run test:e2e:release
```

The release E2E gate intentionally uses Chromium for full authenticated SQLite/OPFS vault workflows, then Firefox and mobile Firefox for lock-screen compatibility smoke coverage.

Run the release mutation profile when preparing a sensitive release:

```bash
npm run test:mutation:release
```

## Release Preparation

The repository includes GitHub Actions workflows for pull request quality checks, scheduled quality checks, mutation testing, release preflight validation, and manual desktop packaging with unsigned or signed modes. Desktop packaging for Windows, macOS, and Linux uses the documented Tauri-first release path.

See [docs/RELEASE.md](docs/RELEASE.md) for the release flow and packaging roadmap.
See [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) for the current cryptographic and storage architecture.
See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) for security assumptions, covered threats, and out-of-scope risks.
See [docs/RELEASE_HARDENING.md](docs/RELEASE_HARDENING.md) for the release hardening checklist.
See [docs/AUDIT_EVIDENCE.md](docs/AUDIT_EVIDENCE.md) for the audit evidence matrix.
See [docs/OWASP_COMPLIANCE_MATRIX.md](docs/OWASP_COMPLIANCE_MATRIX.md) for OWASP Top 10, ASVS, MASVS, and DSOVS readiness mapping.
See [docs/MUTATION_POLICY.md](docs/MUTATION_POLICY.md) for mutation profile scope and triage rules.
See [docs/DESKTOP_PACKAGING.md](docs/DESKTOP_PACKAGING.md) for the desktop runtime decision and signing plan.
See [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md) for repository settings, secrets, and first-release steps.
