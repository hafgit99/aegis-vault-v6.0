# AegisVault Privacy Notice

Last reviewed: 2026-05-28

AegisVault v6 is a local-first password vault. This notice explains what the current release does and does not do with user data.

For Turkey/EU distribution review, see `docs/KVKK_GDPR_COMPLIANCE.md`.

## Summary

- AegisVault does not operate a hosted account service.
- AegisVault does not provide cloud sync in the current release.
- AegisVault does not send vault records to AegisVault servers.
- AegisVault does not include telemetry, analytics, advertising SDKs, or third-party payment widgets.
- Optional HIBP breach scanning sends only the first 5 characters of a locally computed SHA-1 password hash to `api.pwnedpasswords.com`; the password and full hash are never sent.
- Vault data is stored locally on the user's device.
- Encrypted backups and Secure Share bundles are created locally and only leave the device when the user exports or sends the files.

## Data Stored Locally

AegisVault stores the following data locally:

| Data | Storage | Notes |
| --- | --- | --- |
| Vault records | SQLite over OPFS / browser storage | User-visible vault fields are encrypted before persistence. |
| Attachments | Local encrypted file store | Files are encrypted before local persistence. |
| Settings | Local storage | Includes language, lock preferences, and display preferences. |
| Profile avatar/name | Local storage | Avatar can be a bundled preset, uploaded data URL, or user-provided image URL. |
| Device secret | Session memory or OS keychain on desktop where available | Browser fallback behavior has lower assurance than OS keychain storage. |

## Data Exported By User Action

The following actions create files or values that the user may move outside the device:

- Encrypted backup export.
- Plain-text backup export after explicit risk acknowledgement.
- Secure Share bundle export.
- Attachment download.
- Clipboard copy for passwords, TOTP codes, addresses, and donation wallet addresses. Desktop Windows builds request exclusion from Clipboard History and Cloud Clipboard synchronization where available; all builds still treat clipboard as user-controlled shared OS state.

The application cannot control files or clipboard values after the user moves them outside the app.

## Network Behavior

The current local-first release has no AegisVault-hosted backend API. The Tauri desktop CSP uses `connect-src 'self' https://api.pwnedpasswords.com` so the only external API allowed by default is the optional HIBP Pwned Passwords range endpoint. The optional Air-Gap mode blocks built-in network request APIs in the frontend runtime.

Known network-related exceptions:

- A user-provided remote avatar URL may be loaded by the browser or WebView as an image source.
- If the user manually starts HIBP breach scanning, AegisVault computes SHA-1 locally, sends only the first 5 hash characters to `https://api.pwnedpasswords.com/range/{prefix}`, requests padded responses, and compares suffixes locally.
- Development tooling may use localhost during `npm run dev`.
- Future auto-update, cloud sync, hosted sharing, or team vault features are not part of this release and require separate privacy and threat model updates.

## Telemetry And Analytics

AegisVault v6 does not intentionally collect:

- Usage analytics.
- Crash telemetry.
- Account identifiers.
- Vault metadata telemetry.
- Payment tracking events.
- Advertising identifiers.

If telemetry or hosted services are added in the future, this notice must be updated before release and the change must be listed in release notes.

## User Responsibilities

- Keep encrypted backup passwords and Secure Share transfer passwords private.
- Store emergency kits and backups safely.
- Avoid using remote avatar URLs if strict offline privacy is required.
- Avoid HIBP breach scanning if strict no-network operation is required; use Air-Gap mode for sealed local-only sessions.
- Treat plain-text exports as sensitive secrets.
- Delete exported files when they are no longer needed.

## Release Requirements

Before public release:

- `docs/PRIVACY_NOTICE.md` must reflect current network behavior.
- `docs/KVKK_GDPR_COMPLIANCE.md` must be reviewed for Turkey/EU distribution readiness.
- `src-tauri/tauri.conf.json` must keep desktop network access intentionally scoped.
- Any new cloud, team, hosted sharing, update, analytics, or telemetry feature must update this notice before implementation ships.
