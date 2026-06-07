# AegisVault Android Roadmap

Status: Phase 4 Android packaging and smoke hardening in progress
Target: Android-first local vault companion for AegisVault v6

This roadmap treats Android as a security product track, not as a simple web wrapper. The first Android release must preserve the local-first vault model, keep cloud/team features out of scope, and use native Android security services where the browser/WebView layer is not enough.

## Platform Decision

Chosen starting path: Tauri v2 mobile for Android.

Reasons:

- The repository already uses Tauri v2 for desktop packaging.
- The existing React application, i18n layer, crypto modules, import/export workflows, and security audit UI can be reused.
- The native command boundary already exists for OS keychain, biometric unlock, and sensitive clipboard handling.
- Tauri v2 officially supports Android initialization and Android build commands.

Alternatives kept open:

- Capacitor can be revisited if Tauri Android plugins block critical production requirements.
- Fully native Kotlin can be revisited only if WebView storage, biometric, or file export constraints become unacceptable for a password manager.

## Android v1 Scope

Must ship:

- Vault setup and unlock.
- Master password plus device secret flow.
- Android biometric unlock through native bridge.
- Local encrypted record storage.
- Add, edit, favorite, trash, restore, and delete records.
- Password generator and Diceware passphrase generator.
- Password Health and Security Audit.
- HIBP k-anonymity scan with the existing range-only allowlist.
- Encrypted backup export/import.
- Secure Share export/import.
- Turkish, English, and Chinese language support.
- Dark mobile layout with accessible touch targets.
- Android release APK/AAB artifact with checksum and SBOM evidence.

Out of scope for Android v1:

- Cloud sync.
- Team vaults.
- Hosted share links.
- Remote account recovery.
- Background password monitoring.

## Security Requirements

Android v1 must include these controls before public release:

- Android Keystore backed storage for remembered device secrets.
- BiometricPrompt-backed biometric unlock.
- `FLAG_SECURE` for sensitive vault screens to block screenshots and recent-app thumbnails.
- App-private storage for vault files and temporary import/export staging.
- No Android auto-backup for plaintext or decrypted vault state.
- HIBP network allowlist limited to `https://api.pwnedpasswords.com/range/`.
- Network Security Config with cleartext traffic disabled.
- Settings diagnostics must show the active vault storage backend during Android smoke tests.
- Clipboard auto-clear after secret copy.
- Native sensitive clipboard handling where Android supports it.
- Local warning if clipboard clearing or native sensitive handling fails.
- Root/debug/emulator risk signals documented before release.
- MASVS-aligned mobile threat model update.

## Architecture Work

Phase 0 - readiness foundation:

- Add Android build scripts.
- Add Android Tauri bundle metadata.
- Add Android readiness verification script.
- Document Android scope, security controls, and release gates.
- Generate and commit the Tauri Android scaffold after local SDK validation.
- Add baseline Android backup blocking and `FLAG_SECURE` screenshot protection.

Phase 1 - scaffold:

- Install Android Studio, Android SDK Platform, Platform-Tools, NDK, Build-Tools, and Command-line Tools.
- Set `JAVA_HOME`, `ANDROID_HOME`, and `NDK_HOME`.
- Install Rust Android targets: `aarch64-linux-android`, `armv7-linux-androideabi`, `i686-linux-android`, `x86_64-linux-android`.
- Run `npm run android:init`.
- Commit generated Android project files after review.
- Keep debug and release installs separated in the generated Android Gradle configuration.
- Produce an unsigned ARM64 APK smoke artifact before deeper native security work.

Phase 2 - native security bridge:

- Replace desktop keyring fallback with Android Keystore command path.
- Verify biometric plugin behavior on a real Android device.
- Add native screenshot blocking.
- Add Android clipboard command or documented fallback.
- Add app-private file export/import commands if browser download behavior is unreliable in WebView.

Phase 3 - storage adapter:

- Keep OPFS as the browser/desktop persistence backend.
- Use Android app-private file commands behind the existing SQLite persistence boundary when running inside Android Tauri.
- Surface the selected storage backend in Settings diagnostics for real-device smoke evidence.
- Preserve encrypted record and backup formats so desktop and Android can exchange encrypted backups.

Phase 4 - mobile UX:

- Convert desktop-heavy modals to full-screen mobile flows or bottom-sheet style panels.
- Tune touch targets, scroll containers, keyboard behavior, and safe areas.
- Add Android smoke tests for lock/unlock, backup import/export, Secure Share, profile image, donation page, HIBP, and Password Health.

Phase 5 - release:

- Keep GitHub Actions Android APK build active through `.github/workflows/android-packaging.yml`.
- Produce signed or unsigned APK for internal testing and staged artifact downloads.
- Produce signed AAB for Google Play through the Android Packaging workflow manual `package_type` input.
- Keep Android signing documentation and secrets checklist current in `docs/ANDROID_SIGNING.md`.
- Complete Google Play Data Safety and privacy policy review.

## Local Commands

```powershell
npm run android:doctor
npm run android:init
npm run android:dev
npm run android:build:apk:arm64
npm run android:build:apk
npm run android:build:aab
```

`android:doctor` is safe to run before the Android SDK is installed. It checks repository readiness and reports missing local SDK tooling as warnings.

## Current Known Risks

- Android app-private storage persistence must complete the manual smoke checklist before public Android release.
- Desktop keyring code is not the final Android Keystore implementation for all remembered-secret paths.
- Browser-style downloads may need replacement with Android native file picker/share intents.
- WebAuthn/passkey support on Android WebView needs real-device verification.
- Tauri mobile plugin support must be tested before committing to public Android release dates.

## Reference Sources

- Tauri Android prerequisites: https://v2.tauri.app/start/prerequisites/
- Tauri CLI Android commands: https://v2.tauri.app/reference/cli/
- Tauri Google Play distribution: https://v2.tauri.app/distribute/google-play/
- Tauri configuration Android fields: https://v2.tauri.app/reference/config/
