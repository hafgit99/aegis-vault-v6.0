# Future Crypto And Sync Roadmap

This roadmap captures larger product-level security features that should not be mixed into the local-first v6 release without separate design review.

## Phase 1: Secure Device Transfer

Goal: move an encrypted vault or recipient-wrapped export from one device to another without cloud sync.

Recommended approach:

- Keep payload encryption with AES-GCM.
- Use a one-time transfer key or recipient public key.
- Display QR or file-based transfer envelope.
- Require explicit user confirmation on both devices.
- Add replay protection and expiration.

## Phase 2: Post-Quantum Recipient Backup

Goal: allow an encrypted backup to be sealed to a recipient key instead of only a password.

Recommended approach:

- Use hybrid key establishment: classical public-key path plus ML-KEM-768.
- Derive the content encryption key through HKDF.
- Encrypt the actual backup payload with AES-GCM.
- Store algorithm identifiers and versioned envelope metadata.

ML-KEM should not replace AES-GCM. It should wrap or establish keys that are later used by symmetric encryption.

## Phase 3: Secure Share Links

Goal: share a single item or small bundle with another recipient.

Required before implementation:

- Dedicated threat model.
- Recipient identity and key verification design.
- Expiration, revocation, and access logging policy.
- Clear warning that public link compromise can expose shared payloads.

## Phase 4: Cloud Sync

Goal: synchronize encrypted vault state across devices.

Required before implementation:

- Conflict resolution model.
- Remote metadata minimization design.
- Sync envelope format.
- Replay and rollback protection.
- Server trust assumptions.

## Phase 5: Team / Organization Vaults

Goal: support shared vaults with multiple users and roles.

Required before implementation:

- Authorization model.
- User and device lifecycle.
- Admin recovery policy.
- Audit logging model.
- Key rotation and member removal design.

## Release Rule

Each phase must ship with:

- Updated threat model.
- Updated security model.
- Unit and E2E coverage.
- Migration plan.
- Rollback plan.
- External review checklist.
