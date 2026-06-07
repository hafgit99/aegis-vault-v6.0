# Android Manual Smoke Checklist

Use this checklist for each unsigned community APK or signed Android release candidate before publishing artifacts.

## Install And Launch

- Install the APK on a real ARM64 Android device.
- Launch from the Android launcher and confirm the icon matches the desktop AegisVault icon family.
- Confirm the lock screen renders without clipping under the status bar or navigation buttons.
- Rotate portrait and landscape once before creating data.
- Open recent apps and confirm sensitive content is hidden by `FLAG_SECURE`.

## Vault Lifecycle

- Create a new vault with a strong master password.
- Store or skip the emergency secret key according to the setup flow.
- Lock the vault and unlock again with the master password.
- Restart the app and unlock again.
- Enable biometric unlock on a supported device, then verify unlock and forget-device behavior.

## Android Storage Evidence

- Open Settings.
- Run System Status and Diagnostics.
- Confirm the diagnostics report shows `Storage Backend: Android app-private storage` on Android.
- Add one test login record, close the app, relaunch, and confirm the record persists.
- Delete the test record and confirm it does not return after relaunch.

## Core Vault UX

- Add, edit, favorite, trash, restore, and permanently delete a login record.
- Open a password detail panel in portrait and landscape.
- Confirm the detail panel top bar does not overlap the Android status bar.
- Confirm bottom navigation and menus remain above Android navigation controls.
- Open Password Health and Security Audit on portrait and landscape.

## Backup And Transfer

- Export an encrypted backup.
- Import the encrypted backup into a fresh vault or after deleting the test record.
- Export a Secure Share bundle.
- Import the Secure Share bundle with the correct password and confirm imported record count.
- Try a wrong Secure Share password and confirm a clear failure message.

## Network And Security

- Run HIBP scan with Air-Gap enabled and confirm only the HIBP range allowlist path is permitted.
- Confirm cleartext network traffic is blocked by Network Security Config.
- Copy a password, wait for clipboard auto-clear, and confirm user-visible warning behavior if clearing fails.
- Confirm no vault secrets appear in logcat during normal unlock, copy, backup, or import actions.

## Release Notes Evidence

- Record APK filename, version, target ABI, and SHA-256 checksum.
- Record device model, Android version, and biometric availability.
- Attach any failure screenshots only if `FLAG_SECURE` allows non-sensitive setup screens.
- Mark the build as `unsigned community APK` unless release signing is active.
