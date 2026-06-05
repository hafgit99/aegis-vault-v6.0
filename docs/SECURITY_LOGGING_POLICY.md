# Security Logging Policy

This policy defines how AegisVault records local security events without turning logs into a second vault.

## Scope

AegisVault security logs are local application activity records. They help users understand local security events such as unlock attempts, lock actions, imports, exports, settings changes, backup activity, and destructive operations.

Security logs are not telemetry, analytics, crash reports, or remote audit trails.

## Storage And Retention

- Logs are stored only in local browser or desktop storage under `aegis_security_logs`.
- Logs are never sent to AegisVault servers because there is no hosted AegisVault service in the local-first release.
- The app keeps only the most recent 200 security log entries.
- Clearing logs removes the prior local timeline and leaves one local "log cleared" event.
- Release evidence must confirm that log storage remains local-only before public releases.

## Sensitive Data Rules

Security logs must not include:

- master passwords
- backup passwords
- Secure Share transfer passwords
- TOTP secrets or generated TOTP codes
- card numbers, CVV values, identity numbers, or document attachment bytes
- raw encrypted payloads, salts, IVs, keys, or device secrets
- full imported file contents

Security logs may include concise user-facing event labels, item titles, counts, import source names, and severity labels when useful for local auditability.

## Severity Rules

Use severities consistently:

- `info`: successful routine events, diagnostics, profile updates, local sync markers
- `warning`: security posture changes, failed imports, lock/auto-lock actions, backup/export/import activity, trash movement
- `critical`: permanent deletion, full wipe, failed unlock attempts, destructive storage events

## Release Review

Before a public release, review newly added `onAddLog`, `addSecurityLog`, and translated log messages for secret leakage. New log messages must be concise and must not interpolate raw secret-bearing fields.

## Verification

Run the policy verification gate before release:

```bash
npm run security:logging
```

The verification script confirms that the security logging policy, retention constant, clear-log behavior, release hardening checklist, audit evidence, and OWASP matrix remain wired together.
