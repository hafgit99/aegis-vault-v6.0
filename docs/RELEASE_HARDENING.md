# Release Hardening Checklist

Use this checklist before public releases, desktop packaging, or external security review.

## Required Local Gate

Run from a clean working tree or document all intentional uncommitted changes:

```bash
npm ci
npm run release:verify-version
npm run lint
npm run security:scan
npm run security:evidence
npm run audit:all
npm run test:coverage
npm run build
npm run build:budget
npm run test:e2e:release
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

Signed releases must record signing mode and configured secrets in the release notes without revealing secret values.

## Security Review Checklist

- No plaintext master password persistence.
- No demo password or hardcoded unlock fallback.
- No production `Math.random()` in secret generation paths.
- No direct clipboard secret writes outside the clipboard helper.
- New vault saves encrypt user-visible metadata.
- Backup export requires an explicit backup password for encrypted export.
- Plain backup export remains behind acknowledgement.
- WebAuthn code does not claim to register credentials for third-party origins.
- TOTP secret is encrypted before persistence.
- Tauri commands are narrow and documented.
- CSP blocks external network access unless explicitly justified.

## Documentation Checklist

- `SECURITY.md` reporting path is correct.
- `docs/SECURITY_MODEL.md` reflects current implementation.
- `docs/THREAT_MODEL.md` lists current non-goals.
- `docs/OWASP_COMPLIANCE_MATRIX.md` reflects the latest OWASP readiness status.
- `docs/AUDIT_EVIDENCE.md` includes the latest test and build outputs.
- `security-evidence/` has been generated and uploaded as a CI artifact.
- Release notes disclose unsigned/signed artifact status.

## Manual Smoke Checklist

- Create new vault.
- Unlock existing vault.
- Add login with password and TOTP.
- Add passkey record through WebAuthn-capable browser or desktop shell.
- Export encrypted backup.
- Import encrypted backup with correct and incorrect password.
- Lock vault and verify secrets are cleared from active UI.
- Desktop launch on each target operating system.

## Release Blockers

Do not release when any of the following are true:

- Coverage gate fails.
- Production dependency audit has high or critical unresolved findings.
- Build budget fails without documented approval.
- E2E release gate fails.
- Desktop artifact checksum generation fails.
- Any known issue exposes plaintext vault secrets without user opt-in.
- New sync/share/team feature ships without a dedicated threat model.
