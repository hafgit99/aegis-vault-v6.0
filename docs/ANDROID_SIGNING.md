# Android Release Signing

AegisVault Android release signing is configured to work in two modes:

- Local signing through a repository-external `release-keystore.properties` file.
- GitHub Actions signing through repository secrets.

Never commit keystore files, passwords, or generated local signing files.

## Local Signing

Place the Android keystore and properties file outside the repository, for example:

```text
C:\Users\<you>\AegisVaultSigning\
  aegis-release.jks
  release-keystore.properties
```

The properties file must define these keys:

```properties
RELEASE_STORE_FILE=aegis-release.jks
RELEASE_STORE_PASSWORD=...
RELEASE_KEY_ALIAS=...
RELEASE_KEY_PASSWORD=...
```

When these values are present, Gradle signs the Android release APK automatically:

```powershell
$env:AEGISVAULT_ANDROID_SIGNING_PROPERTIES = "C:\Users\<you>\AegisVaultSigning\release-keystore.properties"
npm run android:build:apk:arm64
```

If the environment variable, properties file, or keystore is missing, the build stays in unsigned community mode. Do not place signing material under the repository root.

## GitHub Actions Signing

Add these repository secrets in GitHub:

- `ANDROID_RELEASE_KEYSTORE_BASE64`
- `RELEASE_STORE_PASSWORD`
- `RELEASE_KEY_ALIAS`
- `RELEASE_KEY_PASSWORD`

Create the base64 keystore value locally:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\aegis-release.jks")) | Set-Clipboard
```

Paste the clipboard value into `ANDROID_RELEASE_KEYSTORE_BASE64`.

The Android Packaging workflow restores the keystore into the runner temp directory and passes the signing values through environment variables. If these secrets are absent, the workflow still produces an unsigned community APK.

## Verification

After building locally, inspect the APK signature:

```powershell
& "$env:ANDROID_HOME\build-tools\35.0.0\apksigner.bat" verify --verbose "src-tauri\gen\android\app\build\outputs\apk\arm64\release\app-arm64-release.apk"
```

Unsigned APKs are not installable on many Android devices. Use the debug-signed APK for local smoke tests until a release keystore is configured.
