# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| 6.x | Yes |

## Reporting a Vulnerability

Please report security issues privately through GitHub Security Advisories:

https://github.com/hafgit99/aegis-vault-v6.0/security/advisories/new

Do not open a public issue for vulnerabilities involving encryption, authentication, backup restoration, import parsing, release artifacts, or desktop packaging.

When reporting a vulnerability, include:

- Affected version, commit, or release artifact name.
- Operating system and browser or desktop shell.
- Reproduction steps and expected impact.
- Whether a vault, encrypted backup, import file, or desktop artifact is required to reproduce.
- Any proof-of-concept files, redacted where needed.

## Scope

Security reports are especially useful for:

- Vault encryption or key-derivation weaknesses.
- Backup export/import integrity problems.
- Authentication bypasses.
- SQLite/OPFS persistence defects that can expose data.
- Release artifact tampering or checksum mismatches.
- Desktop packaging, signing, or notarization issues.

## Security Model References

The current security design and audit boundary are documented in:

- [Security Model](docs/SECURITY_MODEL.md)
- [Threat Model](docs/THREAT_MODEL.md)
- [Release Hardening Checklist](docs/RELEASE_HARDENING.md)
- [Audit Evidence Matrix](docs/AUDIT_EVIDENCE.md)

These documents are the source of truth for what AegisVault is designed to protect against, what is out of scope, and which checks must pass before a sensitive release.

## Release Integrity

Desktop release artifacts should be published with:

- `SHA256SUMS.txt`
- `artifact-manifest.json`

Users should verify the SHA-256 checksum before installing desktop builds.

## Out of Scope

The current local-first release does not claim to provide:

- Cloud synchronization.
- Multi-user team vault authorization.
- Secure external share links.
- Remote account recovery.
- Protection after the local operating system account is fully compromised.
- Protection from malicious browser extensions or hostile WebView/runtime injection.

Future sync, sharing, and post-quantum recipient-key features must go through a separate threat-model review before release.
