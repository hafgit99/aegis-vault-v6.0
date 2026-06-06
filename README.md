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

Check the Android product track before installing Android tooling:

```bash
npm run android:doctor
```

Initialize and run the Android shell after installing Android Studio, Android SDK/NDK, and Rust Android targets:

```bash
npm run android:init
npm run android:dev
```

Android release candidates should be built as both APK and Google Play AAB artifacts:

```bash
npm run android:build:apk
npm run android:build:aab
```

See [docs/ANDROID_ROADMAP.md](docs/ANDROID_ROADMAP.md) for the Android security scope, native integration plan, and release gates.

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

Run the GitHub Actions workflow permission audit:

```bash
npm run security:workflows
```

Run the dependency policy audit:

```bash
npm run security:dependencies
```

Run the validation rules audit:

```bash
npm run security:validation
```

Run the privacy notice audit:

```bash
npm run security:privacy
```

Run the release signing policy audit:

```bash
npm run security:signing
```

Run the branch protection policy audit:

```bash
npm run security:branch-protection
```

Run the desktop smoke evidence policy audit:

```bash
npm run security:desktop-smoke
```

Run the security logging policy audit:

```bash
npm run security:logging
```

Run the error taxonomy audit:

```bash
npm run security:errors
```

Run the release notes template audit:

```bash
npm run security:release-notes
```

Run the vulnerability disclosure policy audit:

```bash
npm run security:disclosure
```

Generate the security evidence bundle:

```bash
npm run security:evidence
```

The bundle includes copied policy documents, release workflow definitions, verification scripts, SHA-256 checksums, a machine-readable manifest, and `SECURITY_EVIDENCE_SUMMARY.md`. The command also verifies the generated manifest, summary, and checksum entries.

Generate or verify the security evidence bundle separately:

```bash
npm run security:evidence:generate
npm run security:evidence:verify
```

Generate the CycloneDX SBOM:

```bash
npm run security:sbom
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
See [docs/SECURE_SHARE_FORMAT.md](docs/SECURE_SHARE_FORMAT.md) for the local encrypted transfer bundle contract.
See [docs/DEPENDENCY_POLICY.md](docs/DEPENDENCY_POLICY.md) for dependency update and triage rules.
See [docs/VALIDATION_RULES.md](docs/VALIDATION_RULES.md) for import, export, search, and profile input validation rules.
See [docs/PRIVACY_NOTICE.md](docs/PRIVACY_NOTICE.md) for local-first storage, telemetry, network, and export disclosures.
See [docs/RELEASE_SIGNING_POLICY.md](docs/RELEASE_SIGNING_POLICY.md) for desktop signing modes and artifact integrity rules.
See [docs/BRANCH_PROTECTION_POLICY.md](docs/BRANCH_PROTECTION_POLICY.md) for required branch protection, status checks, and release evidence rules.
See [docs/DESKTOP_SMOKE_EVIDENCE.md](docs/DESKTOP_SMOKE_EVIDENCE.md) for packaged Windows, macOS, and Linux smoke evidence requirements.
See [docs/SECURITY_LOGGING_POLICY.md](docs/SECURITY_LOGGING_POLICY.md) for local security log retention, severity, and sensitive-data rules.
See [docs/ERROR_TAXONOMY.md](docs/ERROR_TAXONOMY.md) for security-sensitive error codes, categories, severity, and public-message rules.
See [docs/RELEASE_NOTES_TEMPLATE.md](docs/RELEASE_NOTES_TEMPLATE.md) for public release notes, artifact integrity, signing disclosure, and smoke evidence fields.
See [docs/VULNERABILITY_DISCLOSURE.md](docs/VULNERABILITY_DISCLOSURE.md) for private reporting, triage, advisory, and incident-response rules.
See [docs/RELEASE_HARDENING.md](docs/RELEASE_HARDENING.md) for the release hardening checklist.
See [docs/AUDIT_EVIDENCE.md](docs/AUDIT_EVIDENCE.md) for the audit evidence matrix.
See [docs/OWASP_COMPLIANCE_MATRIX.md](docs/OWASP_COMPLIANCE_MATRIX.md) for OWASP Top 10, ASVS, MASVS, and DSOVS readiness mapping.
See [docs/MUTATION_POLICY.md](docs/MUTATION_POLICY.md) for mutation profile scope and triage rules.
See [docs/DESKTOP_PACKAGING.md](docs/DESKTOP_PACKAGING.md) for the desktop runtime decision and signing plan.
See [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md) for repository settings, secrets, and first-release steps.
