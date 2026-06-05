# KVKK / GDPR Compliance Note

This document summarizes the local-first privacy posture for distributing AegisVault in Turkey and the EU. It is not legal advice; it is a technical and operational checklist for release review.

## Product Position

AegisVault v6 is a local-first password vault. By default, vault records, master-password metadata, device-secret state, backups, Secure Share bundles, and diagnostics stay on the user's device. AegisVault does not operate a cloud account system, hosted recovery service, analytics endpoint, remote sync service, or team-vault server in the current version.

## Data Roles

| Area | Current role |
| --- | --- |
| Local vault records | User-controlled local data. |
| Desktop/browser storage | Storage medium selected by the user and local OS/browser. |
| Encrypted backups and Secure Share files | User-created export files controlled by the user after download. |
| GitHub releases and artifacts | Distribution channel for application binaries, not vault data processing. |

If a future cloud sync, hosted share link, telemetry, license server, or team-vault backend is added, AegisVault must define a data controller/processor model before release.

## Personal Data Categories

Potential personal data stored by the user may include usernames, passwords, URLs, notes, identity fields, card metadata, TOTP secrets, passkey metadata, attachments, and import/export files. These are encrypted at rest inside the local vault, but exported plain-text backups remain user-visible and high risk.

## Lawful Basis and Consent

Because the current application does not receive or process user vault data on a remote service, the main compliance requirement is transparent notice, privacy-by-design defaults, and explicit consent for high-risk local actions such as plain-text export, legacy backup import, database wipe, and Secure Share file creation.

## User Rights Support

AegisVault supports practical data-subject controls locally:

- Access: users can view stored records after unlocking the vault.
- Portability: users can export encrypted backups and supported importer/exporter formats.
- Erasure: users can delete entries, empty trash, or wipe the local database.
- Rectification: users can edit vault entries locally.
- Restriction: users can keep the app offline and disable network access with Air-Gap mode.

## Retention

Vault data remains until the user deletes records, wipes the database, removes browser/app data, or deletes backup/share files outside the app. Security logs are capped locally and must not include passwords, device secrets, backup passwords, transfer passwords, TOTP secrets, or cryptographic keys.

## Cross-Border Transfer

Current local-first operation does not transfer vault data across borders. GitHub release downloads transfer application artifacts only. Future cloud sync or team-vault functionality must include explicit region, processor, retention, and cross-border transfer documentation before release.

## Breach and Incident Handling

For the current product, likely incidents are release integrity issues, compromised artifacts, dependency vulnerabilities, or local user-device compromise. The release process should keep SBOM, provenance, signing evidence, vulnerability disclosure, and branch-protection evidence attached to each release.

## Release Checklist

- Privacy notice is current and matches product behavior.
- Plain-text export remains behind explicit risk acknowledgement.
- Legacy KDF import requires user confirmation.
- SBOM is generated in CI before release artifacts are accepted.
- Security logs and error messages are checked for secret leakage.
- Branch protection and required status checks match `docs/BRANCH_PROTECTION_POLICY.md`.
- Any new hosted feature receives a separate DPIA-style review before release.
