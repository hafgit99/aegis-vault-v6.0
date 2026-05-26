# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| 6.x | Yes |

## Reporting a Vulnerability

Please report security issues privately through GitHub Security Advisories:

https://github.com/hafgit99/aegis-vault-v6.0/security/advisories/new

Do not open a public issue for vulnerabilities involving encryption, authentication, backup restoration, import parsing, release artifacts, or desktop packaging.

## Scope

Security reports are especially useful for:

- Vault encryption or key-derivation weaknesses.
- Backup export/import integrity problems.
- Authentication bypasses.
- SQLite/OPFS persistence defects that can expose data.
- Release artifact tampering or checksum mismatches.
- Desktop packaging, signing, or notarization issues.

## Release Integrity

Desktop release artifacts should be published with:

- `SHA256SUMS.txt`
- `artifact-manifest.json`

Users should verify the SHA-256 checksum before installing desktop builds.
