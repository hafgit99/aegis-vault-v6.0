# Desktop Packaging Decision

AegisVault should use Tauri as the default desktop runtime for Windows, macOS, and Linux packaging.

This decision keeps the current React/Vite application intact while adding a smaller native shell around the existing web build. The project is a local-first password vault, so the packaging runtime should minimize bundle size, attack surface, and background privileges.

Repository: [github.com/hafgit99/aegis-vault-v6.0](https://github.com/hafgit99/aegis-vault-v6.0)

## Recommendation

Use Tauri first.

Reasons:

- Smaller installers than Electron for a security-focused utility.
- Native WebView integration on Windows, macOS, and Linux.
- Rust permission model and explicit capability configuration.
- Good fit for a Vite app that already builds to static assets.
- Cleaner path to OS-level integrations later, such as secure file dialogs, auto-update, and signing.

Electron remains a fallback if the product later needs deeper Chromium-specific behavior, extension APIs, or browser engine consistency across every operating system.

## Decision Matrix

| Area | Tauri | Electron | AegisVault Fit |
| --- | --- | --- | --- |
| Installer size | Low | High | Tauri |
| Attack surface | Lower by default | Larger bundled runtime | Tauri |
| Browser consistency | System WebView dependent | Bundled Chromium | Electron |
| Vite integration | Strong | Strong | Tie |
| Native APIs | Strong, explicit permissions | Strong, Node-oriented | Tauri |
| Security posture | Capability focused | Requires stricter hardening | Tauri |
| CI packaging complexity | Medium | Medium | Tie |

## Packaging Gate

Desktop builds must depend on the existing release gate. Packaging must not replace these checks:

```bash
npm run lint
npm run audit:all
npm run test:coverage
npm run build
npm run build:budget
npm run test:e2e:release
```

For sensitive desktop releases, also run:

```bash
npm run test:mutation:release
```

## Future Tauri Setup

The desktop shell includes:

- `src-tauri/tauri.conf.json` with product name `AegisVault`.
- Tauri capability files with only required permissions enabled.
- A generated cross-platform icon set under `src-tauri/icons/`.
- `npm run desktop:dev` for local desktop development.
- `npm run desktop:build` for platform packages.
- `npm run desktop:checksums` for release artifact SHA-256 manifests.
- A dedicated GitHub Actions workflow that depends on release preflight.

Expected artifacts:

- Windows: signed `.exe` or `.msi`
- macOS: signed and notarized `.dmg`
- Linux: `.AppImage` and optionally `.deb`

## Required Release Secrets

Windows signing:

- `WINDOWS_CERTIFICATE`
- `WINDOWS_CERTIFICATE_PASSWORD`

macOS signing and notarization:

- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`
- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`

Linux packaging usually does not require signing secrets at the first stage, but release checksums should be published with every artifact.

The `Desktop Packaging` workflow supports four manual signing modes:

- `unsigned`: build unsigned artifacts for every platform.
- `windows`: require Windows signing secrets on the Windows runner.
- `macos`: require Apple signing and notarization secrets on the macOS runner.
- `all`: require both Windows and macOS signing secrets.

Use unsigned mode until certificates are ready. A signed mode intentionally fails early if a required secret is missing.

## Artifact Integrity

Every desktop artifact upload should include:

- `SHA256SUMS.txt`
- `artifact-manifest.json`

Generate them locally after a desktop build with:

```bash
npm run desktop:checksums
```

For custom target directories, pass the bundle path directly:

```bash
node scripts/generate-artifact-checksums.mjs C:\tmp\aegisvault-tauri-target\debug\bundle
```

## Desktop Smoke Test Scope

The first packaging workflow should verify:

- The app launches on each target OS.
- The lock screen renders.
- A vault can be created and unlocked.
- Encrypted backup export opens the OS file flow.
- Import validation rejects malformed files.
- The app remains offline and blocks external network requests.

Full authenticated SQLite/OPFS browser coverage should stay in Playwright Chromium. Desktop smoke tests should focus on shell integration and packaging correctness.

## Local Windows Note

If a local Windows build fails inside a OneDrive-synced workspace with `PermissionDenied` from Cargo or Tauri build scripts, move the Rust target directory outside OneDrive for that command:

```powershell
$env:CARGO_TARGET_DIR = 'C:\tmp\aegisvault-tauri-target'
npm run desktop:build
```

This is a local filesystem permission workaround. GitHub-hosted runners should use the default project target directory and the workflow cache.

## Open Implementation Step

The project now includes a minimal Tauri shell and a manual `Desktop Packaging` GitHub Actions workflow for unsigned artifacts. The next implementation step is to run the workflow on GitHub-hosted Windows, macOS, and Linux runners, then add signing once unsigned builds are stable.

Local Windows debug packaging has been verified with:

```powershell
$env:CARGO_TARGET_DIR = 'C:\tmp\aegisvault-tauri-target'
npx tauri build --debug
```

The verified debug artifacts were:

- `AegisVault_6.0.0_x64_en-US.msi`
- `AegisVault_6.0.0_x64-setup.exe`

The local debug bundle can also be verified with:

```powershell
node scripts/generate-artifact-checksums.mjs C:\tmp\aegisvault-tauri-target\debug\bundle
```
