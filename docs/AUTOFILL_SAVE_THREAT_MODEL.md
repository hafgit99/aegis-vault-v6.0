# Android Autofill Save Prompt Threat Model

This document defines the security baseline for Android Autofill save prompts in AegisVault. `AegisAutofillService.onSaveRequest` may stage credentials only for explicit in-app approval; it must never create or update records by itself.

## Scope

The feature may suggest saving credentials that the user typed into an Android Autofill-compatible browser or app login form.

Allowed v1 scope:

- Login credentials only: title, website or app package, username, and password.
- User-initiated confirmation inside AegisVault before a vault record is created.
- Local-only processing through Android app-private storage.
- Native capture uses `pending_autofill_save_request.json` as a short-lived app-private handoff file.
- No background save, no silent capture, and no save prompt for passkeys, cards, notes, identities, or TOTP secrets.

Out of scope:

- Hosted save prompts.
- Cloud sync of newly captured credentials.
- Automatic update of an existing record without explicit confirmation.
- Saving credentials from WebViews or apps when no meaningful web domain or package identity can be derived.

## Assets

- Newly typed username and password values.
- Web domain or Android package name associated with the save request.
- Existing vault records used for duplicate detection.
- Local security log entries describing the save decision.

## Trust Boundaries

| Boundary | Risk | Required Control |
| --- | --- | --- |
| Android Autofill framework | May provide fields from hostile or malformed forms. | Parse only username/password roles and reject incomplete contexts. |
| Browser or third-party app | May spoof visual login flows. | Prefer verified web domains; require explicit user review for app package-only requests. |
| AegisVault native bridge | Carries plaintext credentials temporarily. | Use app-private storage only, short expiry, single-use payloads, and clear after decision. |
| AegisVault UI | User approves or rejects save. | Show target, username, duplicate status, and risk warning before creating a record. |

## Required Security Properties

- Save prompts must never create or update a vault record without an explicit in-app user confirmation.
- Plaintext save payloads must be short-lived, single-use, stored only in Android app-private storage, and deleted after approve, reject, timeout, or malformed parse.
- Save prompts must require both a non-empty password and either a meaningful web domain or a meaningful Android package name.
- Browser save prompts must require a verified web domain; package-only browser contexts such as address bars must be rejected.
- Web-domain save requests must not fall back to weak title-only matching.
- Package-only save requests must use meaningful package tokens and must show the package name clearly to the user.
- Existing matching records must be detected before offering to create a new record.
- Updating an existing record must be a separate explicit choice from creating a new record.
- Passkey-only or passwordless forms must not trigger password save prompts.
- Security logs may mention target and action outcome, but must never include usernames, passwords, or raw form values.

## Abuse Cases

| Abuse Case | Expected Behavior |
| --- | --- |
| Malicious page asks to save a password for a different visible brand. | AegisVault shows the actual detected domain and does not infer a trusted brand from page text. |
| Android app package is generic or misleading. | Save prompt is rejected or shown with a high-friction package-only warning. |
| Browser address bar or browser UI is mistaken for a password form. | Save prompt is rejected because known browser packages must expose a web domain. |
| Form contains only a password field. | Save prompt is rejected unless a username can be safely derived from Android hints. |
| User cancels the in-app prompt. | Payload is cleared and no vault record is created. |
| Save payload expires before approval. | Payload is cleared and the user must retry from the login form. |
| Existing record already matches the target and username. | UI offers explicit update or dismiss; it does not create a duplicate by default. |
| App crashes during save handoff. | Payload expires and is cleared on the next startup or save attempt. |

## Implementation Gate

Before expanding `onSaveRequest` beyond the current guarded staging flow:

- Add a native pending-save payload with expiry and single-use clear semantics. Status: implemented; native capture remains limited to Android app-private storage.
- Add frontend parsing for pending save requests that refuses malformed payloads. Status: implemented.
- Add an in-app save confirmation sheet with create, update, and dismiss paths. Status: implemented as an explicit approval scaffold.
- Add unit tests for malformed, expired, duplicate, wrong-domain, package-only, cancel, create, and update flows.
- Add Android readiness checks proving save prompt capture remains explicit and single-use.
- Add real-device smoke coverage to `docs/ANDROID_SMOKE_CHECKLIST.md`.

The native service may stage a save request only when a password value is present and a web domain or Android package target exists. Known browser packages must provide a web domain before a save prompt is allowed; package-only browser contexts are treated as browser chrome, not website login forms. Record creation or update remains exclusively controlled by the AegisVault confirmation UI.
