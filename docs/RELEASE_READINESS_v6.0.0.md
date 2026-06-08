# AegisVault v6.0.0 Release Readiness

Date: 2026-06-08
Verified commit: `84a57a557d56180f8cf88631e661c72392eb6de4`
Status: release candidate ready for GitHub pre-release

## Passed Gates

- GitHub Actions quality gate passed on the verified commit.
- Desktop packaging workflow passed on the verified commit.
- Android packaging workflow passed on the verified commit.
- Windows artifact installed and launched successfully.
- Android artifact installed and launched successfully on a real device.
- Desktop Autofill opens AegisVault from the browser extension path and completes approved fill.
- Android Autofill fill flow completed through the Android Autofill framework.
- Android Autofill save flow staged a save request and persisted only after explicit in-app approval.
- App-private Android storage diagnostics reported healthy storage and encryption status.
- Release artifact integrity gates are active: undersized desktop installers are rejected before upload.

## Ready For

- GitHub `v6.0.0-rc1` pre-release.
- Controlled Windows and Android tester distribution.
- Release notes review with explicit unsigned desktop build disclosure.
- Final release smoke capture for Windows and Android.

## Not Yet Stable-Public Ready

- Windows and macOS artifacts are still unsigned community builds unless OS signing secrets are configured.
- macOS manual launch, lock/unlock, backup, Secure Share, and Gatekeeper smoke evidence is still required before stable macOS publication.
- Linux manual launch, package dependency, lock/unlock, backup, and Secure Share smoke evidence is still required before stable Linux publication.
- Desktop browser extension is not yet distributed through public browser extension stores.
- Independent external security review is still pending.

## Release Recommendation

Publish v6.0.0 first as a GitHub pre-release / release candidate. Mark Windows desktop artifacts as unsigned community builds. Mark Android artifacts according to the actual signing mode used by the workflow. Promote to stable only after the downloaded release artifacts are checksum-verified and the remaining target-platform smoke evidence is attached.

## Final Stable Checklist

- [ ] Create or confirm the final `v6.0.0` tag points to the verified release commit.
- [ ] Attach `aegisvault-windows`, `aegisvault-android`, SBOM, checksums, and artifact manifests.
- [ ] Add Windows manual smoke evidence to release notes.
- [ ] Add Android manual smoke evidence to release notes.
- [ ] Add macOS manual smoke evidence before publishing macOS binaries as stable.
- [ ] Add Linux manual smoke evidence before publishing Linux binaries as stable.
- [ ] Confirm release notes disclose unsigned desktop status.
- [ ] Confirm no plain-text secrets or private signing files are included in release artifacts.
