# Android Build Evidence

Status: initial ARM64 unsigned APK build passed

## Environment

- Android SDK: `C:\Users\hrn21\AppData\Local\Android\Sdk`
- Android NDK: `C:\Users\hrn21\AppData\Local\Android\Sdk\ndk\27.2.12479018`
- Java runtime used for build: `C:\Program Files\Android\Android Studio\jbr`
- Rust Android target verified: `aarch64-linux-android`

## Verified Commands

```powershell
npm run android:doctor
cargo check --manifest-path src-tauri\Cargo.toml
npm run android:build:apk:arm64
```

## APK Output

Unsigned internal smoke APK:

```text
src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release-unsigned.apk
```

SHA-256:

```text
1FA9B362A1CCF949881038FD2DB46BB8AB26A78B2EE338278200309A86016D98
```

## Security Baseline Included

- Android backup disabled with `android:allowBackup="false"`.
- Full backup disabled with `android:fullBackupContent="false"`.
- Dependency manifest merge keeps the app-level backup decision with `tools:replace="android:fullBackupContent"`.
- `FLAG_SECURE` is applied in `MainActivity` to block screenshots and recent-app thumbnails.
- Release manifest keeps cleartext traffic disabled through the generated Tauri placeholder.

## Known Warnings

- Java 21 reports source/target 8 deprecation warnings from the generated Android project.
- Some Tauri-generated Android classes emit deprecation warnings.
- Vite reports the existing large `vendor-zxcvbn` chunk warning.

## Manual Smoke Checklist

- Install APK on a real ARM64 Android device.
- Confirm app launch and lock screen rendering.
- Create a new vault.
- Unlock the vault after app restart.
- Add, edit, favorite, trash, restore, and permanently delete a record.
- Run Password Health and HIBP scan.
- Export and import encrypted backup.
- Export and import Secure Share bundle.
- Open Settings, Database modal, Profile modal, and Donation page.
- Confirm screenshots are blocked on sensitive screens.
- Confirm app switcher preview does not reveal vault content.
- Confirm Android backup does not include vault secrets.
