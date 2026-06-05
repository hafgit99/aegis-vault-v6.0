# Error Taxonomy

This document defines how AegisVault classifies security-sensitive failures.

The goal is to keep user-facing feedback clear while giving developers and release reviewers stable error codes, severity, and categories.

## Principles

- Security-sensitive code should throw `AegisSecurityError` when a known failure class exists.
- User-facing messages may be localized, but the error code must remain stable.
- Logs and release evidence should prefer error codes and categories over raw exception details.
- Unknown errors must not expose passwords, transfer passwords, device secrets, TOTP secrets, tokens, keys, or credential material.
- New cloud sync, hosted sharing, team vault, and remote API features must add new taxonomy entries before implementation.

## Categories

| Category | Purpose |
| --- | --- |
| `auth` | Vault unlock, credential verification, missing authentication metadata, locked vault operations. |
| `crypto` | Backup encryption/decryption, payload authentication failures, key derivation failures. |
| `validation` | Import, Secure Share, TOTP, form, file, and structured input validation failures. |
| `storage` | Local storage, OPFS, IndexedDB, keychain, or database availability failures. |
| `network` | Air-gap and future network boundary failures. |
| `release` | Release, packaging, signing, or evidence failures. |
| `unknown` | Any security-sensitive failure that has not yet been classified. |

## Severity

| Severity | Use |
| --- | --- |
| `info` | Expected non-sensitive state transitions. |
| `warning` | User-correctable or validation-related failures. |
| `critical` | Destructive, authentication, integrity, or storage failures that need attention. |

## Current Implementation

The taxonomy implementation lives in `src/lib/securityErrors.ts`.

Current security-sensitive integrations include:

- backup encryption and decryption failures
- Secure Share bundle validation failures
- vault authentication metadata failures
- invalid master password failures
- locked vault write attempts
- master password rotation authentication failures

## User Message Safety

Use `publicSecurityErrorMessage(error)` when a raw exception may be shown to a user. The helper preserves safe known security errors and redacts unknown messages that look like they may include secret-bearing details.

## Verification

Run the policy verification gate before release:

```bash
npm run security:errors
```

The verification script confirms that taxonomy implementation, tests, release hardening, audit evidence, and OWASP mapping remain wired together.
