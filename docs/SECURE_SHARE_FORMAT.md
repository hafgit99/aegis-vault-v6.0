# AegisVault Secure Share Format

This document defines the local-first Secure Share bundle used for offline vault transfer. It is a format contract for maintainers, release reviewers, and future sync/share design work.

Secure Share is not cloud sync, a hosted sharing link, or a team vault authorization system. It creates a local encrypted JSON file that the user can send out-of-band together with a separately shared transfer password.

## Security Goals

- Keep shared records encrypted at rest and in transit as a file.
- Require a transfer password that is independent from the active vault password.
- Reject expired, unsupported, malformed, or tampered bundles before import.
- Bind the decrypted payload to a public integrity manifest in current bundles.
- Avoid exporting deleted vault records.
- Make the bundle self-describing enough for safe future migration.

## Version Policy

Current writer version: `1.1`.

Supported reader versions:

| Version | Status | Notes |
| --- | --- | --- |
| `1.1` | Current | Includes an integrity manifest with SHA-256 checksum over the encrypted plaintext before encryption. |
| `1.0` | Legacy readable | Accepted for backward compatibility, but it has no manifest checksum. UI should label it as a legacy bundle. |

New exports must use `1.1`. New validation rules must preserve explicit backward compatibility decisions instead of silently widening accepted input.

## Public Envelope

Secure Share bundles are JSON objects with this public envelope:

```json
{
  "app": "AegisVault",
  "kind": "secure-share-bundle",
  "version": "1.1",
  "encrypted": true,
  "createdAt": "2026-05-28T00:00:00.000Z",
  "expiresAt": "2026-06-04T00:00:00.000Z",
  "itemCount": 1,
  "manifest": {
    "version": "1.1",
    "checksumAlgorithm": "sha-256",
    "checksum": "64-lowercase-hex-sha256",
    "itemCount": 1,
    "createdAt": "2026-05-28T00:00:00.000Z",
    "expiresAt": "2026-06-04T00:00:00.000Z"
  },
  "kdf": {
    "algorithm": "argon2id",
    "version": 1
  },
  "salt": "...",
  "iv": "...",
  "data": "..."
}
```

The envelope is intentionally not secret. It may reveal that a bundle exists, when it was created, when it expires, the format version, and how many records it contains. Record titles, usernames, URLs, notes, passwords, TOTP secrets, card data, identity data, passkey metadata, and history remain inside the encrypted `data` payload.

## Integrity Manifest

For `v1.1`, `manifest.checksum` is `SHA-256(JSON.stringify({ entries }))` encoded as 64 lowercase hexadecimal characters. It is computed before AES-GCM encryption and verified after authenticated decryption.

The manifest is not a replacement for AES-GCM authentication. AES-GCM still protects ciphertext integrity. The manifest gives the import workflow a stable, visible evidence field so the UI and release tests can prove that the decrypted payload matches the declared transfer manifest.

Validation must reject a `v1.1` bundle when:

- `manifest` is missing.
- `manifest.version` is not `1.1`.
- `manifest.checksumAlgorithm` is not `sha-256`.
- `manifest.checksum` is not a 64-character hex string.
- `manifest.itemCount`, `manifest.createdAt`, or `manifest.expiresAt` does not match the public envelope.
- The SHA-256 checksum of decrypted plaintext does not match `manifest.checksum`.

## Encrypted Payload

The encrypted plaintext has this internal shape:

```json
{
  "entries": []
}
```

The `entries` array contains sanitized `VaultEntry` records. Deleted records are filtered out during export. Any imported entry is normalized so `isDeleted` is false and `deletedAt` is removed.

## Validation Order

The import path should validate in this order:

1. Reject unsupported envelope fields before decryption.
2. Reject invalid creation date, expiry date, item count, and `v1.1` manifest metadata.
3. Reject expired bundles before password-based decryption.
4. Decrypt with the transfer password and KDF metadata.
5. Verify the `v1.1` manifest checksum against the decrypted plaintext.
6. Parse plaintext JSON.
7. Reject payloads without `entries[]`.
8. Reject payloads where `entries.length` differs from envelope `itemCount`.
9. Sanitize imported entries before handing them to the import review UI.

## Validation Rules

| Rule | Failure |
| --- | --- |
| `app` must be `AegisVault` | Unsupported bundle |
| `kind` must be `secure-share-bundle` | Unsupported bundle |
| `version` must be `1.0` or `1.1` | Unsupported bundle |
| `encrypted` must be `true` | Unsupported bundle |
| `createdAt` must be a valid date string | Invalid metadata |
| `itemCount` must be a positive safe integer | Invalid metadata |
| `v1.1` must include a valid manifest | Invalid metadata |
| Manifest envelope fields must match public envelope fields | Invalid metadata |
| `expiresAt`, when present, must be a valid date string | Invalid expiry |
| `expiresAt`, when present, must be in the future | Expired bundle |
| Decrypted payload checksum must match `manifest.checksum` | Manifest mismatch |
| Decrypted payload must contain `entries[]` | Invalid payload |
| Decrypted `entries.length` must equal envelope `itemCount` | Count mismatch |

Expired bundles are rejected before password-based decryption is attempted.

## Import UX Evidence

The import review and import result screens should display:

- Total parsed records.
- Selected records.
- Skipped records after import.
- Conflict strategy: merge or replace.
- KDF algorithm and legacy KDF status.
- Secure Share version.
- Secure Share expiry.
- Manifest verification status.
- Short checksum prefix for verified `v1.1` bundles.

Legacy `v1.0` bundles should be importable but must be labeled as legacy because they do not carry manifest checksum evidence.

## User Responsibilities

- Send the JSON bundle and transfer password through separate channels.
- Prefer short expiry windows for sensitive records.
- Avoid sending Secure Share bundles to untrusted devices.
- Delete shared files after import.

## Non-Goals

Secure Share v1.1 does not provide:

- Sender identity verification.
- Recipient public-key encryption.
- Revocation after a file leaves the sender device.
- Access control for multiple users.
- Audit logs across devices.
- Cloud-hosted share links.
- Conflict resolution or sync.

These capabilities belong to future cloud sync, device transfer, team vault, or post-quantum recipient-key projects and require separate threat models.

## Release Evidence

Implementation:

- `src/lib/secureShareBundle.ts`
- `src/lib/importWorkflow.ts`
- `src/components/settings/ImportSettingsPanel.tsx`
- `src/components/Settings.tsx`
- `src/components/DetailPanel.tsx`
- `src/components/DatabaseModal.tsx`

Verification:

- `test/unit/secure-share-bundle.test.ts`
- `test/unit/import-workflow.test.ts`
- `test/unit/settings-database.test.tsx`
- `test/unit/component-flows.test.tsx`

Recommended release commands:

```bash
npm run test:unit -- secure-share-bundle import-workflow settings-database
npm run test:coverage
npm run lint
npm run build
```
