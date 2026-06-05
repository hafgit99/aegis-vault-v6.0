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
| A02 Security Misconfiguration | Strong | Desktop CSP blocks external network access by default, release hardening checklist, production build budget, explicit workflow gates, workflow permission audit. | `src-tauri/tauri.conf.json`, `docs/RELEASE_HARDENING.md`, `.github/workflows/*.yml`, `scripts/verify-workflow-permissions.mjs`, `npm run build:budget`, `npm run security:workflows` | Add automated release signing configuration checks. |
| A03 Software Supply Chain Failures | Partial | Locked npm and Cargo dependency graphs, Dependabot policy, `npm audit` release gate, pull request dependency review, workflow permission audit, branch protection policy gate, CI quality gates, release evidence bundle, CycloneDX SBOM artifact. | `package-lock.json`, `src-tauri/Cargo.lock`, `package.json`, `.github/dependabot.yml`, `docs/DEPENDENCY_POLICY.md`, `docs/BRANCH_PROTECTION_POLICY.md`, `.github/workflows/quality-gate.yml`, `scripts/verify-dependency-policy.mjs`, `scripts/verify-workflow-permissions.mjs`, `scripts/verify-branch-protection-policy.mjs`, `scripts/generate-sbom.mjs`, `scripts/generate-security-evidence.mjs` | Enable matching GitHub branch protection settings and add signed provenance for all public release artifacts. |
| A04 Cryptographic Failures | Strong | AES-GCM authenticated encryption, Argon2id KDFs, encrypted backups, encrypted Secure Share bundles, encrypted TOTP secret storage, OS keychain device secret on desktop. | `src/lib/vaultService.ts`, `src/lib/backupCrypto.ts`, `src/lib/secureShareBundle.ts`, `src/lib/totp.ts`, `src/lib/secureSecretStore.ts`, `docs/SECURITY_MODEL.md`, `docs/SECURE_SHARE_FORMAT.md`, `test/unit/crypto.test.ts`, `test/unit/secure-share-bundle.test.ts`, `test/unit/totp.test.ts` | Independent cryptographic review before adding cloud sync, hosted sharing, team vaults, or post-quantum recipient keys. |
| A05 Injection | Strong | React rendering, structured import parsing, documented validation rules, guarded SQL helper behavior, SQLite persistence tests, TypeScript checks. | `docs/VALIDATION_RULES.md`, `src/lib/importer.ts`, `src/lib/SQLiteOPFS.ts`, `test/unit/importer.test.ts`, `test/unit/sqlite-opfs.test.ts`, `npm run lint`, `npm run security:validation` | Keep validation matrix updated for new cloud, team, hosted-share, and remote API inputs. |
| A06 Insecure Design | Strong | Security model, threat model, non-goals, abuse cases, release blockers, future crypto roadmap. | `docs/SECURITY_MODEL.md`, `docs/THREAT_MODEL.md`, `docs/RELEASE_HARDENING.md`, `docs/FUTURE_CRYPTO_ROADMAP.md` | Create separate threat models before implementing cloud sync, secure sharing, team vaults, or device transfer. |
| A07 Authentication Failures | Strong | Master password verification, device secret model, optional OS keychain storage, WebAuthn passkey flow for AegisVault-origin credentials, lock/reset flows. | `src/lib/vault/VaultAuthService.ts`, `src/lib/secureSecretStore.ts`, `src/lib/webauthnPasskey.ts`, `src/components/LockScreen.tsx`, `test/unit/vault-auth.test.ts`, `test/unit/webauthn-passkey.test.ts` | Add manual desktop passkey smoke evidence per OS and document browser/WebView support limitations. |
| A08 Software or Data Integrity Failures | Partial | AES-GCM tamper detection for encrypted payloads, release checksum manifests, security evidence bundle, desktop artifact checksums, GitHub artifact provenance attestations, release signing policy gate, desktop smoke evidence policy. | `scripts/generate-artifact-checksums.mjs`, `scripts/generate-security-evidence.mjs`, `scripts/verify-release-signing.mjs`, `scripts/verify-desktop-smoke-policy.mjs`, `.github/workflows/desktop-packaging.yml`, `docs/DESKTOP_PACKAGING.md`, `docs/DESKTOP_SMOKE_EVIDENCE.md`, `docs/RELEASE_SIGNING_POLICY.md`, `docs/AUDIT_EVIDENCE.md` | Add actual OS-native signed artifact evidence and completed per-OS smoke records before stable public binary distribution. |
| A09 Security Logging and Alerting Failures | Strong | In-app security/event logs for key actions and error handling, 200-entry local retention cap, clear-log flow, security logging policy gate, documented audit evidence. | `src/hooks/useSecurityLogs.ts`, `src/App.tsx`, `src/components/SecurityLogsModal.tsx`, `docs/SECURITY_LOGGING_POLICY.md`, `scripts/verify-security-logging-policy.mjs`, `test/unit/app.integration.test.tsx`, `docs/AUDIT_EVIDENCE.md` | Reassess logging when cloud sync, hosted sharing, or team audit trails are introduced. |
| A10 Mishandling of Exceptional Conditions | Strong | Centralized security error taxonomy, stable error codes, public-message redaction helper, guarded import/export errors, unlock failure paths, backup decrypt failure tests, Secure Share expiry/metadata rejection tests, settings error handling, release blockers, error taxonomy gate. | `src/lib/securityErrors.ts`, `docs/ERROR_TAXONOMY.md`, `scripts/verify-error-taxonomy.mjs`, `src/lib/backupCrypto.ts`, `src/lib/secureShareBundle.ts`, `src/components/Settings.tsx`, `test/unit/security-errors.test.ts`, `test/unit/crypto.test.ts`, `test/unit/secure-share-bundle.test.ts`, `test/unit/settings-database.test.tsx`, `docs/RELEASE_HARDENING.md` | Extend taxonomy before adding cloud sync, hosted sharing, team vault authorization, or remote API errors. |

## OWASP ASVS 5.0.0 Readiness Mapping

| ASVS Area | Status | Current Evidence | Notes |
| --- | --- | --- | --- |
| Architecture, Design, and Threat Modeling | Strong | `docs/SECURITY_MODEL.md`, `docs/THREAT_MODEL.md`, `docs/FUTURE_CRYPTO_ROADMAP.md` | Current local-first scope is clearly bounded. |
| Authentication | Strong | `src/lib/vault/VaultAuthService.ts`, `src/components/LockScreen.tsx`, `test/unit/vault-auth.test.ts`, `test/unit/lock-screen.test.tsx` | Local authentication is well covered; remote account auth is not implemented. |
| Session and Secret Lifecycle | Partial | `src/lib/secureSecretStore.ts`, `src/lib/clipboard.ts`, lock lifecycle tests | Add memory-clearing and desktop runtime smoke evidence where practical. |
| Access Control | Partial | App integration tests, locked service rejection tests | Future multi-user features require a new authorization layer. |
| Validation, Sanitization, and Encoding | Strong | `docs/VALIDATION_RULES.md`, importer and SQLite tests, TypeScript checks | Extend matrix before adding remote APIs or multi-user features. |
| Stored Cryptography | Strong | AES-GCM, Argon2id, encrypted backup tests, encrypted field persistence | External crypto review still recommended before sync/share features. |
| Error Handling and Logging | Strong | Error-state unit tests, centralized error taxonomy, public-message redaction helper, SecurityAudit UI, security logging policy gate, release checklist | Extend taxonomy for future remote and multi-user failures. |
| Data Protection and Privacy | Strong | Local-first architecture, no hosted account service, encrypted OPFS/backup design, privacy notice, telemetry-free disclosure | `docs/PRIVACY_NOTICE.md`, `docs/SECURITY_MODEL.md`, `src-tauri/tauri.conf.json`, `npm run security:privacy` |
| Communications | Strong | Local-first, desktop CSP `connect-src 'self'`, no cloud service | Network review must be reopened if sync or update channels are added. |
| Malicious Code and Dependencies | Partial | `npm audit`, lockfiles, security scan, workflow permission audit, dependency review, branch protection policy gate, SBOM, CI workflows | Enable branch protection in GitHub settings and add signed release provenance evidence. |
| Business Logic | Partial | E2E flows, component flows, mutation profiles | Add abuse-case tests for future sharing/sync once implemented. |
| Files and Resources | Strong | Backup/import tests, Secure Share bundle validation, explicit plaintext export acknowledgement, attachment handling tests | Maintain high-risk export warnings and offline-share limitations. |
| API and Web Service | Not Applicable | No public backend API in current release | Reassess when cloud sync or sharing is introduced. |
| Configuration | Strong | Tauri CSP, release hardening docs, build budget | Add automated workflow-permission checks. |

## OWASP MASVS Readiness Mapping

| MASVS Category | Status | Current Evidence | Notes |
| --- | --- | --- | --- |
| MASVS-STORAGE | Strong | Encrypted SQLite/OPFS rows, encrypted backup model, OS keychain integration | Browser fallback behavior must stay documented as lower assurance than desktop keychain. |
| MASVS-CRYPTO | Strong | AES-GCM, Argon2id, WebCrypto, encrypted TOTP/passkey metadata fields | Avoid custom crypto beyond well-reviewed composition. |
| MASVS-AUTH | Strong | Master password verification, device secret, WebAuthn flow, lock/reset tests | WebAuthn credentials are scoped to AegisVault origin only. |
| MASVS-NETWORK | Not Applicable | No cloud service or remote API in v6 local-first release | Becomes critical for sync/share/update channels. |
| MASVS-PLATFORM | Partial | Tauri command allowlist, OS keychain commands, CSP, signing policy, desktop smoke evidence policy | Add completed per-OS desktop smoke records and signed artifact evidence. |
| MASVS-CODE | Strong | TypeScript checks, coverage, mutation profiles, E2E release gate | Keep mutation profiles meaningful and release-bound. |
| MASVS-RESILIENCE | Partial | Build/release checks, checksum manifests, artifact attestations, signing policy | Add signed artifact evidence after certificates are configured. |
| MASVS-PRIVACY | Strong | Local-first, no hosted account, no cloud sync, privacy notice, no telemetry dependency documented | Keep privacy notice updated before adding networked features. |

## OWASP DSOVS Readiness Mapping

| DSOVS Area | Status | Current Evidence | Remaining Work |
| --- | --- | --- | --- |
| Risk Assessment | Strong | Threat model and release blockers | Keep updated for every major feature. |
| Security Requirements | Strong | Security model, hardening checklist, non-goals | Convert future sync/share requirements into acceptance criteria before coding. |
| Threat Modeling | Strong | `docs/THREAT_MODEL.md` | Add feature-specific models for cloud and sharing. |
| Hardcoded Secrets Detection | Strong | `npm run security:scan` | Extend scan rules as new security-sensitive files are added. |
| SAST | Partial | `npm run lint` TypeScript checks, CodeQL workflow | Triage and document CodeQL findings before release. |
| SCA | Strong | `npm audit` gates, lockfiles, Dependabot update policy, pull request dependency review, branch protection policy gate, CycloneDX SBOM | Keep dependency triage evidence current before release. |
| Security Test Coverage | Strong | Unit coverage, E2E release gate, mutation testing profiles | Publish coverage and mutation summaries with releases. |
| Secure Artifact Management | Partial | Desktop checksums, artifact manifest, security evidence bundle, GitHub artifact attestations, release signing policy audit, desktop smoke evidence policy | Add actual OS-native code signing evidence and completed per-OS smoke records. |
| Vulnerability Disclosure | Strong | `SECURITY.md`, `docs/VULNERABILITY_DISCLOSURE.md`, disclosure SLA, severity guide, advisory process, vulnerability disclosure policy gate | Keep advisory evidence current for confirmed public vulnerabilities. |
| Application Security Logging | Strong | SecurityAudit UI, app logs, local retention cap, clear-log flow, security logging policy gate | Reopen review before remote audit trails or team logging. |

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

1. Add OS-native signed artifact evidence for Windows and macOS after certificates are configured.
2. Enable GitHub branch protection settings to match `docs/BRANCH_PROTECTION_POLICY.md`.
3. Add privacy notice localization or public website copy if distribution expands beyond GitHub releases.
4. Complete and attach per-OS desktop smoke evidence for packaged artifacts.
5. Run an independent security review before enabling sync, sharing, team vaults, or post-quantum recipient-key backup.
