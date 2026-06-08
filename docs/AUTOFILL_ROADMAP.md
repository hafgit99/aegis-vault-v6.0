# Autofill Roadmap

Status: Android v1 implemented and guarded; desktop browser extension POC scaffolded

## Security Model

- Autofill matching must never expose raw password values in the suggestion list.
- Candidate selection uses domain/package context, unlocked-vault state, entry type, and deletion state.
- Password fill should require an explicit user action through the OS autofill UI.
- Android Autofill must use `android.permission.BIND_AUTOFILL_SERVICE`.
- Desktop autofill should start as app-assisted copy/fill actions; browser extension or OS credential-provider integrations are separate projects.

## Shared Matching Layer

Implemented in `src/lib/autofillMatcher.ts`.

- Normalizes stored URLs and request origins into comparable domains.
- Ranks exact domain, subdomain, passkey domain, and conservative title fallback matches.
- Filters deleted entries, unsupported entry types, and forms without useful credential hints.
- Returns only metadata: id, title, username, domain, score, and capability flags.

## Android Path

Phase 1: complete

- Register `AegisAutofillService` in the Android manifest.
- Add Android readiness checks for the service metadata and binding permission.

Phase 2: complete

- Parse `AssistStructure` to detect username/password fields and web domains.
- Convert native Android Autofill context into the shared matcher request contract.
- Return an Android Autofill authentication response that opens AegisVault before any fill data is provided.
- Persist pending Android Autofill handoff context in app-private storage for the React vault session.
- Use a short-lived, single-use approved fill payload for Android dataset creation.
- Bridge Android Autofill requests to the unlocked web vault session.
- Require unlock/biometric confirmation before returning fill datasets.
- Return approved datasets through `AutofillManager.EXTRA_AUTHENTICATION_RESULT` so the Android framework performs the actual fill.
- Support multiple matching records with an explicit in-app selection sheet.
- Return `RESULT_CANCELED` when the user cancels selection so the browser form remains unchanged.

Deferred:

- Expand save prompts only after explicit user consent and the dedicated save threat model stay current.
- The Android save-prompt threat model is documented in `docs/AUTOFILL_SAVE_THREAT_MODEL.md`; `onSaveRequest` may stage short-lived local payloads, but record creation and updates must remain in the explicit AegisVault confirmation UI.

Phase 3:

- Expand real-device smoke across Chrome, Firefox, Samsung Internet, and Android app login forms.
- Keep release tests for locked vault, wrong-domain, subdomain, deleted-entry, passkey-only, and multiple-match flows.
- Add CI evidence that Android Autofill regression tests ran before every APK/AAB artifact build.

## Desktop Path

Phase 1:

- Reuse the shared matcher for in-app quick fill/copy suggestions.
- Add a keyboard-driven quick access panel scoped by typed domain/app name.

Phase 2:

- Chromium browser extension scaffold is in `browser-extension/chromium`.
- Native messaging manifest template is in `native-messaging/chromium/com.aegisvault.desktop.json`.
- Extension readiness gate is `npm run desktop:autofill:doctor`.
- Evaluate browser extension integration for Firefox after the Chromium native messaging host is working.
- Evaluate OS credential-provider style integrations separately for Windows/macOS/Linux because each platform has different APIs and security review requirements.

Phase 3:

- Implement a native messaging host or Tauri sidecar that speaks `aegisvault.desktopAutofill.v1`.
- Route fill requests to the running desktop app for unlock, domain matching, and explicit approval.
- Route save requests to a short-lived desktop pending-save handoff and show an AegisVault confirmation sheet.
- Add browser-extension smoke tests for wrong-domain, locked vault, multiple matches, save cancel, and save approve.
