# Desktop Browser Autofill Extension

This document defines the first desktop Autofill implementation track for AegisVault.

## Goal

Desktop browsers do not expose a system Autofill framework equivalent to Android Autofill. AegisVault desktop Autofill therefore starts with a browser extension plus a native messaging bridge.

The extension must detect login forms, verify the active origin, and ask the local AegisVault desktop app to approve fill or save actions. The extension must not store vault records, master keys, device secrets, or long-lived plaintext credentials.

## Components

| Component | Location | Responsibility |
| --- | --- | --- |
| Chromium extension | `browser-extension/chromium` | Detect login forms, show user-triggered fill/save controls, and call native messaging in Chrome, Edge, and Brave. |
| Firefox extension | `browser-extension/firefox` | Provides the Firefox WebExtension manifest with a stable Gecko ID while reusing the same audited scripts and styles. |
| Chromium native messaging manifest | `native-messaging/chromium/com.aegisvault.desktop.json` | Registers the local native bridge host for Chrome, Edge, and Brave with `allowed_origins`. |
| Firefox native messaging manifest | `native-messaging/firefox/com.aegisvault.desktop.json` | Registers the local native bridge host for Firefox with `allowed_extensions`. |
| Native messaging host | `src-tauri/src/bin/aegisvault_native_messaging_host.rs` | Reads browser native messaging frames, stages fill/save handoff files, launches AegisVault, and returns approved fill credentials. |
| AegisVault desktop app | Tauri shell | Owns unlock, matching, approval, and persistence. |

## Message Protocol

All native messages use protocol `aegisvault.desktopAutofill.v1`.

Fill request:

```json
{
  "protocol": "aegisvault.desktopAutofill.v1",
  "id": "request-id",
  "type": "fill",
  "origin": "https://github.com",
  "url": "https://github.com/login",
  "formSignature": "github.com|||login|password",
  "fields": {
    "hasUsernameField": true,
    "hasPasswordField": true
  }
}
```

Fill response:

```json
{
  "ok": true,
  "credential": {
    "username": "user@example.com",
    "password": "short-lived plaintext password"
  }
}
```

Save request:

```json
{
  "protocol": "aegisvault.desktopAutofill.v1",
  "id": "request-id",
  "type": "save",
  "origin": "https://github.com",
  "url": "https://github.com/login",
  "username": "user@example.com",
  "password": "short-lived plaintext password",
  "formSignature": "github.com|||login|password"
}
```

Save response:

```json
{
  "ok": true,
  "status": "staged"
}
```

## Security Requirements

- The extension must require a user gesture before fill or save messages are sent.
- The extension must not request browser storage permissions for vault data.
- The extension must reject non-HTTPS origins except localhost development origins.
- The extension must never log usernames, passwords, or raw form values.
- The native host must perform origin matching against the unlocked vault and require explicit AegisVault approval before returning a fill credential.
- Save requests must be staged for AegisVault confirmation, not persisted directly by the extension.
- The Chromium native messaging manifest must restrict `allowed_origins` to the real extension ID before release.
- The Firefox native messaging manifest must restrict `allowed_extensions` to the stable Gecko extension ID before release.

## Current Status

Phase 1 is scaffolded:

- Chromium MV3 manifest.
- Firefox MV2 manifest for Firefox native messaging compatibility.
- Content script for login form detection and user-triggered fill/save controls.
- Shared background bridge with `chrome.runtime` and `browser.runtime` compatibility.
- Native messaging manifest templates for Chromium and Firefox.
- Rust native messaging host POC.
- Readiness gate: `npm run desktop:autofill:doctor`.
- Extension staging command: `npm run desktop:autofill:extension:stage`.
- Host build command: `npm run desktop:autofill:host:build`.
- Host staging command: `npm run desktop:autofill:host:stage`.

## Local Packaging Flow

Build and stage the Chromium native host:

```powershell
npm run desktop:autofill:extension:stage
npm run desktop:autofill:host:build
$env:AEGISVAULT_CHROMIUM_EXTENSION_ID = "fbegblomolojcldifclfljlkddkcdehl"
$env:AEGISVAULT_FIREFOX_EXTENSION_ID = "aegisvault-autofill@aegisvault.com"
npm run desktop:autofill:host:stage
```

The extension staging command writes:

- `desktop-autofill-extension/chromium`
- `desktop-autofill-extension/firefox`

Use this directory with Chrome, Edge, or Brave `Load unpacked` during local testing. The current Brave development extension ID is `fbegblomolojcldifclfljlkddkcdehl`. After loading a different build, copy the generated extension ID and rerun the host staging command with `AEGISVAULT_CHROMIUM_EXTENSION_ID`.

Use `desktop-autofill-extension/firefox` with Firefox `about:debugging#/runtime/this-firefox` during local testing. Load the staged `manifest.json` as a temporary add-on. The default Firefox Gecko ID is `aegisvault-autofill@aegisvault.com`; if the published add-on ID changes, rerun host staging with `AEGISVAULT_FIREFOX_EXTENSION_ID`.

The host staging command writes:

- `desktop-autofill-host/<platform>/AegisVaultNativeMessagingHost.exe` on Windows.
- `desktop-autofill-host/<platform>/com.aegisvault.desktop.json` for Chromium browsers.
- `desktop-autofill-host/<platform>/com.aegisvault.desktop.firefox.json` for Firefox.
- Windows Chrome, Edge, Brave, and Firefox registration files:
  - `install-chrome-native-host.reg`
  - `install-edge-native-host.reg`
  - `install-brave-native-host.reg`
  - `install-firefox-native-host.reg`
  - `install-native-host.ps1`

For Windows development, import one of the `.reg` files or run the PowerShell installer after reviewing the generated manifest path. Production installers should perform the same registration during install and remove it during uninstall.

The environment variables `AEGISVAULT_CHROMIUM_EXTENSION_ID` and `AEGISVAULT_FIREFOX_EXTENSION_ID` must be set to the packed/published extension IDs before release packaging. The current Chromium default is the Brave development ID `fbegblomolojcldifclfljlkddkcdehl`. The current Firefox default is `aegisvault-autofill@aegisvault.com`. For broad public distribution, publish the extension or pack it with a stable extension key/Gecko ID so every user receives the same trusted native messaging binding.

Next implementation step:

- Add installer/packaging steps that copy the native host next to the desktop app, register the browser native messaging manifest, and replace `REPLACE_WITH_CHROME_EXTENSION_ID` with the actual packed extension ID.
