# AegisVault Threat Model

This document defines the current local-first threat model for AegisVault v6.

## Assets

- Vault records: passwords, notes, cards, identities, passkey metadata, TOTP secrets.
- Master password and derived key material.
- Device secret.
- Encrypted backup files.
- Secure Share bundle files and transfer passwords.
- Desktop release artifacts and checksums.
- User import files before and during parsing.
- Android Autofill pending fill and future pending save payloads.

## Primary Security Goals

- Keep vault data confidential at rest.
- Detect tampering through authenticated encryption where cryptographic payloads are used.
- Avoid persisting plaintext master passwords or vault secrets.
- Keep the app functional offline.
- Make backup export/import behavior explicit and auditable.
- Make Secure Share export/import behavior explicit, bounded, and reject malformed or expired packages.
- Ensure release artifacts are reproducible enough to verify through checksums and CI evidence.

## In-Scope Threats

| Threat | Mitigation |
| --- | --- |
| Theft of local SQLite/OPFS data | AES-GCM encrypted fields and Argon2id-derived vault key. |
| Theft of encrypted backup file | Backup password, Argon2id KDF, AES-GCM payload encryption. |
| Theft of Secure Share bundle without transfer password | Transfer password, Argon2id KDF, AES-GCM payload encryption. |
| Import of expired or tampered Secure Share bundle | Bundle version, date, item-count, expiry, v1.1 SHA-256 manifest verification, and encrypted payload validation. |
| Incorrect master password unlock attempt | Stored credential verification rejects invalid password. |
| Legacy plaintext metadata exposure in new records | New saves encrypt user-visible metadata fields. |
| Accidental clipboard persistence | Windows desktop sensitive clipboard flags for history/cloud-sync exclusion where available, plus clipboard clear helper after secret copy operations. |
| Import of malformed backup data | Import parsing tests and guarded import UI flows. |
| Release artifact substitution | SHA-256 manifests and release workflow evidence. |
| Desktop remembered-secret exposure in localStorage | OS keychain path for Tauri desktop where available. |
| Autofill credential fill to the wrong target | Android Autofill authentication result requires a one-time approved payload whose target must match the original domain or package before a dataset is returned. |
| Accidental Android Autofill credential capture | Native save capture only stages a short-lived app-private payload and cannot create or update records without explicit in-app confirmation. |

## Out-of-Scope Threats

| Threat | Reason |
| --- | --- |
| Fully compromised operating system account | The attacker can read process memory, intercept input, and control the runtime. |
| Malicious browser extension or injected WebView runtime | Extensions/runtime injection can observe UI and secrets after unlock. |
| Hardware keylogger or screen capture malware | Outside application control. |
| User exports plaintext backup and shares it | The app warns; user assumes risk after explicit acknowledgement. |
| User shares Secure Share bundle and transfer password through the same compromised channel | Secure Share requires separate channels, but user channel choice is outside application control. |
| Revoking a Secure Share bundle after it leaves the device | Secure Share is an offline file format, not a hosted share service. |
| Cloud sync conflict or remote account takeover | No cloud sync or account service exists in the current release. |
| Multi-user authorization abuse | Team vault authorization is not implemented yet. |

## Abuse Cases To Re-Test Before Release

- Unlock with wrong password and correct device secret.
- Unlock with correct password and wrong device secret.
- Change master password with invalid old password.
- Export encrypted backup and verify encrypted payload shape.
- Attempt encrypted backup import with wrong password.
- Export Secure Share bundle and verify no plaintext record fields appear in the file.
- Import Secure Share bundle with correct password.
- Attempt Secure Share import with expired, malformed, unsupported-version, manifest-checksum tampered, and item-count tampered bundles.
- Import malformed CSV/JSON data.
- Save and reload login, card, note, identity, passkey, and TOTP records.
- Clear local storage and verify vault reset behavior.
- Desktop package launch on Windows, macOS, and Linux.
- Android Autofill fill request on locked vault, multiple matches, wrong domain, passkey-only record, and canceled selection.

## Future Threat Model Extensions

The following features require separate review before implementation:

- Device-to-device vault transfer.
- Android Autofill save prompt expansion beyond guarded local staging. See `docs/AUTOFILL_SAVE_THREAT_MODEL.md`.
- Secure share links.
- Cloud sync.
- Team/organization vaults.
- ML-KEM-768 or hybrid post-quantum recipient-key backup.

The likely future direction is hybrid encryption: classical ECDH or platform public keys plus ML-KEM for key establishment, then AES-GCM for actual vault payload encryption.
