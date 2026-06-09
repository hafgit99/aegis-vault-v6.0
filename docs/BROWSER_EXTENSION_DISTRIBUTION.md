# Browser Extension Distribution

This document defines how AegisVault desktop Autofill extensions should be published from a website or GitHub Release.

## Public Install Model

AegisVault desktop Autofill has two pieces:

- the AegisVault desktop app, which installs and self-heals the native messaging host registration.
- the browser extension, which asks the local native host to approve fill and save actions.

Users must install the desktop app before the extension can fill credentials. The extension does not store vault data.

## Firefox

Normal Firefox release users can permanently install only Mozilla-signed add-ons. Unsigned `.xpi` files are for development or temporary debugging only.

Public website download:

1. Build the staged Firefox extension:

   ```powershell
   npm run desktop:autofill:extension:package
   ```

2. Sign the Firefox extension through AMO as an unlisted/self-distributed add-on.

   Required GitHub Actions secrets:

   - `AMO_JWT_ISSUER`
   - `AMO_JWT_SECRET`

3. Publish the signed `.xpi` from `browser-extension-artifacts/firefox-signed/` on the website.

4. The website download link should point directly to the signed `.xpi`:

   ```html
   <a href="/downloads/aegisvault-autofill-firefox.xpi">Firefox için AegisVault Autofill indir</a>
   ```

5. Do not publish `*.unsigned.xpi` as a public Firefox install link.

Firefox extension ID:

```text
aegisvault-autofill@aegisvault.com
```

This ID must stay aligned with `native-messaging/firefox/com.aegisvault.desktop.json` and the Windows self-healing native host registration.

## Chrome, Brave, and Edge

For broad public distribution, the recommended path is a browser store listing:

- Chrome and Brave: Chrome Web Store listing.
- Edge: Microsoft Edge Add-ons listing or Chrome Web Store where supported by the browser.

The CI package `aegisvault-autofill-chromium-<version>.zip` is intended for:

- Chrome Web Store submission.
- manual QA with `Load unpacked`.
- enterprise/admin distribution policies.

Do not present the Chromium `.zip` as a one-click public install equivalent to Firefox signed XPI. Most normal Chromium-family users cannot safely install arbitrary extensions from a website without store or policy support.

Stable Chromium extension ID:

```text
cpocoejkonndmdedimnoklhhajkiccoc
```

Legacy Brave development ID kept during migration:

```text
fbegblomolojcldifclfljlkddkcdehl
```

## Website Download Table

Use this structure on the public download page:

| Browser | Public Link | Notes |
| --- | --- | --- |
| Firefox | signed `.xpi` | Direct website install after AMO signing. |
| Chrome | Chrome Web Store URL | Recommended for normal users. |
| Brave | Chrome Web Store URL or advanced ZIP guide | ZIP is advanced/manual only. |
| Edge | Microsoft Edge Add-ons URL | Recommended for normal users. |

## Release Artifact Rules

The Windows `Desktop Packaging` workflow uploads `aegisvault-desktop-autofill-extension`, containing:

- `desktop-autofill-extension/chromium/`
- `desktop-autofill-extension/firefox/`
- `browser-extension-artifacts/aegisvault-autofill-chromium-<version>.zip`
- `browser-extension-artifacts/aegisvault-autofill-firefox-<version>.unsigned.xpi`
- `browser-extension-artifacts/firefox-signed/*.xpi` when AMO signing secrets are configured.
- `browser-extension-artifacts/SHA256SUMS.txt`
- `browser-extension-artifacts/artifact-manifest.json`

Only signed Firefox XPI files and browser-store links should be promoted to normal users.

## User Install Copy

Recommended Turkish website text:

```text
AegisVault Autofill'i kullanmadan önce AegisVault masaüstü uygulamasını kurup bir kez açın.

Firefox: İmzalı AegisVault Autofill XPI dosyasını indirin ve Firefox'un kurulum onayını kabul edin.
Chrome/Brave/Edge: Resmi mağaza bağlantısından eklentiyi kurun. Manuel ZIP paketi yalnızca gelişmiş kullanıcılar ve test içindir.
```

## Verification

Before publishing extension artifacts:

```powershell
npm run desktop:autofill:doctor
npm run desktop:autofill:extension:package
npm run desktop:autofill:extension:finalize
```

Then verify `browser-extension-artifacts/SHA256SUMS.txt` and publish the checksum beside the download link.
