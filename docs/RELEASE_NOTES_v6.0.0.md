# AegisVault v6.0.0

Release date: 2026-06-08
Verified code commit: `c584b1fb06ca2c5aacc9444d5a5cc68ffbdc6301`
Tag: `v6.0.0`
Release status: stable release candidate promoted after green GitHub Actions and real-device smoke.

## Release Type

- Desktop artifacts included.
- Android artifacts included.
- Security-sensitive release.
- Local-first/offline password vault release.

## Signing Disclosure

Desktop signing mode: `unsigned`

Windows, macOS, and Linux desktop artifacts are **unsigned community builds**. They include checksums, artifact manifests, SBOM artifacts, and GitHub artifact attestations, but they are not OS-native code signed. Windows SmartScreen, macOS Gatekeeper, or Linux desktop trust prompts may appear.

Android signing mode depends on the workflow artifact used:

- GitHub signed Android artifacts are signed when repository signing secrets are configured.
- Locally installed test builds were verified on real Android hardware.

## Verified Artifacts

| Platform | Artifact | Status |
| --- | --- | --- |
| Windows | `aegisvault-windows` | Passed: installed, launched, lock/unlock, desktop Autofill fill flow |
| Android | `aegisvault-android` | Passed: installed on real device, setup/unlock, Android Autofill fill and save flows |
| macOS | `aegisvault-macos` | Built by green Actions run; manual target-device smoke still recommended before broad promotion |
| Linux | `aegisvault-linux` | Built by green Actions run; manual target-device smoke still recommended before broad promotion |

## Integrity Evidence

Release artifacts should be published together with:

- `SHA256SUMS.txt`
- `artifact-manifest.json`
- per-platform SBOM artifacts
- `security-evidence`
- GitHub artifact provenance attestations
- GitHub SBOM attestations

## Security Gate Results

- GitHub Actions quality gate: Passed
- Desktop packaging: Passed
- Android packaging: Passed
- Lint: Passed
- Unit coverage: Passed
- Build: Passed
- Build budget: Passed
- Release E2E: Passed
- Desktop Autofill readiness gate: Passed
- Android Autofill regression gate: Passed
- Security evidence and SBOM generation: Passed

## Highlights

- Added Android Autofill fill/save flow with strict request matching and explicit in-app approval.
- Added Chromium/Brave/Edge desktop Autofill extension with native messaging bridge.
- Improved desktop Autofill app launch by resolving the installed `AegisVault.exe` path automatically.
- Added signed Android build support and release artifact staging.
- Hardened desktop packaging so undersized/corrupt installers are rejected before publication.
- Improved mobile layouts for Android safe areas, portrait/landscape vault views, Settings, and Security Audit.
- Improved import/export result summaries, Secure Share import flow, HIBP reporting, and Password Health risk prioritization.
- Added release hardening: SBOM, artifact manifests, checksums, provenance, CodeQL, security evidence, and release readiness documentation.

## Known Limitations

- Desktop builds are unsigned community builds until Windows Authenticode and Apple Developer ID signing are configured.
- Desktop browser Autofill extension is not yet distributed through public browser extension stores.
- macOS and Linux artifacts were built by CI, but target-device manual smoke is still recommended before wide distribution.
- AegisVault v6.0.0 does not include cloud sync, hosted sharing links, or team vault authorization.
- Secure Share is an offline encrypted bundle format and does not provide hosted revocation.
- Independent external security review is pending.

## Upgrade Notes

- Existing vault data remains local to the device.
- Create an encrypted backup before upgrading or testing packaged builds.
- Treat plain-text exports as high risk and rotate affected credentials if such exports leave trusted storage.
- For desktop Autofill, install the browser extension and native messaging host package matching the release artifact.

## External Review

Vulnerability disclosure process: [VULNERABILITY_DISCLOSURE.md](VULNERABILITY_DISCLOSURE.md)
Independent security report: Pending
Penetration test report: Pending
Cryptographic review: Pending
