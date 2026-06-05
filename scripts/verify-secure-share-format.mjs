import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const paths = {
  format: join(root, 'docs', 'SECURE_SHARE_FORMAT.md'),
  securityModel: join(root, 'docs', 'SECURITY_MODEL.md'),
  threatModel: join(root, 'docs', 'THREAT_MODEL.md'),
  validationRules: join(root, 'docs', 'VALIDATION_RULES.md'),
  releaseHardening: join(root, 'docs', 'RELEASE_HARDENING.md'),
  auditEvidence: join(root, 'docs', 'AUDIT_EVIDENCE.md'),
  implementation: join(root, 'src', 'lib', 'secureShareBundle.ts'),
  importWorkflow: join(root, 'src', 'lib', 'importWorkflow.ts'),
  packageJson: join(root, 'package.json'),
  mutationConfig: join(root, 'stryker.secure-share.config.json'),
  mutationWorkflow: join(root, '.github', 'workflows', 'mutation-testing.yml'),
  mutationPolicy: join(root, 'docs', 'MUTATION_POLICY.md'),
  e2e: join(root, 'test', 'e2e', 'authenticated-settings-transfer.spec.ts'),
  unit: join(root, 'test', 'unit', 'secure-share-bundle.test.ts'),
  importUnit: join(root, 'test', 'unit', 'import-workflow.test.ts'),
};

const failures = [];

const read = (path) => {
  if (!existsSync(path)) {
    failures.push(`${path} is missing.`);
    return '';
  }

  return readFileSync(path, 'utf8');
};

const files = Object.fromEntries(
  Object.entries(paths).map(([key, path]) => [key, read(path)]),
);

const requireIncludes = (content, name, topics) => {
  for (const topic of topics) {
    if (!content.includes(topic)) {
      failures.push(`${name} must include "${topic}".`);
    }
  }
};

requireIncludes(files.format, 'docs/SECURE_SHARE_FORMAT.md', [
  'Current writer version: `1.1`',
  '`1.0` | Legacy readable',
  'checksumAlgorithm',
  'manifest.checksum',
  'Manifest mismatch',
  'Import UX Evidence',
  'Legacy `v1.0` bundles should be importable',
]);

requireIncludes(files.implementation, 'src/lib/secureShareBundle.ts', [
  "const SECURE_SHARE_VERSION = '1.1'",
  "new Set(['1.0', '1.1'])",
  'SecureShareManifest',
  'sha256Hex',
  'SECURE_SHARE_MANIFEST_MISMATCH',
  'openSecureShareBundleWithReport',
]);

requireIncludes(files.importWorkflow, 'src/lib/importWorkflow.ts', [
  'openSecureShareBundleWithReport',
  'secureShareManifestChecksum',
  'secureShareManifestVerified',
  'secureShareVersion',
]);

requireIncludes(files.validationRules, 'docs/VALIDATION_RULES.md', [
  'current `v1.1` includes SHA-256 manifest',
  'payload checksum',
  'Produces `v1.1` Secure Share bundle with manifest checksum',
]);

requireIncludes(files.securityModel, 'docs/SECURITY_MODEL.md', [
  'v1.1 SHA-256 payload manifest',
  'manifest checksum mismatches',
]);

requireIncludes(files.threatModel, 'docs/THREAT_MODEL.md', [
  'v1.1 SHA-256 manifest verification',
  'manifest-checksum tampered',
]);

requireIncludes(files.releaseHardening, 'docs/RELEASE_HARDENING.md', [
  'manifest checksum tampering',
  'Verify the Secure Share import review displays `v1.1` manifest verification',
  'Secure Share format policy audit fails',
]);

requireIncludes(files.auditEvidence, 'docs/AUDIT_EVIDENCE.md', [
  'Secure Share bundle encryption, v1.1 manifest integrity, and validation',
  'npm run security:secure-share',
  'Secure Share `v1.1` manifest evidence',
  'npm run test:mutation:secure-share',
  '85.26% mutation score overall',
]);

requireIncludes(files.unit, 'test/unit/secure-share-bundle.test.ts', [
  'verifies v1.1 integrity manifests',
  'manifestVerified: true',
  'manifestVerified: false',
  'integrity manifest does not match payload',
]);

requireIncludes(files.importUnit, 'test/unit/import-workflow.test.ts', [
  'imports legacy PBKDF2 encrypted backups only after explicit approval',
  'parses plain Aegis vault arrays and wrapped vault payloads with parse evidence',
  'secureShareManifestChecksum',
]);

requireIncludes(files.e2e, 'test/e2e/authenticated-settings-transfer.spec.ts', [
  'imports a v1.1 secure share bundle and shows manifest evidence',
  'Manifest v1\\.1 verified, checksum',
  'Secure Share import',
]);

requireIncludes(files.packageJson, 'package.json', [
  '"security:secure-share": "node scripts/verify-secure-share-format.mjs"',
  '"test:mutation:secure-share": "stryker run stryker.secure-share.config.json"',
  'npm run test:mutation:secure-share && npm run test:mutation:sqlite',
]);

requireIncludes(files.mutationConfig, 'stryker.secure-share.config.json', [
  'src/lib/secureShareBundle.ts',
  'src/lib/importWorkflow.ts',
  'test/unit/secure-share-bundle.test.ts',
  'test/unit/import-workflow.test.ts',
  '"high": 85',
  '"low": 80',
  '"break": 75',
]);

requireIncludes(files.mutationWorkflow, '.github/workflows/mutation-testing.yml', [
  '- secure-share',
  'npm run test:mutation:secure-share',
]);

requireIncludes(files.mutationPolicy, 'docs/MUTATION_POLICY.md', [
  '`npm run test:mutation:secure-share`',
  'Secure Share has a high threshold',
]);

if (failures.length > 0) {
  console.error('Secure Share format verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Secure Share format verification passed.');
