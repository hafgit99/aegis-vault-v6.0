# AegisVault Threat Model

This document defines the current local-first threat model for AegisVault v6.

## Assets

- Vault records: passwords, notes, cards, identities, passkey metadata, TOTP secrets.
- Master password and derived key material.
- Device secret.
- Encrypted backup files.
- Desktop release artifacts and checksums.
- User import files before and during parsing.

## Primary Security Goals

- Keep vault data confidential at rest.
- Detect tampering through authenticated encryption where cryptographic payloads are used.
- Avoid persisting plaintext master passwords or vault secrets.
- Keep the app functional offline.
- Make backup export/import behavior explicit and auditable.
- Ensure release artifacts are reproducible enough to verify through checksums and CI evidence.

## In-Scope Threats

| Threat | Mitigation |
| --- | --- |
| Theft of local SQLite/OPFS data | AES-GCM encrypted fields and Argon2id-derived vault key. |
| Theft of encrypted backup file | Backup password, Argon2id KDF, AES-GCM payload encryption. |
| Incorrect master password unlock attempt | Stored credential verification rejects invalid password. |
| Legacy plaintext metadata exposure in new records | New saves encrypt user-visible metadata fields. |
| Accidental clipboard persistence | Clipboard clear helper after secret copy operations. |
| Import of malformed backup data | Import parsing tests and guarded import UI flows. |
| Release artifact substitution | SHA-256 manifests and release workflow evidence. |
| Desktop remembered-secret exposure in localStorage | OS keychain path for Tauri desktop where available. |

## Out-of-Scope Threats

| Threat | Reason |
| --- | --- |
| Fully compromised operating system account | The attacker can read process memory, intercept input, and control the runtime. |
| Malicious browser extension or injected WebView runtime | Extensions/runtime injection can observe UI and secrets after unlock. |
| Hardware keylogger or screen capture malware | Outside application control. |
| User exports plaintext backup and shares it | The app warns; user assumes risk after explicit acknowledgement. |
| Cloud sync conflict or remote account takeover | No cloud sync or account service exists in the current release. |
| Multi-user authorization abuse | Team vault authorization is not implemented yet. |

## Abuse Cases To Re-Test Before Release

- Unlock with wrong password and correct device secret.
- Unlock with correct password and wrong device secret.
- Change master password with invalid old password.
- Export encrypted backup and verify encrypted payload shape.
- Attempt encrypted backup import with wrong password.
- Import malformed CSV/JSON data.
- Save and reload login, card, note, identity, passkey, and TOTP records.
- Clear local storage and verify vault reset behavior.
- Desktop package launch on Windows, macOS, and Linux.

## Future Threat Model Extensions

The following features require separate review before implementation:

- Device-to-device vault transfer.
- Secure share links.
- Cloud sync.
- Team/organization vaults.
- ML-KEM-768 or hybrid post-quantum recipient-key backup.

The likely future direction is hybrid encryption: classical ECDH or platform public keys plus ML-KEM for key establishment, then AES-GCM for actual vault payload encryption.
