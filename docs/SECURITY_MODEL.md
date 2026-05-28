# AegisVault Security Model

This document describes the current v6 local-first security architecture. It is intended for maintainers, release reviewers, and external security auditors.

## Security Objective

AegisVault protects user vault records on the local device with authenticated encryption, hardened password-based key derivation, local database persistence, and optional desktop operating-system secret storage.

The current product is intentionally local-first. It does not operate a cloud service, sync server, remote recovery service, or hosted account system.

## Trust Boundaries

| Boundary | Trusted For | Notes |
| --- | --- | --- |
| Browser or Tauri WebView | WebCrypto, WebAuthn, IndexedDB/OPFS, clipboard API | A malicious runtime or extension is out of scope. |
| Local operating system account | Process isolation, desktop keychain access control | Full OS compromise is out of scope. |
| AegisVault frontend code | UI, key flow orchestration, import/export handling | Must pass lint, coverage, E2E, and build gates before release. |
| OPFS / IndexedDB | Local encrypted database and file storage | Stored vault content must remain encrypted at rest. |
| OS keychain | Remembered device secret on desktop | Browser builds fall back to session/local storage behavior. |

## Cryptographic Components

| Component | Current Design | Purpose |
| --- | --- | --- |
| Vault encryption | AES-GCM via WebCrypto | Authenticated encryption for vault fields and structured payloads. |
| Master key derivation | Argon2id-derived material plus HKDF-style key flow in vault auth service | Password and device secret based unlock model. |
| Password verification | Hardened credential metadata, not plaintext master password storage | Unlock verification without persisting the master password. |
| Encrypted backups | Argon2id backup KDF plus AES-GCM payload encryption | Portable encrypted export/import. Legacy PBKDF2 backup import is retained only for compatibility. |
| Device secret | Session memory by default; optional OS keychain on desktop; browser fallback for remembered devices | Second factor in the local unlock model. |
| Passkeys | WebAuthn `navigator.credentials.create/get` for AegisVault origin credentials | Authenticator-backed passkey metadata storage and verification. |
| TOTP | RFC 6238-compatible HMAC-based code generation | Optional one-time codes stored as encrypted vault fields. |
| Clipboard | Secret writes are cleared after a short delay where supported | Reduces accidental long-lived clipboard exposure. |

## Data At Rest

Vault rows are stored in SQLite over OPFS. User-visible metadata such as title, username, website, category, password, notes, TOTP secret, card details, identity details, and passkey metadata are encrypted before persistence.

Legacy plaintext fallback handling exists only to keep older local vault rows readable during migration. New saves use encrypted metadata placeholders for exposed SQLite columns.

## Backup Model

Encrypted backups require a backup password. The backup password is intentionally independent from the active master password unless the user manually chooses the same value.

Backups include KDF metadata so future imports know whether to use the modern Argon2id path or the legacy PBKDF2 compatibility path.

Plain-text backup export is a high-risk user action and must remain behind explicit acknowledgement.

## Desktop Model

The desktop shell uses Tauri. The remembered device secret is stored through OS keychain commands when available. Tauri commands are intentionally narrow:

- Store device secret.
- Read device secret.
- Delete device secret.

The frontend CSP blocks external connections by default with `connect-src 'self'`.

## Current Non-Goals

AegisVault v6 does not yet provide:

- Cloud sync.
- Team vaults.
- Secure share links.
- Post-quantum recipient-key sharing.
- Hosted recovery.
- Multi-device conflict resolution.

These features require a separate sync/share threat model before implementation.

## Security Claim Policy

User-facing claims should be concrete and testable. Prefer wording such as:

- "AES-GCM authenticated encryption"
- "Argon2id-based key derivation"
- "local-first encrypted storage"
- "WebAuthn-backed authenticator flow"

Avoid unverifiable marketing phrases such as "unbreakable", "military proof", "zero risk", or "perfect security".
