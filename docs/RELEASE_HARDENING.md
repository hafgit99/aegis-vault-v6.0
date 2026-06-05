# Release Hardening Checklist

Use this checklist before public releases, desktop packaging, or external security review.

## Required Local Gate

Run from a clean working tree or document all intentional uncommitted changes:

```bash
npm ci
npm run release:verify-version
npm run audit:all
npm run test:all
```

For sensitive security releases:

```bash
npm run test:mutation:release
```

## Required Desktop Gate

For desktop releases:

```bash
npm run desktop:build
npm run desktop:checksums
```

Published artifacts must include:

- Windows installer or bundle.
- macOS bundle or image.
- Linux AppImage or package.
- `SHA256SUMS.txt`.
- `artifact-manifest.json`.
- GitHub artifact provenance attestation.
- GitHub SBOM attestation.

Signed releases must record signing mode and configured secrets in the release notes without revealing secret values. Unsigned public binaries must be disclosed as **unsigned community build** artifacts in release notes, artifact tables, and download descriptions.

## Security Review Checklist

- No plaintext master password persistence.
- No demo password or hardcoded unlock fallback.
- No production `Math.random()` in secret generation paths.
- No direct clipboard secret writes outside the clipboard helper.
- New vault saves encrypt user-visible metadata.
- Backup export requires an explicit backup password for encrypted export.
- Plain backup export remains behind acknowledgement.
- Secure Share export requires a separate transfer password.
- Secure Share import rejects unsupported version, malformed metadata, invalid expiry, expired bundles, manifest checksum tampering, and item-count tampering.
- WebAuthn code does not claim to register credentials for third-party origins.
- TOTP secret is encrypted before persistence.
- Tauri commands are narrow and documented.
- CSP blocks external network access unless explicitly justified.

## Documentation Checklist

- `SECURITY.md` reporting path is correct.
- `docs/SECURITY_MODEL.md` reflects current implementation.
- `docs/THREAT_MODEL.md` lists current non-goals.
- `docs/SECURE_SHARE_FORMAT.md` reflects the current bundle format and validation contract.
- `docs/DEPENDENCY_POLICY.md` reflects the current Dependabot schedule and triage SLA.
- `docs/VALIDATION_RULES.md` reflects current import, export, vault entry, search, and profile input rules.
- `docs/PRIVACY_NOTICE.md` reflects current local-first storage, network, telemetry, and export behavior.
- `docs/KVKK_GDPR_COMPLIANCE.md` reflects the current Turkey/EU distribution privacy posture.
- `docs/RELEASE_SIGNING_POLICY.md` reflects current desktop signing modes, required secrets, and artifact integrity rules.
- `docs/BRANCH_PROTECTION_POLICY.md` reflects current required status checks, branch protection rules, and release evidence expectations.
- `docs/DESKTOP_SMOKE_EVIDENCE.md` reflects current packaged desktop smoke evidence expectations.
- `docs/SECURITY_LOGGING_POLICY.md` reflects current local security log retention, severity, and sensitive-data rules.
- `docs/ERROR_TAXONOMY.md` reflects current security-sensitive error codes, categories, severity, and public-message rules.
- `docs/RELEASE_NOTES_TEMPLATE.md` reflects current artifact integrity, signing disclosure, and smoke evidence requirements.
- `docs/VULNERABILITY_DISCLOSURE.md` reflects current private reporting, triage, advisory, and incident-response rules.
- `docs/OWASP_COMPLIANCE_MATRIX.md` reflects the latest OWASP readiness status.
- `docs/AUDIT_EVIDENCE.md` includes the latest test and build outputs.
- `sbom/` has been generated and uploaded as a CI artifact.
- `security-evidence/` has been generated, verified, and uploaded as a CI artifact, including `security-evidence-manifest.json`, `SHA256SUMS.txt`, and `SECURITY_EVIDENCE_SUMMARY.md`.
- Release notes disclose unsigned/signed artifact status, including the exact **unsigned community build** wording when signing mode is `unsigned`.

## Manual Smoke Checklist

- Create new vault.
- Unlock existing vault.
- Add login with password and TOTP.
- Add passkey record through WebAuthn-capable browser or desktop shell.
- Export encrypted backup.
- Import encrypted backup with correct and incorrect password.
- Export Secure Share bundle and confirm the file contains no plaintext title, username, password, notes, TOTP, card, identity, or passkey fields.
- Import Secure Share bundle with correct transfer password.
- Verify the Secure Share import review displays `v1.1` manifest verification and a checksum prefix.
- Verify expired Secure Share bundle is rejected before import.
- Lock vault and verify secrets are cleared from active UI.
- Desktop launch on each target operating system.

## Release Blockers

Do not release when any of the following are true:

- Coverage gate fails.
- Production dependency audit has high or critical unresolved findings.
- SBOM generation fails.
- CodeQL reports unresolved high-confidence security findings.
- Workflow permission audit fails.
- Dependency policy audit fails.
- Validation rules audit fails.
- Secure Share format policy audit fails.
- Privacy notice audit fails.
- Release signing policy audit fails.
- Branch protection policy audit fails.
- Desktop smoke evidence policy audit fails.
- Security logging policy audit fails.
- Error taxonomy audit fails.
- Release notes template audit fails.
- Vulnerability disclosure policy audit fails.
- Security evidence bundle verification fails.
- Build budget fails without documented approval.
- E2E release gate fails.
- Desktop artifact checksum generation fails.
- Desktop artifact attestation generation fails.
- Any known issue exposes plaintext vault secrets without user opt-in.
- New sync/share/team feature ships without a dedicated threat model.
