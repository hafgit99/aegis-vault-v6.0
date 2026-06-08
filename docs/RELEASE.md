# Release Process

This project currently ships as a Vite web build. Windows, macOS, and Linux desktop installers should use Tauri as the default runtime unless a future requirement needs Electron's bundled Chromium behavior.

Repository: [github.com/hafgit99/aegis-vault-v6.0](https://github.com/hafgit99/aegis-vault-v6.0)

## Current Release Gate

Before publishing or attaching artifacts to a GitHub release, run:

```bash
npm ci
npm run release:verify-version
npm run audit:all
npm run test:all
```

For sensitive releases, run mutation testing after the preflight gate:

```bash
npm run test:mutation:release
```

The E2E strategy is split deliberately:

- Chromium runs the full authenticated SQLite/OPFS vault suite.
- Firefox runs lock-screen compatibility smoke coverage.
- Mobile Firefox runs responsive lock-screen compatibility smoke coverage.

This avoids misleading Firefox skips while still keeping Firefox in the release pipeline.

## GitHub Actions

- `Quality Gate` runs on pull requests and pushes to `main` or `master`.
- `Release Preflight` runs manually and on version tags.
- `Scheduled Quality` runs weekly and can be started manually to detect dependency or platform drift.
- `Mutation Testing` runs weekly and can be started manually for a selected profile.
- `Desktop Packaging` runs on `v*` tags and can also be started manually. It builds Windows, macOS, and Linux artifacts with SHA-256 manifests. Manual runs default to unsigned artifacts and can be switched to Windows, macOS, or all-platform signing after secrets are configured.

The preflight workflow uploads:

- `sbom`
- `security-evidence`
- `web-dist`
- `coverage-report`
- `playwright-report`

Mutation reports are uploaded by the `Mutation Testing` workflow when it runs.

`Scheduled Quality` is intentionally separate from `Mutation Testing`: it gives a faster weekly signal for dependency audit, coverage thresholds, build budget, and release E2E before the slower mutation workflow runs.

`Release Preflight` and `Desktop Packaging` verify that `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock` all use the same release version. On tag builds, the tag must match the project version, for example `v6.0.0`.

## Desktop Packaging Roadmap

Tauri is the recommended desktop runtime for AegisVault because it keeps installers smaller, limits the default runtime surface, and fits the existing Vite build without changing the application architecture.

The manual `Desktop Packaging` workflow runs the release gate first, then builds desktop artifacts. Until Windows Authenticode and Apple Developer ID certificates are configured, public binaries must be labeled **unsigned community build**:

- Windows: unsigned community build `.exe` or `.msi` by default; signed after Windows certificate secrets are configured.
- macOS: unsigned community build `.dmg` by default; signed and notarized after Apple Developer ID secrets are configured.
- Linux: `.AppImage` or `.deb`

The packaging workflow depends on the same release gate and does not replace it. Packaging only starts after lint, coverage, build, budget, and E2E preflight pass.

Each uploaded desktop artifact includes `SHA256SUMS.txt` and `artifact-manifest.json`. The desktop packaging workflow also creates GitHub artifact attestations for build provenance and SBOM evidence. Publish checksums and manifests with release artifacts so users and maintainers can verify downloads before installing.

After downloading the GitHub Actions artifacts into a single local directory, verify the release payload before creating the GitHub Release:

```bash
npm run release:verify-artifacts -- C:\path\to\downloaded-release-artifacts
```

The verification command requires `aegisvault-windows` and `aegisvault-android`, validates `SHA256SUMS.txt`, checks `artifact-manifest.json`, verifies SHA-256 digests, and rejects undersized installer/APK/AAB files. macOS and Linux artifact directories are checked when present.

Use [RELEASE_NOTES_TEMPLATE.md](RELEASE_NOTES_TEMPLATE.md) for every public release. The template requires signing mode disclosure, checksums, SBOM, artifact attestations, security evidence, and desktop smoke evidence before publishing.

For the first public `v6.0.0` desktop release, let the tag-triggered `Desktop Packaging` workflow produce **unsigned community build** artifacts first. Release notes, artifact names, and download descriptions must clearly state that these binaries are unsigned community builds and may trigger operating system trust prompts. After unsigned Windows/macOS/Linux artifacts are stable, rerun the workflow manually in the relevant signed mode once certificate secrets are configured.

Create the release tag from a clean main branch after the release gate passes:

```bash
git tag v6.0.0
git push origin v6.0.0
```

The `Release Preflight` workflow runs automatically on `v*` tags.

See [DESKTOP_PACKAGING.md](DESKTOP_PACKAGING.md) for the decision matrix, signing secret plan, and desktop smoke test scope.
