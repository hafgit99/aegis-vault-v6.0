# Release Notes Template

Use this template for every public AegisVault release. Replace every placeholder before publishing.

## AegisVault v6.0.0

Release date:
Commit:
Release Preflight run:
Quality Gate run:
Desktop Packaging run:
Security evidence artifact:
SBOM artifact:

## Release Type

- [ ] Web build only
- [ ] Desktop artifacts included
- [ ] Security-sensitive release

## Signing Mode Disclosure

Signing mode:

- [ ] `unsigned`
- [ ] `windows`
- [ ] `macos`
- [ ] `all`

Required disclosure:

- Unsigned artifacts are clearly marked as **unsigned community build**.
- Windows signed artifacts were produced with Windows signing secrets configured.
- macOS signed artifacts were produced with Apple signing and notarization secrets configured.
- Linux artifacts include checksums and GitHub artifact attestations.

## Artifact Integrity

Attach or link:

- `SHA256SUMS.txt`
- `artifact-manifest.json`
- CycloneDX SBOM
- GitHub artifact provenance attestation
- GitHub SBOM attestation
- `SECURITY_EVIDENCE_SUMMARY.md`
- `security-evidence-manifest.json`

## Desktop Artifacts

| Platform | Artifact | SHA-256 | Signing status | Attestation URL | Smoke result |
| --- | --- | --- | --- | --- | --- |
| Windows |  |  | unsigned/windows/all |  | Pass/Fail |
| macOS |  |  | unsigned/macos/all |  | Pass/Fail |
| Linux |  |  | unsigned/all |  | Pass/Fail |

## Desktop Smoke Evidence

Attach the completed smoke evidence record from `docs/DESKTOP_SMOKE_EVIDENCE.md`.

Required minimum:

- lock screen screenshot
- unlocked vault shell screenshot
- vault create/unlock result
- encrypted backup export result
- malformed import rejection result
- Secure Share export/import result
- profile preset image check
- no unexpected external network request observed

## Security Gate Results

Record links or artifact names:

- Quality Gate
- Release Preflight
- CodeQL
- Dependency Review
- Production dependency audit
- Full dependency audit
- Security regression scan
- Workflow permission audit
- Dependency policy audit
- Validation rules audit
- Privacy notice audit
- Release signing policy audit
- Branch protection policy audit
- Desktop smoke policy audit
- Security logging policy audit
- Error taxonomy audit
- Security evidence bundle verification
- Unit coverage
- Build budget
- Release E2E
- Mutation testing when required

## Known Limitations

- AegisVault v6.0.0 is local-first and does not include cloud sync, hosted sharing links, or team vault authorization.
- Secure Share is an offline encrypted file format and does not provide hosted revocation or sender identity verification.
- Unsigned community build artifacts are not OS-native code signed and may trigger operating system trust prompts.
- Independent security review has not yet been completed unless an external report is linked below.

## Changes

- 

## Upgrade Notes

- 

## External Review

Vulnerability disclosure process: [VULNERABILITY_DISCLOSURE.md](VULNERABILITY_DISCLOSURE.md)
Independent security report:
Penetration test report:
Cryptographic review:
