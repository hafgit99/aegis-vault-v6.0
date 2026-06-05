import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const evidenceDir = join(root, 'security-evidence');
const manifestPath = join(evidenceDir, 'security-evidence-manifest.json');
const checksumsPath = join(evidenceDir, 'SHA256SUMS.txt');
const summaryPath = join(evidenceDir, 'SECURITY_EVIDENCE_SUMMARY.md');

const failures = [];

const read = (path) => {
  if (!existsSync(path)) {
    failures.push(`${path} is missing.`);
    return '';
  }

  return readFileSync(path, 'utf8');
};

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

const manifestRaw = read(manifestPath);
const checksums = read(checksumsPath);
const summary = read(summaryPath);

let manifest;
try {
  manifest = JSON.parse(manifestRaw);
} catch (error) {
  failures.push('security-evidence-manifest.json must be valid JSON.');
  manifest = {};
}

const requiredCommands = [
  'npm run lint',
  'npm run security:scan',
  'npm run security:workflows',
  'npm run security:dependencies',
  'npm run security:validation',
  'npm run security:privacy',
  'npm run security:signing',
  'npm run security:branch-protection',
  'npm run security:desktop-smoke',
  'npm run security:logging',
  'npm run security:errors',
  'npm run security:sbom',
  'npm run security:evidence',
  'npm run audit:all',
  'npm run test:coverage',
  'npm run build',
  'npm run build:budget',
  'npm run test:e2e:release',
];

const requiredPolicyControls = [
  'Workflow permissions',
  'Dependency update policy',
  'Validation rules',
  'Privacy notice',
  'Release signing policy',
  'Branch protection policy',
  'Desktop smoke evidence policy',
  'Security logging policy',
  'Error taxonomy',
  'OWASP readiness matrix',
];

const requiredFiles = [
  'SECURITY.md',
  'README.md',
  'docs/SECURITY_MODEL.md',
  'docs/THREAT_MODEL.md',
  'docs/SECURE_SHARE_FORMAT.md',
  'docs/DEPENDENCY_POLICY.md',
  'docs/VALIDATION_RULES.md',
  'docs/PRIVACY_NOTICE.md',
  'docs/RELEASE_SIGNING_POLICY.md',
  'docs/RELEASE_NOTES_TEMPLATE.md',
  'docs/VULNERABILITY_DISCLOSURE.md',
  'docs/BRANCH_PROTECTION_POLICY.md',
  'docs/DESKTOP_SMOKE_EVIDENCE.md',
  'docs/SECURITY_LOGGING_POLICY.md',
  'docs/ERROR_TAXONOMY.md',
  'docs/OWASP_COMPLIANCE_MATRIX.md',
  'docs/RELEASE_HARDENING.md',
  'docs/AUDIT_EVIDENCE.md',
  'package-lock.json',
  'tsconfig.json',
  'src/lib/securityErrors.ts',
  'src/lib/secureShareBundle.ts',
  'scripts/check-build-budget.mjs',
  'scripts/generate-security-evidence.mjs',
  'scripts/verify-release-notes-template.mjs',
  'scripts/verify-vulnerability-disclosure.mjs',
  'scripts/verify-security-evidence-bundle.mjs',
  '.github/workflows/quality-gate.yml',
  '.github/workflows/release-preflight.yml',
  '.github/workflows/desktop-packaging.yml',
  '.github/workflows/codeql.yml',
  '.github/workflows/scheduled-quality.yml',
];

if (manifest.version !== JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version) {
  failures.push('Manifest version must match package.json version.');
}

if (manifest.algorithm !== 'SHA-256') {
  failures.push('Manifest algorithm must be SHA-256.');
}

for (const command of requiredCommands) {
  if (!manifest.releaseGateCommands?.includes(command)) {
    failures.push(`Manifest releaseGateCommands must include "${command}".`);
  }
  if (!summary.includes(`\`${command}\``)) {
    failures.push(`SECURITY_EVIDENCE_SUMMARY.md must include "${command}".`);
  }
}

const controls = new Set((manifest.policyEvidence ?? []).map((entry) => entry.control));
for (const control of requiredPolicyControls) {
  if (!controls.has(control)) {
    failures.push(`Manifest policyEvidence must include "${control}".`);
  }
  if (!summary.includes(control)) {
    failures.push(`SECURITY_EVIDENCE_SUMMARY.md must include "${control}".`);
  }
}

const manifestFiles = new Map((manifest.files ?? []).map((file) => [file.path, file]));
for (const relativePath of requiredFiles) {
  const manifestEntry = manifestFiles.get(relativePath);
  const copiedPath = join(evidenceDir, relativePath);

  if (!manifestEntry) {
    failures.push(`Manifest files must include ${relativePath}.`);
    continue;
  }

  if (!existsSync(copiedPath)) {
    failures.push(`Evidence bundle must include copied file ${relativePath}.`);
    continue;
  }

  const actualHash = sha256(copiedPath);
  if (manifestEntry.sha256 !== actualHash) {
    failures.push(`Manifest hash mismatch for ${relativePath}.`);
  }

  if (!checksums.includes(`${actualHash}  ${relativePath}`)) {
    failures.push(`SHA256SUMS.txt must include ${relativePath}.`);
  }
}

const requiredSummaryTopics = [
  '# AegisVault Security Evidence Summary',
  'External Evidence To Attach',
  'GitHub Quality Gate run URL',
  'Release Preflight run URL',
  'CodeQL code scanning status',
  'CycloneDX SBOM artifact',
  'Desktop artifact checksums',
  'Signing mode disclosure',
];

for (const topic of requiredSummaryTopics) {
  if (!summary.includes(topic)) {
    failures.push(`SECURITY_EVIDENCE_SUMMARY.md must include "${topic}".`);
  }
}

if (failures.length > 0) {
  console.error('Security evidence bundle verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Security evidence bundle verification passed.');
