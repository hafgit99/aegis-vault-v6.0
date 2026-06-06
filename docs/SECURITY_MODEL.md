# AegisVault Security Model

This document describes the current v6 local-first security architecture. It is intended for maintainers, release reviewers, and external security auditors.

## Security Objective

AegisVault protects user vault records on the local device with authenticated encryption, hardened password-based key derivation, local database persistence, and optional desktop operating-system secret storage.

The current product is intentionally local-first. It does not operate a cloud service, sync server, remote recovery service, or hosted account system.

The current privacy disclosure is documented in `docs/PRIVACY_NOTICE.md`.

## Trust Boundaries

| Boundary | Trusted For | Notes |
| --- | --- | --- |
| Browser or Tauri WebView | WebCrypto, WebAuthn, IndexedDB/OPFS, clipboard API | A malicious runtime or extension is out of scope. |
| Local operating system account | Process isolation, desktop keychain access control | Full OS compromise is out of scope. |
| AegisVault frontend code | UI, key flow orchestration, import/export handling | Must pass lint, coverage, E2E, and build gates before release. |
| OPFS / IndexedDB | Local encrypted database and file storage | Stored vault content must remain encrypted at rest. |
| OS keychain and biometric secure storage | Remembered device secret and optional biometric unlock bundle on desktop | Browser builds fall back to session/local storage behavior and do not expose biometric unlock. |

## Cryptographic Components

| Component | Current Design | Purpose |
| --- | --- | --- |
| Vault encryption | AES-GCM via WebCrypto | Authenticated encryption for vault fields and structured payloads. |
| Master key derivation | Argon2id-derived material plus HKDF-style key flow in vault auth service | Password and device secret based unlock model. |
| Password verification | Hardened credential metadata, not plaintext master password storage | Unlock verification without persisting the master password. |
| Encrypted backups | Argon2id backup KDF plus AES-GCM payload encryption | Portable encrypted export/import. Legacy PBKDF2 backup import is retained only for compatibility. |
| Secure Share bundles | Argon2id transfer-password KDF plus AES-GCM payload encryption plus v1.1 SHA-256 payload manifest | Offline record transfer through a local encrypted JSON file with version, expiry, manifest checksum, and item-count validation. |
| Device secret | Session memory by default; optional OS keychain on desktop; browser fallback for remembered devices | Second factor in the local unlock model. |
| Biometric unlock | Optional Tauri desktop plugin storage gated by Windows Hello, Touch ID, Face ID, or platform equivalent | Convenience unlock after an initial successful password unlock; not a cryptographic replacement for the master password. |
| HIBP breach scanning | Local SHA-1 hashing plus Pwned Passwords k-anonymity range lookup | Sends only the first 5 hash characters to HIBP; suffix matching and pwned count persistence happen locally. |
| Passkeys | WebAuthn `navigator.credentials.create/get` for AegisVault origin credentials | Authenticator-backed passkey metadata storage and verification. |
| TOTP | RFC 6238-compatible HMAC-based code generation | Optional one-time codes stored as encrypted vault fields. |
| Clipboard | Secret writes use desktop sensitive clipboard flags where available and are cleared after a short delay | Reduces accidental long-lived clipboard exposure; clipboard is still a shared OS surface. |

## HKDF Salt Decision

The vault master-key flow uses WebCrypto HKDF with SHA-256 after the password and device secret have already been hardened with Argon2id and a per-vault random salt. The HKDF call intentionally uses an explicit 32-byte zero salt and a versioned `info` value that binds the derived AES key to the AegisVault vault-auth context.

This follows the RFC 5869 model where salt is optional and, when absent, is treated as a string of zeros with HashLen length. AegisVault makes that default explicit instead of relying on implicit runtime behavior. The security boundary is the Argon2id extraction step plus the device secret; HKDF is used as a domain-separated expander for the final WebCrypto key material.

Any future key hierarchy change, multi-device transfer, or recipient-key backup feature must revisit this decision and document whether HKDF should receive a new random salt or context-specific salt.

## Data At Rest

Vault rows are stored in SQLite over OPFS. User-visible metadata such as title, username, website, category, password, notes, TOTP secret, card details, identity details, and passkey metadata are encrypted before persistence.

Legacy plaintext fallback handling exists only to keep older local vault rows readable during migration. New saves use encrypted metadata placeholders for exposed SQLite columns.

## Backup Model

Encrypted backups require a backup password. The backup password is intentionally independent from the active master password unless the user manually chooses the same value.

Backups include KDF metadata so future imports know whether to use the modern Argon2id path or the legacy PBKDF2 compatibility path.

Plain-text backup export is a high-risk user action and must remain behind explicit acknowledgement.

## Secure Share Model

Secure Share bundles are local encrypted transfer files for selected active records. They are not hosted share links and do not provide revocation after the file leaves the device.

The public bundle envelope includes app identity, bundle kind, format version, creation time, optional expiry time, item count, KDF metadata, salt, IV, and encrypted data. Current `v1.1` bundles also include a SHA-256 integrity manifest over the decrypted plaintext. Import rejects unsupported versions, malformed dates, invalid item counts, invalid manifests, expired bundles, manifest checksum mismatches, invalid encrypted payloads, and payload count mismatches.

The format contract is documented in `docs/SECURE_SHARE_FORMAT.md`.

## Desktop Model

The desktop shell uses Tauri. The remembered device secret is stored through OS keychain commands when available. Tauri commands are intentionally narrow:

- Store device secret.
- Read device secret.
- Delete device secret.

Desktop builds also support optional hardware biometric unlock through the Tauri biometry plugin. A biometric unlock bundle is created only after the user has already completed a normal setup or unlock flow and explicitly enables the hardware biometric option while device remembering is active. The bundle contains the material needed to reopen the local vault on that same desktop profile and is stored behind the operating system biometric gate.

Security properties and limits:

- Biometric unlock is a local convenience layer, not a remote account recovery mechanism.
- AegisVault does not receive the biometric template; verification is handled by the operating system.
- If the user resets local vault keys, the biometric unlock bundle is deleted with the remembered device secret.
- If the operating system account or biometric secure storage is compromised, this feature should be treated as compromised too.
- Users who require maximum separation can leave biometric unlock disabled and continue using the master password plus device secret flow.

The frontend CSP blocks arbitrary external connections. The only default external API exception is `https://api.pwnedpasswords.com` for user-started HIBP k-anonymity password checks. Air-Gap mode also blocks arbitrary external runtime requests while preserving this range-lookup exception, so strict no-network sessions should not start HIBP scanning.

## Clipboard Model

Clipboard copy remains an inherently shared operating-system action. AegisVault cannot guarantee that every local application, accessibility tool, remote access product, or clipboard manager is prevented from reading the current clipboard contents.

For desktop Windows builds, AegisVault writes secrets through a Tauri command that places `CF_UNICODETEXT` plus Windows registered clipboard formats that request exclusion from local Clipboard History and Cloud Clipboard synchronization. Browser builds and unsupported desktop platforms fall back to the Web Clipboard API and still use timed clearing.

All secret clipboard writes are scheduled for clearing after a short delay. If native sensitive flags or clearing fail, AegisVault records a local warning event and keeps the user-visible clipboard-clear warning path active.

## Current Non-Goals

AegisVault v6 does not yet provide:

- Cloud sync.
- Team vaults.
- Secure share links.
- Hosted sharing services.
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
