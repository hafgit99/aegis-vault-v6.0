# Audit Evidence Matrix

This document maps security controls to implementation files and verification commands. Update it before external audit or public release.

## Control Matrix

| Control | Implementation | Verification |
| --- | --- | --- |
| Vault field encryption | `src/lib/vaultService.ts`, `src/lib/vault/VaultCryptoService.ts` | `npm run test:coverage`, `test/unit/vault-service.test.ts` |
| SQLite OPFS persistence | `src/lib/SQLiteOPFS.ts` | `test/unit/sqlite-opfs.test.ts` |
| Master password verification | `src/lib/vault/VaultAuthService.ts` | `test/unit/vault-auth.test.ts`, `test/unit/vault-service.test.ts` |
| Argon2id backup encryption | `src/lib/backupCrypto.ts` | `test/unit/crypto.test.ts` |
| OS keychain device secret | `src-tauri/src/main.rs`, `src/lib/secureSecretStore.ts` | `cargo check`, `test/unit/secure-secret-store.test.ts` |
| WebAuthn passkey flow | `src/lib/webauthnPasskey.ts` | `test/unit/webauthn-passkey.test.ts`, `test/unit/component-flows.test.tsx` |
| TOTP generation | `src/lib/totp.ts` | `test/unit/totp.test.ts`, `test/unit/component-flows.test.tsx` |
| Clipboard secret clear | `src/lib/clipboard.ts` | `test/unit/crypto.test.ts` |
| i18n key integrity | `src/i18n/locales/*.json` | `test/unit/i18n.test.ts` |
| Release artifact checksums | `scripts/generate-artifact-checksums.mjs` | `npm run desktop:checksums` |
| Security regression scan | `scripts/security-regression-scan.mjs` | `npm run security:scan` |
| Security evidence bundle | `scripts/generate-security-evidence.mjs` | `npm run security:evidence` |
| OWASP readiness mapping | `docs/OWASP_COMPLIANCE_MATRIX.md` | Security review before release |
| Build budget | `scripts/check-build-budget.mjs` | `npm run build:budget` |
| E2E release browser gate | `playwright.config.ts`, `test/e2e/*` | `npm run test:e2e:release` |
| Mutation testing | `stryker*.config.json` | `npm run test:mutation:release` |

## Latest Local Evidence

Last updated: 2026-05-28

Recent local checks performed during hardening:

- `npm run lint` passed.
- `npm run security:scan` should pass before release.
- `npm run security:evidence` should produce `security-evidence/`.
- `npm run test:coverage` passed with 211 tests.
- `npm run build` passed.
- `npm run build:budget` passed with total JS around 885 KiB.
- `cargo check` passed after adding OS keychain integration.

Re-run the full release gate before tagging because this matrix is evidence, not a substitute for CI.

## Files To Provide To An External Auditor

- `SECURITY.md`
- `docs/SECURITY_MODEL.md`
- `docs/THREAT_MODEL.md`
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
- Desktop checksum manifest for release artifacts.

## Known Limitations To Disclose

- Local-first release has no cloud sync, share links, or team vault authorization.
- A malicious browser extension or compromised OS can observe secrets after unlock.
- WebAuthn credentials are scoped to the AegisVault origin, not third-party service origins.
- Plain-text backup export is user-controlled and intentionally high risk.
- Post-quantum key establishment is not implemented in the current release.
