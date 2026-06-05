# Release Signing Policy

This policy defines how AegisVault handles desktop release signing, artifact integrity, and unsigned release disclosure.

## Signing Modes

The `Desktop Packaging` workflow supports these manual signing modes:

| Mode | Behavior | Required Secrets |
| --- | --- | --- |
| `unsigned` | Builds unsigned community build artifacts for Windows, macOS, and Linux. | None |
| `windows` | Requires Windows signing secrets on the Windows runner. | `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD` |
| `macos` | Requires Apple Developer ID signing and notarization secrets on the macOS runner. | `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` |
| `all` | Requires both Windows and macOS signing secrets. | All Windows and Apple secrets |

Signed modes must fail before packaging if required secrets are missing.

## OS-Native Signing Implementation

- Windows signed releases import the base64-encoded `WINDOWS_CERTIFICATE` PFX on the Windows runner, sign generated `.exe` and `.msi` artifacts with Authenticode/SHA-256, timestamp through a trusted timestamp server, and verify signatures before upload.
- macOS signed releases import the base64-encoded `APPLE_CERTIFICATE` Developer ID certificate into a temporary keychain before packaging, then submit generated DMG artifacts to Apple notarization and staple the notarization ticket before upload.
- Signing certificates and passwords must stay in GitHub Actions secrets. They must never be committed, printed, uploaded as artifacts, or copied into release notes.

## Artifact Integrity Requirements

Every desktop release artifact set must include:

- `SHA256SUMS.txt`
- `artifact-manifest.json`
- GitHub artifact provenance attestation
- GitHub SBOM attestation
- CycloneDX SBOM artifact

GitHub attestations do not replace OS-native code signing. They prove repository build provenance; Windows Authenticode and Apple Developer ID signing remain required for native OS trust prompts.

## Public Release Rules

- Unsigned artifacts may be used for internal validation and early public testing only when release notes clearly state **unsigned community build** for every affected platform.
- Stable public desktop releases should use signed Windows and signed/notarized macOS artifacts once certificates are available.
- Linux artifacts must ship with checksums and provenance attestations; additional distro signing can be added later.
- Release notes must disclose signing mode without exposing secret values.
- Artifact tables and download descriptions must not imply OS-native trust for unsigned community build artifacts.
- Public release notes must use [RELEASE_NOTES_TEMPLATE.md](RELEASE_NOTES_TEMPLATE.md).

## Local Verification

After a desktop build:

```bash
npm run desktop:checksums
npm run security:signing
```

## Required Workflow Properties

The desktop workflow must retain:

- `contents: read`
- `id-token: write`
- `attestations: write`
- `artifact-metadata: write`
- explicit signing mode input
- Windows signing secret validation
- macOS signing and notarization secret validation
- checksum generation before upload
- provenance attestation before upload
- SBOM attestation before upload
