# Audit Evidence Matrix

This document maps security controls to implementation files and verification commands. Update it before external audit or public release.

## Control Matrix

| Control | Implementation | Verification |
| --- | --- | --- |
| Vault field encryption | `src/lib/vaultService.ts`, `src/lib/vault/VaultCryptoService.ts` | `npm run test:coverage`, `test/unit/vault-service.test.ts` |
| SQLite OPFS persistence | `src/lib/SQLiteOPFS.ts` | `test/unit/sqlite-opfs.test.ts` |
| Master password verification | `src/lib/vault/VaultAuthService.ts` | `test/unit/vault-auth.test.ts`, `test/unit/vault-service.test.ts` |
| Locale-aware password strength analysis | `src/lib/passwordStrength.ts`, `src/lib/passwordLocaleDictionaries.ts` | `test/unit/password-locale-dictionaries.test.ts` |
| HIBP k-anonymity breach scan | `src/lib/hibpPwnedPasswords.ts`, `src/components/SecurityAudit.tsx`, `src-tauri/tauri.conf.json` | `test/unit/hibp-pwned-passwords.test.ts`, `test/unit/component-flows.test.tsx` |
| Argon2id backup encryption | `src/lib/backupCrypto.ts` | `test/unit/crypto.test.ts` |
| Secure Share bundle encryption, v1.1 manifest integrity, and validation | `src/lib/secureShareBundle.ts`, `src/lib/importWorkflow.ts`, `src/components/settings/ImportSettingsPanel.tsx`, `src/components/Settings.tsx`, `src/components/DetailPanel.tsx`, `src/components/DatabaseModal.tsx` | `test/unit/secure-share-bundle.test.ts`, `test/unit/import-workflow.test.ts`, `test/unit/settings-database.test.tsx`, `test/unit/component-flows.test.tsx` |
| OS keychain device secret | `src-tauri/src/main.rs`, `src/lib/secureSecretStore.ts` | `cargo check`, `test/unit/secure-secret-store.test.ts` |
| WebAuthn passkey flow | `src/lib/webauthnPasskey.ts` | `test/unit/webauthn-passkey.test.ts`, `test/unit/component-flows.test.tsx` |
| TOTP generation | `src/lib/totp.ts` | `test/unit/totp.test.ts`, `test/unit/component-flows.test.tsx` |
| Sensitive clipboard handling | `src/lib/clipboard.ts`, `src-tauri/src/main.rs` | `test/unit/crypto.test.ts`, `cargo check` |
| i18n key integrity | `src/i18n/locales/*.json` | `test/unit/i18n.test.ts` |
| Release artifact checksums | `scripts/generate-artifact-checksums.mjs` | `npm run desktop:checksums` |
| Release artifact provenance | `.github/workflows/desktop-packaging.yml` | GitHub artifact attestations |
| Security regression scan | `scripts/security-regression-scan.mjs` | `npm run security:scan` |
| Secure Share format policy | `docs/SECURE_SHARE_FORMAT.md`, `scripts/verify-secure-share-format.mjs`, `src/lib/secureShareBundle.ts`, `test/e2e/authenticated-settings-transfer.spec.ts` | `npm run security:secure-share` |
| Workflow permission audit | `scripts/verify-workflow-permissions.mjs`, `.github/workflows/*.yml` | `npm run security:workflows` |
| Dependency update policy | `.github/dependabot.yml`, `docs/DEPENDENCY_POLICY.md`, `scripts/verify-dependency-policy.mjs` | `npm run security:dependencies` |
| Input validation matrix | `docs/VALIDATION_RULES.md`, `scripts/verify-validation-rules.mjs` | `npm run security:validation` |
| Privacy notice and network disclosure | `docs/PRIVACY_NOTICE.md`, `src-tauri/tauri.conf.json`, `scripts/verify-privacy-notice.mjs` | `npm run security:privacy` |
| Release signing policy | `docs/RELEASE_SIGNING_POLICY.md`, `.github/workflows/desktop-packaging.yml`, `scripts/verify-release-signing.mjs` | `npm run security:signing` |
| Branch protection policy | `docs/BRANCH_PROTECTION_POLICY.md`, `.github/workflows/quality-gate.yml`, `.github/workflows/codeql.yml`, `scripts/verify-branch-protection-policy.mjs` | `npm run security:branch-protection` |
| Desktop smoke evidence policy | `docs/DESKTOP_SMOKE_EVIDENCE.md`, `docs/DESKTOP_PACKAGING.md`, `.github/workflows/desktop-packaging.yml`, `scripts/verify-desktop-smoke-policy.mjs` | `npm run security:desktop-smoke` |
| Security logging policy | `docs/SECURITY_LOGGING_POLICY.md`, `src/hooks/useSecurityLogs.ts`, `src/App.tsx`, `src/components/SecurityLogsModal.tsx`, `scripts/verify-security-logging-policy.mjs` | `npm run security:logging` |
| Security error taxonomy | `docs/ERROR_TAXONOMY.md`, `src/lib/securityErrors.ts`, `scripts/verify-error-taxonomy.mjs` | `npm run security:errors`, `test/unit/security-errors.test.ts` |
| Release notes template | `docs/RELEASE_NOTES_TEMPLATE.md`, `scripts/verify-release-notes-template.mjs` | `npm run security:release-notes` |
| Vulnerability disclosure process | `SECURITY.md`, `docs/VULNERABILITY_DISCLOSURE.md`, `scripts/verify-vulnerability-disclosure.mjs` | `npm run security:disclosure` |
| CycloneDX SBOM | `scripts/generate-sbom.mjs` | `npm run security:sbom` |
| Security evidence bundle | `scripts/generate-security-evidence.mjs`, `scripts/verify-security-evidence-bundle.mjs`, `security-evidence/security-evidence-manifest.json`, `security-evidence/SECURITY_EVIDENCE_SUMMARY.md` | `npm run security:evidence`, `npm run security:evidence:verify` |
| CodeQL static analysis | `.github/workflows/codeql.yml` | GitHub code scanning alerts |
| OWASP readiness mapping | `docs/OWASP_COMPLIANCE_MATRIX.md` | Security review before release |
| Build budget | `scripts/check-build-budget.mjs` | `npm run build:budget` |
| E2E release browser gate | `playwright.config.ts`, `test/e2e/*` | `npm run test:e2e:release` |
| Mutation testing | `stryker*.config.json` | `npm run test:mutation:release` |
| Secure Share mutation profile | `stryker.secure-share.config.json`, `src/lib/secureShareBundle.ts`, `src/lib/importWorkflow.ts` | `npm run test:mutation:secure-share` |

## Latest Local Evidence

Last updated: 2026-06-05

Recent local checks performed during hardening:

- `npm run lint` passed.
- `npm run security:scan` should pass before release.
- `npm run security:workflows` passed.
- `npm run security:dependencies` passed.
- `npm run security:validation` passed.
- `npm run security:secure-share` should pass before release.
- `npm run security:privacy` passed.
- `npm run security:signing` passed.
- `npm run security:branch-protection` passed.
- `npm run security:desktop-smoke` passed.
- `npm run security:logging` passed.
- `npm run security:errors` passed.
- `npm run security:release-notes` passed.
- `npm run security:disclosure` passed.
- `npm run security:sbom` should produce `sbom/aegisvault.cdx.json`.
- `npm run security:evidence` should produce and verify `security-evidence/`, `security-evidence-manifest.json`, `SHA256SUMS.txt`, and `SECURITY_EVIDENCE_SUMMARY.md`.
- `npm run test:unit -- secure-share-bundle import-workflow settings-hooks` passed with 20 tests.
- `npm run test:unit -- settings-database` passed with 41 tests.
- `npm run test:e2e:chromium -- authenticated-settings-transfer.spec.ts` passed with 3 tests, including Secure Share `v1.1` manifest evidence in the import UI.
- `npm run test:mutation:release` passed across core, Secure Share, SQLite, hooks, Settings, and DatabaseModal release profiles.
- `npm run test:mutation:secure-share` passed with 85.26% mutation score overall, 92.03% for `secureShareBundle.ts`, and 76.99% for `importWorkflow.ts`.
- `npm run test:mutation:hooks` passed with 55.01% mutation score after adding direct hook behavior tests.
- `npm run test:mutation:settings` passed with 37.50% mutation score for the focused Settings interaction-panel profile.
- `npm run test:mutation:database` passed with 39.06% mutation score for `DatabaseModal.tsx`.
- `npm run test:coverage` passed with 308 tests and 89.90% statement coverage.
- `npm run build` passed.
- `npm run build:budget` passed with total budgeted JS around 1145 KiB, excluding the separately budgeted lazy `vendor-zxcvbn` password-analysis chunk.
- `npm run test:e2e:release` passed with 21 Chromium tests, 5 Firefox smoke tests, and 5 mobile Firefox smoke tests.
- `cargo check` passed after adding OS keychain integration.

Re-run the full release gate before tagging because this matrix is evidence, not a substitute for CI.

## Files To Provide To An External Auditor

- `SECURITY.md`
- `docs/SECURITY_MODEL.md`
- `docs/THREAT_MODEL.md`
- `docs/SECURE_SHARE_FORMAT.md`
- `docs/DEPENDENCY_POLICY.md`
- `docs/VALIDATION_RULES.md`
- `docs/PRIVACY_NOTICE.md`
- `docs/RELEASE_SIGNING_POLICY.md`
- `docs/BRANCH_PROTECTION_POLICY.md`
- `docs/DESKTOP_SMOKE_EVIDENCE.md`
- `docs/SECURITY_LOGGING_POLICY.md`
- `docs/ERROR_TAXONOMY.md`
- `docs/RELEASE_NOTES_TEMPLATE.md`
- `docs/VULNERABILITY_DISCLOSURE.md`
- `docs/OWASP_COMPLIANCE_MATRIX.md`
- `docs/RELEASE_HARDENING.md`
- `docs/RELEASE.md`
- `docs/DESKTOP_PACKAGING.md`
- `.github/workflows/*.yml`
- `package-lock.json`
- `src-tauri/Cargo.lock`
- Coverage report artifact from CI.
- Playwright report artifact from CI.
- Security evidence artifact from CI.
- Security evidence manifest and summary from CI.
- CycloneDX SBOM artifact from CI.
- CodeQL code scanning results from GitHub.
- Desktop checksum manifest for release artifacts.
- GitHub artifact attestation URLs for desktop release artifacts.
- Desktop smoke evidence record for Windows, macOS, and Linux artifacts.

## Known Limitations To Disclose

- Local-first release has no cloud sync, share links, or team vault authorization.
- Secure Share is an offline encrypted file format with current `v1.1` manifest integrity evidence; it does not provide remote revocation, hosted links, sender identity verification, or team authorization.
- A malicious browser extension or compromised OS can observe secrets after unlock.
- WebAuthn credentials are scoped to the AegisVault origin, not third-party service origins.
- Plain-text backup export is user-controlled and intentionally high risk.
- Post-quantum key establishment is not implemented in the current release.
