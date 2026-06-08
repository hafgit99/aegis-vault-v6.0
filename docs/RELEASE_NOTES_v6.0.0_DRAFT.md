# AegisVault v6.0.0 Release Notes Draft

Release date: 2026-06-08 release candidate
Verified code commit: `84a57a557d56180f8cf88631e661c72392eb6de4`
Quality Gate run: latest green GitHub Actions run for the verified commit
CodeQL run: latest green GitHub Actions run for the verified commit
Desktop Packaging run: latest green GitHub Actions run for the verified commit
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
| Windows | `aegisvault-windows` | unsigned community build | Pass: installed, launched, lock/unlock, Android/desktop Autofill-related regression path verified on 2026-06-08 |
| macOS | `aegisvault-macos` | unsigned community build | Pending target-device manual smoke |
| Linux | `aegisvault-linux` | unsigned community build | Pending target-device manual smoke |

## Android Artifact Smoke

| Platform | Artifact | Signing status | Smoke result |
| --- | --- | --- | --- |
| Android | `aegisvault-android` signed APK/AAB when release secrets are configured | signed local/GitHub release build when secrets are present | Pass: installed on real device, unlock/setup flow passed, Android Autofill fill and save flows passed on 2026-06-08 |

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

## Manual Smoke Evidence

Windows and Android smoke have been manually verified for this release candidate. Complete or attach the remaining platform evidence record from [DESKTOP_SMOKE_EVIDENCE.md](DESKTOP_SMOKE_EVIDENCE.md) before publishing macOS or Linux binaries as stable public artifacts:

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
- desktop browser Autofill extension opens AegisVault automatically and fills only after explicit in-vault approval
- Android Autofill fill and save flows require explicit AegisVault approval before any credential is returned or persisted

## Changes

- Added professional import result security summaries in Settings and Database modal flows.
- Improved Password Health Dashboard with prioritized risk ordering.
- Improved HIBP breach scan reporting with exposure totals and action severity.
- Connected Security Audit findings to vault record opening actions for faster password rotation.
- Improved mobile layout by converting sidebar navigation into a bottom mobile nav.
- Strengthened desktop packaging artifact, SBOM, checksum, and smoke evidence documentation.
- Stabilized Desktop Packaging coverage gate against transient CI timing failures.
- Added Android Autofill fill/save support with strict request matching and explicit approval.
- Added desktop Chromium/Brave/Edge Autofill extension and native messaging host for approved fill/save handoff.
- Improved desktop Autofill app launch by recording and resolving the installed AegisVault executable path.
- Hardened desktop artifact packaging to reject undersized or corrupt installer outputs.

## Known Limitations

- AegisVault v6.0.0 is local-first and does not include cloud sync, hosted sharing links, or team vault authorization.
- Secure Share is an offline encrypted file format and does not provide hosted revocation or sender identity verification.
- These desktop artifacts are unsigned community builds until Windows Authenticode and Apple Developer ID signing secrets are configured.
- Independent external security review has not yet been completed.
- Chrome Web Store, Edge Add-ons, and other public browser extension store distribution is not yet complete; current desktop Autofill is suitable for packaged or manually loaded extension testing.
- macOS and Linux target-device smoke remains required before marking those platform artifacts as stable.

## Upgrade Notes

- Existing local vault data remains local to the device.
- Users should keep encrypted backups before installing or testing desktop builds.
- Users should treat plain-text exports as high risk and rotate affected secrets if a plain export leaves trusted storage.

## External Review

Vulnerability disclosure process: [VULNERABILITY_DISCLOSURE.md](VULNERABILITY_DISCLOSURE.md)
Independent security report: Pending
Penetration test report: Pending
Cryptographic review: Pending
