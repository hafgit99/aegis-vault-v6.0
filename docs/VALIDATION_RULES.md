# Validation Rules Matrix

This matrix defines how AegisVault validates user-controlled input in the current local-first release. It is a release review aid and a baseline for future cloud sync, team vaults, and hosted sharing work.

## Principles

- Prefer structured parsers over ad hoc string splitting.
- Reject unsupported encrypted formats before attempting import.
- Keep plaintext export behind explicit user acknowledgement.
- Keep encrypted transfer formats versioned and self-describing.
- Normalize imported records before persistence.
- Avoid rendering user content as HTML.
- Keep local profile customization bounded and recoverable.

## Import Inputs

| Input | Accepted Shape | Validation / Normalization | Evidence |
| --- | --- | --- | --- |
| AegisVault encrypted backup | JSON with `encrypted: true`, `data`, `salt`, `iv`, optional KDF metadata | Requires restore password, decrypts through backup crypto, parses JSON after authenticated decryption | `src/components/Settings.tsx`, `src/components/DatabaseModal.tsx`, `test/unit/settings-database.test.tsx` |
| AegisVault plain backup | JSON with `encrypted: false` and `vault[]` | Only accepted when plain source is selected | `test/unit/settings-database.test.tsx` |
| Secure Share bundle | Versioned JSON envelope with `kind: secure-share-bundle`; current `v1.1` includes SHA-256 manifest | Validates version, `createdAt`, `expiresAt`, `itemCount`, expiry, manifest metadata, payload checksum, payload shape, and count match | `docs/SECURE_SHARE_FORMAT.md`, `src/lib/secureShareBundle.ts`, `test/unit/secure-share-bundle.test.ts` |
| CSV imports | `.csv` text with header row | Parsed through `parseCSV`; quoted commas and escaped quotes are supported | `src/lib/importer.ts`, `test/unit/importer.test.ts` |
| Bitwarden / 1Password / KeePass | Known JSON or CSV export shapes | Source-specific mapping with fallback title generation and record type normalization | `src/lib/importer.ts`, `test/fixtures/`, `test/unit/importer.test.ts` |
| Import selection | Parsed record indices | Only selected records are converted and imported; zero selected records are rejected | `test/unit/settings-database.test.tsx` |

## Export Inputs

| Input | Accepted Shape | Validation / Normalization | Evidence |
| --- | --- | --- | --- |
| Encrypted backup password | Non-empty, minimum 4 characters, matching confirmation | Produces Argon2id + AES-GCM encrypted payload | `src/components/Settings.tsx`, `src/components/DatabaseModal.tsx`, `test/unit/settings-database.test.tsx` |
| Secure Share transfer password | Non-empty, minimum 4 characters, matching confirmation | Produces `v1.1` Secure Share bundle with manifest checksum; deleted records are filtered out | `src/lib/secureShareBundle.ts`, `test/unit/secure-share-bundle.test.ts`, `test/unit/component-flows.test.tsx` |
| Secure Share expiry | `1`, `7`, `30`, or `never` | Converts finite values to ISO `expiresAt`; omitted for `never` | `src/components/Settings.tsx`, `src/components/DetailPanel.tsx`, `test/unit/component-flows.test.tsx` |
| Plain backup acknowledgement | Explicit checkbox/action | Plain export is blocked until the risk acknowledgement is accepted | `test/unit/settings-database.test.tsx` |

## Authentication Inputs

| Input | Accepted Shape | Validation / Normalization | Evidence |
| --- | --- | --- | --- |
| Master password strength analysis | User-entered password string | zxcvbn analysis is augmented with Turkish common words, teams, cities, national dates, and local keyboard walks such as `asdfgh`, `qwerty`, and `zxcvbn`; risky local combinations receive a score cap | `src/lib/passwordStrength.ts`, `src/lib/passwordLocaleDictionaries.ts`, `test/unit/password-locale-dictionaries.test.ts` |
| HIBP Pwned Passwords check | Saved login passwords, user-started scan | Computes SHA-1 locally, sends only the first 5 hash characters to the range API, discards non-matching suffixes, and persists only exposure counts per record | `src/lib/hibpPwnedPasswords.ts`, `src/components/SecurityAudit.tsx`, `test/unit/hibp-pwned-passwords.test.ts` |

## Vault Entry Inputs

| Input | Accepted Shape | Validation / Normalization | Evidence |
| --- | --- | --- | --- |
| Entry title | Non-empty string for save | Required before creating a record | `src/components/AddEntryModal.tsx`, `test/unit/component-flows.test.tsx` |
| Login URL | User text | Stored as text and rendered by React; not executed as HTML | `src/components/AddEntryModal.tsx`, `src/components/DetailPanel.tsx` |
| TOTP secret | Base32-compatible secret | Generated secrets use local crypto; invalid manual secrets surface errors | `src/lib/totp.ts`, `test/unit/totp.test.ts`, `test/unit/component-flows.test.tsx` |
| Passkey domain/user | User text | WebAuthn credential creation is scoped to the AegisVault origin and stored as metadata | `src/lib/webauthnPasskey.ts`, `test/unit/webauthn-passkey.test.ts` |
| Attachments | User-selected files | Stored through encrypted file store; missing files fail safely | `src/lib/fileStore.ts`, `test/unit/component-flows.test.tsx` |
| Identity numeric fields | User text | Normalized in component flow tests before save | `test/unit/component-flows.test.tsx` |

## Search And Filter Inputs

| Input | Accepted Shape | Validation / Normalization | Evidence |
| --- | --- | --- | --- |
| Search query | User text | Lowercase string comparison against title, subtitle, and username; no HTML rendering | `src/App.tsx`, `test/unit/app.integration.test.tsx` |
| Category filter | Known local filter identifiers | Filter values are selected from fixed UI controls | `src/App.tsx`, `test/unit/app.integration.test.tsx` |
| Trash search | User text | Lowercase string comparison on deleted entries only | `src/components/TrashBin.tsx`, `test/unit/component-flows.test.tsx` |

## Profile Inputs

| Input | Accepted Shape | Validation / Normalization | Evidence |
| --- | --- | --- | --- |
| Display name | Trimmed non-empty string | Empty names are ignored; saved names are rendered as React text | `src/components/ProfileModal.tsx`, `test/unit/component-flows.test.tsx` |
| Avatar preset | Bundled data URL | Uses local generated avatar presets | `src/lib/avatarPresets.ts`, `test/unit/avatar-presets.test.ts` |
| Uploaded avatar | Browser image file | Downscaled to 150x150 JPEG data URL where canvas is available | `src/components/ProfileModal.tsx`, `test/unit/component-flows.test.tsx` |
| Custom avatar URL | String beginning with `http` | Accepted as an image source; legacy remote presets normalize to bundled default on app load | `src/components/ProfileModal.tsx`, `src/lib/avatarPresets.ts`, `test/unit/avatar-presets.test.ts` |

## Release Review Checklist

- New import source includes parser tests, malformed input tests, and source-switch reset tests.
- New export format is documented, versioned, and covered by round-trip tests.
- New profile or settings field has a validation rule in this matrix.
- New search/filter behavior does not render user input as HTML.
- New cloud, team, or hosted-share input must extend this matrix before implementation.
