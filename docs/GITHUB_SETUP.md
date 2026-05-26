# GitHub Repository Setup

Repository: [github.com/hafgit99/aegis-vault-v6.0](https://github.com/hafgit99/aegis-vault-v6.0)

## Required Repository Settings

Enable these settings before the first public release:

- GitHub Actions enabled for the repository.
- Dependabot enabled for npm, Cargo, and GitHub Actions updates.
- Private vulnerability reporting enabled.
- Branch protection enabled for `main` or `master`.
- Required status checks:
  - `Quality Gate`
  - `Release Preflight`
  - `Desktop Packaging` for release branches or tags when desktop artifacts are expected.

## Required Secrets

Windows signing:

- `WINDOWS_CERTIFICATE`
- `WINDOWS_CERTIFICATE_PASSWORD`

macOS signing and notarization:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

## First v6.0.0 Release Flow

1. Push the repository to GitHub.
2. Confirm `Quality Gate` passes on the default branch.
3. Run `Release Preflight` manually.
4. Run `Desktop Packaging` in `unsigned` mode.
5. Download artifacts and verify `SHA256SUMS.txt`.
6. Create and push the release tag:

```bash
git tag v6.0.0
git push origin v6.0.0
```

7. Attach Windows, macOS, and Linux artifacts plus checksum files to the GitHub release.
8. Rerun desktop packaging in signed mode after certificates are configured.

## Local Remote

If this workspace is initialized as a git repository, set the remote with:

```bash
git remote add origin https://github.com/hafgit99/aegis-vault-v6.0.git
```

This workspace was not a git repository during setup, so the remote was documented but not applied locally.
