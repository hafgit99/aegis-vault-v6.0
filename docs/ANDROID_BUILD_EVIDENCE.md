# Android Build Evidence

Status: signed release APK and signed release AAB build passed; real-device APK smoke passed

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
npm run android:build:aab
npm run android:checksums
npm run android:stage
```

## GitHub Actions

Android artifacts are built by `.github/workflows/android-packaging.yml`.

- Trigger: manual `workflow_dispatch`, `main` push, and `v*` tags.
- Manual package choices: `apk`, `aab`, or `both`.
- Gate: `android:doctor`, lint, Android Autofill regression tests, Android-focused unit tests, and SBOM generation.
- Artifact: `aegisvault-android`.
- Signing status: signed APK/AAB when Android signing secrets are configured; otherwise unsigned community APK.

## APK Output

Unsigned internal smoke APK:

```text
src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release-unsigned.apk
```

SHA-256:

```text
B5F51A86A1C61B477AD5C798C1500D57D7603F99C1FD5B04CC485CDD9FC78A68
```

Debug-signed real-device smoke APK:

```text
src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk
```

SHA-256:

```text
0C4DCDD0E0EC045CEE818A4E2CC90D04D123FCD56F91A1CD7D7CAB255CA59425
```

Locally signed release APK:

```text
src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release.apk
```

SHA-256:

```text
9CDF1719E082BEEAA1B42A6F60311C4063A9CD644D494C4AECCD5D6F9716057E
```

Signature verification:

```text
apksigner verify --verbose: Verifies; APK Signature Scheme v2: true; Number of signers: 1
```

Locally signed release AAB:

```text
src-tauri\gen\android\app\build\outputs\bundle\universalRelease\app-universal-release.aab
```

SHA-256:

```text
B59A4EBB965EFF5C7C31F8E4B7E9B868B56BDE8B13E5D523FA4FF0F918A0BB18
```

Staged release artifact manifest:

```text
android-artifacts\aegisvault-android\artifact-manifest.json
```

## Security Baseline Included

- Android backup disabled with `android:allowBackup="false"`.
- Full backup disabled with `android:fullBackupContent="false"`.
- Dependency manifest merge keeps the app-level backup decision with `tools:replace="android:fullBackupContent"`.
- `FLAG_SECURE` is applied in `MainActivity` to block screenshots and recent-app thumbnails.
- Release manifest applies `networkSecurityConfig` with cleartext traffic disabled.
- Android WebView debugging is disabled in `MainActivity`.
- Android app-private vault storage commands are registered behind the existing SQLite persistence boundary.
- Settings diagnostics reports the active storage backend so real-device smoke runs can prove Android app-private storage is in use.
- Android packaging workflow stages APK/AAB artifacts with `SHA256SUMS.txt` and `artifact-manifest.json`.
- Android packaging can also build signed AAB artifacts for Google Play upload when run manually with `package_type: aab` or `both`.
- Android release signing is documented in `docs/ANDROID_SIGNING.md`.
- Local release signing is active when `.secrets/release-keystore.properties` and the matching keystore are present.

## Real-Device Smoke Evidence

- APK installed on a connected Android device through `adb install -r`.
- The unsigned release APK is not directly installable on Android because it has no signing certificate; use the debug-signed APK for local smoke until release signing is configured.
- App launched through `adb shell monkey`.
- Lock screen and first master-password setup screen opened successfully.
- Post-unlock mobile layout safe-area issues were corrected for portrait and landscape.
- Android launcher icon was regenerated from the desktop icon source and copied into the Android resource tree.
- Android Autofill provider smoke passed on a real device: tapping `Fill with AegisVault` opens the vault, approval writes a single-use payload, `AutofillAuthActivity` returns it through `AutofillManager.EXTRA_AUTHENTICATION_RESULT`, and returning to the browser fills the selected GitHub credential through the Android Autofill framework.
- Android Autofill multiple-match UX is covered by an in-app selection sheet, and canceling the selection returns `RESULT_CANCELED` so the browser form remains unchanged.
- Android Autofill save prompt staging is guarded by `SaveInfo.SAVE_DATA_TYPE_PASSWORD`, writes only a short-lived `pending_autofill_save_request.json` handoff file, and still requires AegisVault's explicit create/update/cancel confirmation sheet before any vault record changes.
- Logcat smoke check after launch showed no `FATAL EXCEPTION` or `AndroidRuntime` crash entries.

## Android Autofill Regression Gate

The following targeted tests must pass before Android packaging:

```powershell
npm run test:unit -- test/unit/autofill-handoff-controller.test.tsx test/unit/autofill-handoff.test.tsx test/unit/autofill-native-bridge.test.ts test/unit/autofill-provider.test.ts test/unit/autofill-matcher.test.ts
```

This gate covers the handoff controller, approved/canceled native payload bridge, strict web-domain matching, password-field filtering, meaningful Android package-token fallback, and multiple-match selection flow.

Native Kotlin compile check for the Autofill service:

```powershell
.\gradlew.bat app:compileArm64DebugKotlin
```

## Known Warnings

- Java 21 reports source/target 8 deprecation warnings from the generated Android project.
- Some Tauri-generated Android classes emit deprecation warnings.
- Vite reports the existing large `vendor-zxcvbn` chunk warning.

## Manual Smoke Checklist

Use `docs/ANDROID_SMOKE_CHECKLIST.md` for the release-candidate manual smoke pass.
