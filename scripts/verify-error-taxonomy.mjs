import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const taxonomyPath = join(root, 'docs', 'ERROR_TAXONOMY.md');
const implementationPath = join(root, 'src', 'lib', 'securityErrors.ts');
const backupCryptoPath = join(root, 'src', 'lib', 'backupCrypto.ts');
const secureSharePath = join(root, 'src', 'lib', 'secureShareBundle.ts');
const vaultServicePath = join(root, 'src', 'lib', 'vaultService.ts');
const testPath = join(root, 'test', 'unit', 'security-errors.test.ts');
const readmePath = join(root, 'README.md');
const releaseHardeningPath = join(root, 'docs', 'RELEASE_HARDENING.md');
const auditEvidencePath = join(root, 'docs', 'AUDIT_EVIDENCE.md');
const owaspPath = join(root, 'docs', 'OWASP_COMPLIANCE_MATRIX.md');

const failures = [];

const read = (path) => {
  if (!existsSync(path)) {
    failures.push(`${path} is missing.`);
    return '';
  }

  return readFileSync(path, 'utf8');
};

const taxonomy = read(taxonomyPath);
const implementation = read(implementationPath);
const backupCrypto = read(backupCryptoPath);
const secureShare = read(secureSharePath);
const vaultService = read(vaultServicePath);
const test = read(testPath);
const readme = read(readmePath);
const releaseHardening = read(releaseHardeningPath);
const auditEvidence = read(auditEvidencePath);
const owasp = read(owaspPath);

const requiredCodes = [
  'AUTH_CONFIG_MISSING',
  'AUTH_INVALID_CREDENTIALS',
  'VAULT_LOCKED',
  'BACKUP_ENCRYPTION_FAILED',
  'BACKUP_DECRYPTION_FAILED',
  'SECURE_SHARE_EMPTY',
  'SECURE_SHARE_UNSUPPORTED',
  'SECURE_SHARE_METADATA_INVALID',
  'SECURE_SHARE_EXPIRED',
  'SECURE_SHARE_ITEM_COUNT_MISMATCH',
  'UNKNOWN_SECURITY_ERROR',
];

for (const code of requiredCodes) {
  if (!implementation.includes(code)) {
    failures.push(`src/lib/securityErrors.ts must define ${code}.`);
  }
}

const requiredImplementationTopics = [
  'class AegisSecurityError',
  'createSecurityError',
  'classifySecurityError',
  'publicSecurityErrorMessage',
  'safeForUser',
  'category',
  'severity',
];

for (const topic of requiredImplementationTopics) {
  if (!implementation.includes(topic)) {
    failures.push(`src/lib/securityErrors.ts must include "${topic}".`);
  }
}

const requiredDocs = [
  '# Error Taxonomy',
  'AegisSecurityError',
  'publicSecurityErrorMessage',
  'auth',
  'crypto',
  'validation',
  'storage',
  'network',
  'release',
  'unknown',
  'npm run security:errors',
];

for (const topic of requiredDocs) {
  if (!taxonomy.includes(topic)) {
    failures.push(`docs/ERROR_TAXONOMY.md must include "${topic}".`);
  }
}

const integratedSources = [
  [backupCrypto, 'backupCrypto.ts', 'BACKUP_DECRYPTION_FAILED'],
  [backupCrypto, 'backupCrypto.ts', 'BACKUP_ENCRYPTION_FAILED'],
  [secureShare, 'secureShareBundle.ts', 'SECURE_SHARE_EXPIRED'],
  [secureShare, 'secureShareBundle.ts', 'SECURE_SHARE_ITEM_COUNT_MISMATCH'],
  [vaultService, 'vaultService.ts', 'AUTH_INVALID_CREDENTIALS'],
  [vaultService, 'vaultService.ts', 'VAULT_LOCKED'],
];

for (const [content, name, code] of integratedSources) {
  if (!content.includes(code)) {
    failures.push(`${name} must use ${code}.`);
  }
}

if (!test.includes('redacts unknown secret-bearing errors from public display')) {
  failures.push('test/unit/security-errors.test.ts must cover secret-bearing error redaction.');
}

const docsThatMustReferenceTaxonomy = [
  [readme, 'README.md'],
  [releaseHardening, 'docs/RELEASE_HARDENING.md'],
  [auditEvidence, 'docs/AUDIT_EVIDENCE.md'],
  [owasp, 'docs/OWASP_COMPLIANCE_MATRIX.md'],
];

for (const [content, name] of docsThatMustReferenceTaxonomy) {
  if (!content.includes('ERROR_TAXONOMY.md')) {
    failures.push(`${name} must reference docs/ERROR_TAXONOMY.md.`);
  }
}

if (!releaseHardening.includes('Error taxonomy audit fails')) {
  failures.push('docs/RELEASE_HARDENING.md must list error taxonomy audit failures as release blockers.');
}

if (!auditEvidence.includes('npm run security:errors')) {
  failures.push('docs/AUDIT_EVIDENCE.md must include the error taxonomy verification command.');
}

if (!owasp.includes('error taxonomy gate')) {
  failures.push('docs/OWASP_COMPLIANCE_MATRIX.md must cite error taxonomy evidence.');
}

if (failures.length > 0) {
  console.error('Error taxonomy verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Error taxonomy verification passed.');
