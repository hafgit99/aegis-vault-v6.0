# OWASP Compliance Matrix

Last reviewed: 2026-05-28

This document maps AegisVault v6 security controls to current OWASP guidance. It is an internal readiness matrix, not an OWASP certification claim. A formal compliance statement requires independent review, penetration testing, and release evidence from the exact build being assessed.

## Referenced Standards

| Standard | Current Reference | Fit For AegisVault |
| --- | --- | --- |
| OWASP Top 10 | 2025 | Awareness-level web application risk taxonomy. |
| OWASP ASVS | 5.0.0 | Technical application security verification baseline. |
| OWASP MASVS | Current MASVS categories | Relevant to local storage, cryptography, authentication, platform interaction, code quality, and privacy patterns in desktop/mobile-style clients. |
| OWASP DSOVS | 1.1.0 | DevSecOps process, CI/CD, release, vulnerability disclosure, and evidence maturity. |

## Status Legend

| Status | Meaning |
| --- | --- |
| Strong | Implemented and covered by tests, documentation, or release gates. |
| Partial | Meaningful controls exist, but more evidence or implementation work is required. |
| Not Applicable | The category does not materially apply to the current local-first release. |
| Gap | A material missing control or missing verification path. |

## OWASP Top 10 2025 Mapping

| Category | Status | Current Controls | Evidence | Remaining Work |
| --- | --- | --- | --- | --- |
| A01 Broken Access Control | Partial | Local vault lock/unlock lifecycle, locked-service rejection paths, vault-only UI controls, destructive action confirmations. | `src/lib/vaultService.ts`, `src/App.tsx`, `test/unit/vault-service.test.ts`, `test/unit/app.integration.test.tsx`, `test/e2e/*` | Future team vaults, cloud sync, and sharing need a dedicated authorization model before implementation. |
| A02 Security Misconfiguration | Strong | Desktop CSP blocks external network access by default, release hardening checklist, production build budget, explicit workflow gates. | `src-tauri/tauri.conf.json`, `docs/RELEASE_HARDENING.md`, `.github/workflows/*.yml`, `npm run build:budget` | Add automated checks for workflow permissions and release signing configuration. |
| A03 Software Supply Chain Failures | Partial | Locked npm and Cargo dependency graphs, `npm audit` release gate, CI quality gates, release evidence bundle. | `package-lock.json`, `src-tauri/Cargo.lock`, `package.json`, `.github/workflows/quality-gate.yml`, `scripts/generate-security-evidence.mjs` | Add SBOM generation, dependency review enforcement, and signed provenance for release artifacts. |
| A04 Cryptographic Failures | Strong | AES-GCM authenticated encryption, Argon2id KDFs, encrypted backups, encrypted TOTP secret storage, OS keychain device secret on desktop. | `src/lib/vaultService.ts`, `src/lib/backupCrypto.ts`, `src/lib/totp.ts`, `src/lib/secureSecretStore.ts`, `docs/SECURITY_MODEL.md`, `test/unit/crypto.test.ts`, `test/unit/totp.test.ts` | Independent cryptographic review before adding sync, sharing, or post-quantum recipient keys. |
| A05 Injection | Partial | React rendering, structured import parsing, guarded SQL helper behavior, SQLite persistence tests, TypeScript checks. | `src/lib/importer.ts`, `src/lib/SQLiteOPFS.ts`, `test/unit/importer.test.ts`, `test/unit/sqlite-opfs.test.ts`, `npm run lint` | Add explicit input validation matrix for import, search, URL, and free-text fields. |
| A06 Insecure Design | Strong | Security model, threat model, non-goals, abuse cases, release blockers, future crypto roadmap. | `docs/SECURITY_MODEL.md`, `docs/THREAT_MODEL.md`, `docs/RELEASE_HARDENING.md`, `docs/FUTURE_CRYPTO_ROADMAP.md` | Create separate threat models before implementing cloud sync, secure sharing, team vaults, or device transfer. |
| A07 Authentication Failures | Strong | Master password verification, device secret model, optional OS keychain storage, WebAuthn passkey flow for AegisVault-origin credentials, lock/reset flows. | `src/lib/vault/VaultAuthService.ts`, `src/lib/secureSecretStore.ts`, `src/lib/webauthnPasskey.ts`, `src/components/LockScreen.tsx`, `test/unit/vault-auth.test.ts`, `test/unit/webauthn-passkey.test.ts` | Add manual desktop passkey smoke evidence per OS and document browser/WebView support limitations. |
| A08 Software or Data Integrity Failures | Partial | AES-GCM tamper detection for encrypted payloads, release checksum manifests, security evidence bundle, desktop artifact checksum plan. | `scripts/generate-artifact-checksums.mjs`, `scripts/generate-security-evidence.mjs`, `docs/DESKTOP_PACKAGING.md`, `docs/AUDIT_EVIDENCE.md` | Add artifact signing and provenance verification before public binary distribution. |
| A09 Security Logging and Alerting Failures | Partial | In-app security/event logs for key actions and error handling, documented audit evidence. | `src/App.tsx`, `src/components/SecurityAudit.tsx`, `test/unit/app.integration.test.tsx`, `docs/AUDIT_EVIDENCE.md` | Define privacy-preserving log retention behavior and add release-time logging review. |
| A10 Mishandling of Exceptional Conditions | Partial | Guarded import/export errors, unlock failure paths, backup decrypt failure tests, settings error handling, release blockers. | `src/lib/backupCrypto.ts`, `src/components/Settings.tsx`, `test/unit/crypto.test.ts`, `test/unit/settings-database.test.tsx`, `docs/RELEASE_HARDENING.md` | Add a centralized error taxonomy for security-sensitive failures. |

## OWASP ASVS 5.0.0 Readiness Mapping

| ASVS Area | Status | Current Evidence | Notes |
| --- | --- | --- | --- |
| Architecture, Design, and Threat Modeling | Strong | `docs/SECURITY_MODEL.md`, `docs/THREAT_MODEL.md`, `docs/FUTURE_CRYPTO_ROADMAP.md` | Current local-first scope is clearly bounded. |
| Authentication | Strong | `src/lib/vault/VaultAuthService.ts`, `src/components/LockScreen.tsx`, `test/unit/vault-auth.test.ts`, `test/unit/lock-screen.test.tsx` | Local authentication is well covered; remote account auth is not implemented. |
| Session and Secret Lifecycle | Partial | `src/lib/secureSecretStore.ts`, `src/lib/clipboard.ts`, lock lifecycle tests | Add memory-clearing and desktop runtime smoke evidence where practical. |
| Access Control | Partial | App integration tests, locked service rejection tests | Future multi-user features require a new authorization layer. |
| Validation, Sanitization, and Encoding | Partial | Importer and SQLite tests, TypeScript checks | Add a dedicated validation rules document and tests for every user-controlled structured field. |
| Stored Cryptography | Strong | AES-GCM, Argon2id, encrypted backup tests, encrypted field persistence | External crypto review still recommended before sync/share features. |
| Error Handling and Logging | Partial | Error-state unit tests, SecurityAudit UI, release checklist | Needs a formal sensitive-error and log-redaction policy. |
| Data Protection and Privacy | Strong | Local-first architecture, no hosted account service, encrypted OPFS/backup design | Add privacy notice/release disclosure for telemetry-free behavior if public distribution expands. |
| Communications | Strong | Local-first, desktop CSP `connect-src 'self'`, no cloud service | Network review must be reopened if sync or update channels are added. |
| Malicious Code and Dependencies | Partial | `npm audit`, lockfiles, security scan, CI workflows | Add SBOM, dependency review, and provenance. |
| Business Logic | Partial | E2E flows, component flows, mutation profiles | Add abuse-case tests for future sharing/sync once implemented. |
| Files and Resources | Strong | Backup/import tests, explicit plaintext export acknowledgement, attachment handling tests | Maintain high-risk export warnings. |
| API and Web Service | Not Applicable | No public backend API in current release | Reassess when cloud sync or sharing is introduced. |
| Configuration | Strong | Tauri CSP, release hardening docs, build budget | Add automated workflow-permission checks. |

## OWASP MASVS Readiness Mapping

| MASVS Category | Status | Current Evidence | Notes |
| --- | --- | --- | --- |
| MASVS-STORAGE | Strong | Encrypted SQLite/OPFS rows, encrypted backup model, OS keychain integration | Browser fallback behavior must stay documented as lower assurance than desktop keychain. |
| MASVS-CRYPTO | Strong | AES-GCM, Argon2id, WebCrypto, encrypted TOTP/passkey metadata fields | Avoid custom crypto beyond well-reviewed composition. |
| MASVS-AUTH | Strong | Master password verification, device secret, WebAuthn flow, lock/reset tests | WebAuthn credentials are scoped to AegisVault origin only. |
| MASVS-NETWORK | Not Applicable | No cloud service or remote API in v6 local-first release | Becomes critical for sync/share/update channels. |
| MASVS-PLATFORM | Partial | Tauri command allowlist, OS keychain commands, CSP | Add per-OS desktop smoke checklist and code signing evidence. |
| MASVS-CODE | Strong | TypeScript checks, coverage, mutation profiles, E2E release gate | Keep mutation profiles meaningful and release-bound. |
| MASVS-RESILIENCE | Partial | Build/release checks, no public anti-tamper controls | Add signed artifacts and checksum verification guidance. |
| MASVS-PRIVACY | Strong | Local-first, no hosted account, no cloud sync, no telemetry dependency documented | Add a public privacy policy if distribution moves beyond GitHub releases. |

## OWASP DSOVS Readiness Mapping

| DSOVS Area | Status | Current Evidence | Remaining Work |
| --- | --- | --- | --- |
| Risk Assessment | Strong | Threat model and release blockers | Keep updated for every major feature. |
| Security Requirements | Strong | Security model, hardening checklist, non-goals | Convert future sync/share requirements into acceptance criteria before coding. |
| Threat Modeling | Strong | `docs/THREAT_MODEL.md` | Add feature-specific models for cloud and sharing. |
| Hardcoded Secrets Detection | Strong | `npm run security:scan` | Extend scan rules as new security-sensitive files are added. |
| SAST | Partial | `npm run lint` TypeScript checks | Add CodeQL or equivalent static analysis in GitHub Actions. |
| SCA | Partial | `npm audit` gates and lockfiles | Add Dependabot/dependency review/SBOM. |
| Security Test Coverage | Strong | Unit coverage, E2E release gate, mutation testing profiles | Publish coverage and mutation summaries with releases. |
| Secure Artifact Management | Partial | Desktop checksums, artifact manifest, security evidence bundle | Add code signing and provenance. |
| Vulnerability Disclosure | Strong | `SECURITY.md` | Add CVE/advisory process if the project gains external users. |
| Application Security Logging | Partial | SecurityAudit UI and app logs | Define privacy-preserving retention and export behavior. |

## Release Claim Guidance

Approved phrasing:

- "AegisVault maintains an OWASP-aligned security readiness matrix."
- "AegisVault maps its local-first controls to OWASP Top 10 2025, ASVS 5.0.0, MASVS, and DSOVS."
- "AegisVault has not been formally certified by OWASP."

Avoid:

- "OWASP certified"
- "Fully OWASP compliant"
- "Guaranteed secure"
- "Pen-test approved" unless a current independent report exists.

## Next Compliance Improvements

1. Add CodeQL or equivalent static analysis to CI.
2. Add SBOM generation and upload it with release evidence.
3. Add artifact signing and provenance for Windows, macOS, and Linux packages.
4. Add a validation rules matrix for import/export/search/user-profile fields.
5. Add a privacy notice before public distribution outside GitHub releases.
6. Run an independent security review before enabling sync, sharing, team vaults, or post-quantum recipient-key backup.
