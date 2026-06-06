# AegisVault v6.0.0 Release Notes Draft

Release date: Pending
Commit: `fa775d080cdb48b98ddcff9fa9d806ad22003aae`
Quality Gate run: <https://github.com/hafgit99/aegis-vault-v6.0/actions/runs/27057022350>
CodeQL run: <https://github.com/hafgit99/aegis-vault-v6.0/actions/runs/27057022343>
Desktop Packaging run: <https://github.com/hafgit99/aegis-vault-v6.0/actions/runs/27057022356>
Security evidence artifact: `security-evidence`
SBOM artifact: `sbom`

## Release Type

- [ ] Web build only
- [x] Desktop artifacts included
- [x] Security-sensitive release

## Signing Mode Disclosure

Signing mode:

- [x] `unsigned`
- [ ] `windows`
- [ ] `macos`
- [ ] `all`

The Windows, macOS, and Linux desktop binaries for this draft are **unsigned community build** artifacts. They include checksums, artifact manifests, SBOM artifacts, and GitHub artifact attestations, but they are not OS-native code signed. Windows SmartScreen, macOS Gatekeeper, or Linux desktop trust prompts may appear.

## Desktop Artifacts

| Platform | Artifact | Signing status | Smoke result |
| --- | --- | --- | --- |
| Windows | `aegisvault-windows` | unsigned community build | Pending manual smoke |
| macOS | `aegisvault-macos` | unsigned community build | Pending manual smoke |
| Linux | `aegisvault-linux` | unsigned community build | Pending manual smoke |

## Artifact Integrity

Each desktop artifact archive is expected to include:

- `SHA256SUMS.txt`
- `artifact-manifest.json`

The workflow also uploaded:

- `aegisvault-windows-sbom`
- `aegisvault-macos-sbom`
- `aegisvault-linux-sbom`
- `security-evidence`
- `sbom`

## Security Gate Results

- Quality Gate: Passed
- CodeQL: Passed
- Desktop Packaging release gate: Passed
- Desktop Windows artifact build: Passed
- Desktop macOS artifact build: Passed
- Desktop Linux artifact build: Passed
- Unit coverage: Passed in CI gate
- Build budget: Passed in CI gate
- Release E2E: Passed in CI gate

## Manual Desktop Smoke Required Before Publishing

Complete the evidence record from [DESKTOP_SMOKE_EVIDENCE.md](DESKTOP_SMOKE_EVIDENCE.md) before publishing a GitHub Release:

- lock screen screenshot
- unlocked vault shell screenshot
- vault create/unlock result
- encrypted backup export result
- malformed import rejection result
- Secure Share export/import result
- Settings and Database modal visual check
- Password Health and HIBP report visual check
- profile preset image check
- no unexpected external network request observed

## Changes

- Added professional import result security summaries in Settings and Database modal flows.
- Improved Password Health Dashboard with prioritized risk ordering.
- Improved HIBP breach scan reporting with exposure totals and action severity.
- Connected Security Audit findings to vault record opening actions for faster password rotation.
- Improved mobile layout by converting sidebar navigation into a bottom mobile nav.
- Strengthened desktop packaging artifact, SBOM, checksum, and smoke evidence documentation.
- Stabilized Desktop Packaging coverage gate against transient CI timing failures.

## Known Limitations

- AegisVault v6.0.0 is local-first and does not include cloud sync, hosted sharing links, or team vault authorization.
- Secure Share is an offline encrypted file format and does not provide hosted revocation or sender identity verification.
- These desktop artifacts are unsigned community builds until Windows Authenticode and Apple Developer ID signing secrets are configured.
- Independent external security review has not yet been completed.

## Upgrade Notes

- Existing local vault data remains local to the device.
- Users should keep encrypted backups before installing or testing desktop builds.
- Users should treat plain-text exports as high risk and rotate affected secrets if a plain export leaves trusted storage.

## External Review

Vulnerability disclosure process: [VULNERABILITY_DISCLOSURE.md](VULNERABILITY_DISCLOSURE.md)
Independent security report: Pending
Penetration test report: Pending
Cryptographic review: Pending
