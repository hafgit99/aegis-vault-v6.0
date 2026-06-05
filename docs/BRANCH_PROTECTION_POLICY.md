# Branch Protection Policy

This policy defines the repository protection rules required before AegisVault is distributed as a public desktop release.

## Protected Branches

The default protected branch is `main`.

If a temporary release branch is created, it must use the same protections until the release is tagged and closed.

## Required Pull Request Rules

Pull requests into `main` must require:

- At least one approving review before merge.
- All conversations resolved before merge.
- Branches up to date before merge when GitHub reports that the base branch moved.
- No force pushes.
- No branch deletion by regular contributors.
- Linear history when repository settings allow it.
- Administrator bypass disabled for release-critical changes unless the bypass is recorded in release evidence.

## Required Status Checks

The following checks are required before merging into `main`:

- `Quality Gate / Lint, unit coverage, build, and e2e`
- `CodeQL / Analyze JavaScript, TypeScript, and Rust`

The Quality Gate includes:

- production dependency audit
- GitHub Dependency Review on pull requests
- workflow permission audit
- dependency policy audit
- validation rules audit
- privacy notice audit
- release signing policy audit
- TypeScript lint gate
- security regression scan
- SBOM generation
- security evidence generation
- unit coverage
- production build
- build budget
- Chromium authenticated E2E
- Firefox smoke E2E
- mobile Firefox smoke E2E

## Release Required Checks

Before creating a public `v*` tag, release owners must confirm:

- `Release Preflight / Validate release candidate` passed for the release commit or tag.
- `Desktop Packaging / Release gate` passed when desktop artifacts are expected.
- `Desktop Packaging / Build desktop artifacts` completed for Windows, macOS, and Linux when public binaries are expected.
- Desktop artifacts include checksums, SBOM, and GitHub artifact attestations.
- Release notes disclose whether artifacts are unsigned, Windows-signed, macOS-signed, or fully signed.

## Evidence

Release evidence must include:

- links to the required status checks
- CodeQL code scanning status
- dependency review result for the release pull request
- SBOM artifact
- security evidence artifact
- desktop checksum manifest
- GitHub artifact attestation links
- any administrator bypass, failed check override, or unsigned artifact justification

## Verification

Run the policy verification gate before release:

```bash
npm run security:branch-protection
```

The local verification script confirms that this policy, workflow names, required checks, and release documentation remain wired together. It does not configure GitHub repository settings; enable the branch protection rules in GitHub repository settings before public releases.
