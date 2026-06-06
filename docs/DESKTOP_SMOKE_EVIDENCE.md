# Desktop Smoke Evidence

This document defines the release evidence required after building AegisVault desktop artifacts for Windows, macOS, and Linux.

Desktop smoke evidence is intentionally smaller than full browser E2E coverage. Browser E2E verifies authenticated vault behavior. Desktop smoke evidence verifies that packaged binaries launch, render, use the expected local security model, and match the published artifact metadata.

## Required Platforms

Collect evidence for every public desktop artifact:

- Windows installer or bundle.
- macOS bundle or image.
- Linux AppImage, deb, or package.

## Required Evidence Per Platform

Each platform smoke record must include:

- operating system name and version
- AegisVault version
- artifact file name
- SHA-256 digest from `SHA256SUMS.txt`
- signing mode: `unsigned`, `windows`, `macos`, or `all`
- artifact attestation link or workflow run link
- screenshot of the lock screen after first launch
- screenshot of the unlocked vault shell after creating or opening a test vault
- confirmation that the app can lock again
- confirmation that no unexpected external network prompt or request appeared
- confirmation that profile preset images render without broken image placeholders

## Required Functional Smoke Steps

Run these steps on every packaged platform:

1. Install or open the generated artifact.
2. Confirm the application name and version match the release.
3. Confirm the lock screen renders in the default language.
4. Create a test vault with a temporary master password.
5. Add one login entry with generated password data.
6. Lock and unlock the vault.
7. Export an encrypted backup and confirm the OS save dialog or file flow works.
8. Import a malformed file and confirm validation rejects it without adding records.
9. Export a Secure Share bundle and import it back into a clean test vault.
10. Confirm settings, language selector, profile image presets, and donation page render without blank or broken visual states.
11. Close and reopen the app, then confirm the lock screen is shown again.

## Packaged Artifact Gate

The current packaging workflow publishes the desktop artifacts from the `Desktop Packaging` workflow. For v6.0.0 hardening, the latest verified green workflow run produced:

- `aegisvault-windows`
- `aegisvault-macos`
- `aegisvault-linux`
- per-platform SBOM artifacts
- release checksums and artifact manifest files inside each desktop artifact archive

Reference run: <https://github.com/hafgit99/aegis-vault-v6.0/actions/runs/27042350350>

Before publishing a GitHub Release, download each artifact archive from the workflow run and verify the installer package against its bundled `SHA256SUMS.txt`. Treat this as a human release gate because the Windows `.exe`/`.msi`, macOS `.dmg`/`.app`, and Linux `.AppImage`/`.deb` outputs must be launched on their real target OS.

## Platform-Specific Manual Checks

Windows:

- Install or launch the generated Windows package.
- Confirm Windows Defender or SmartScreen warning text is expected for an unsigned community build.
- Confirm lock/unlock, encrypted backup export, Secure Share import, Settings, Database modal, and profile preset images.
- Uninstall or remove the test install after the smoke run.

macOS:

- Open the generated `.dmg` or `.app` on macOS.
- Confirm Gatekeeper behavior is expected for the selected signing mode.
- Confirm lock/unlock, encrypted backup export, Secure Share import, Settings, Database modal, and profile preset images.
- If signed/notarized builds are enabled later, confirm notarization and staple status before release.

Linux:

- Launch the generated AppImage or install the generated deb/package on a clean Linux desktop.
- Confirm required WebKit/runtime dependencies are present or documented.
- Confirm lock/unlock, encrypted backup export, Secure Share import, Settings, Database modal, and profile preset images.
- Remove the test install and any temporary vault data after the smoke run.

## Release Evidence Template

Use this template in release notes, audit evidence, or an attached markdown artifact:

The public release notes should follow [RELEASE_NOTES_TEMPLATE.md](RELEASE_NOTES_TEMPLATE.md) and attach the completed smoke evidence record.

```markdown
## Desktop Smoke Evidence

Release: v6.0.0
Commit:
Workflow run:
Signing mode:

| Platform | Artifact | SHA-256 | Launch | Vault create/unlock | Backup export | Secure Share import | Visual smoke | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Windows |  |  | Pass/Fail | Pass/Fail | Pass/Fail | Pass/Fail | Pass/Fail |  |
| macOS |  |  | Pass/Fail | Pass/Fail | Pass/Fail | Pass/Fail | Pass/Fail |  |
| Linux |  |  | Pass/Fail | Pass/Fail | Pass/Fail | Pass/Fail | Pass/Fail |  |
```

## Release Blocking Conditions

Do not publish desktop binaries when:

- any platform artifact is missing
- checksums are missing or do not match
- artifact attestation is missing
- the app cannot launch
- vault creation or unlock fails
- encrypted backup export fails
- Secure Share import/export fails
- lock screen or main shell has broken visual states
- profile preset images render as broken images
- unsigned artifacts are published without explicit unsigned disclosure

## Verification

Run the policy verification gate before release:

```bash
npm run security:desktop-smoke
```

The verification script confirms that desktop smoke evidence policy, release hardening, audit evidence, and desktop packaging documentation remain wired together. It does not launch native binaries automatically; the smoke record must be collected from the packaged artifacts on each target OS.
