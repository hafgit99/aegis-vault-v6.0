# Autofill Roadmap

Status: foundation in progress

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

Phase 1:

- Register `AegisAutofillService` in the Android manifest.
- Keep the service safe by returning no datasets until the vault bridge is ready.
- Add Android readiness checks for the service metadata and binding permission.

Phase 2:

- Parse `AssistStructure` to detect username/password fields and web domains.
- Convert native Android Autofill context into the shared matcher request contract.
- Return an Android Autofill authentication response that opens AegisVault before any fill data is provided.
- Bridge Android Autofill requests to the unlocked web vault session.
- Require unlock/biometric confirmation before returning fill datasets.
- Add save prompts only after explicit user consent.

Phase 3:

- Real-device smoke on Chrome, Firefox, and Android app login forms.
- Test locked vault, wrong-domain, subdomain, deleted-entry, and passkey-only flows.

## Desktop Path

Phase 1:

- Reuse the shared matcher for in-app quick fill/copy suggestions.
- Add a keyboard-driven quick access panel scoped by typed domain/app name.

Phase 2:

- Evaluate browser extension integration for Chromium/Firefox.
- Evaluate OS credential-provider style integrations separately for Windows/macOS/Linux because each platform has different APIs and security review requirements.
