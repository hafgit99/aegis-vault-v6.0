# Android Signing Key Rotation

Status: required if any Android signing material was ever committed or shared outside a dedicated secret manager.

## Why This Matters

If `.jks`, `.keystore`, `release-keystore.properties`, `.p12`, or `.pfx` files were ever committed to git history, the signing key must be treated as compromised even if the files are no longer tracked in the latest commit.

Do not publish new Android releases with a potentially exposed key.

## Immediate Actions

1. Generate a new Android release keystore outside the repository.
2. Update GitHub Actions secrets:
   - `ANDROID_RELEASE_KEYSTORE_BASE64`
   - `RELEASE_STORE_PASSWORD`
   - `RELEASE_KEY_ALIAS`
   - `RELEASE_KEY_PASSWORD`
3. Delete local repository copies of `.secrets/` after the new secrets are confirmed in GitHub.
4. Keep signing files in a password manager or dedicated offline secret store, not in the repo directory.
5. Use Google Play App Signing for Play Store releases. If an upload key was exposed, rotate the upload key in Play Console.

## Git History Cleanup

History cleanup rewrites commit IDs and should be coordinated before running on a shared repository.

Recommended BFG flow:

```bash
git clone --mirror https://github.com/hafgit99/aegis-vault-v6.0.git aegis-vault-v6.0.git
cd aegis-vault-v6.0.git
bfg --delete-folders .secrets --delete-files '*.jks' --delete-files 'release-keystore.properties'
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all
git push --force --tags
```

After force-pushing cleaned history, every collaborator must reclone or hard-reset to the rewritten repository.

## Repository Guard

The release gate includes:

```bash
npm run security:no-secrets
```

This fails if signing material is tracked again. It does not prove that older public git history is clean; use the BFG procedure above for historical cleanup.
