import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const policyPath = join(root, 'docs', 'DESKTOP_SMOKE_EVIDENCE.md');
const readmePath = join(root, 'README.md');
const packagingPath = join(root, 'docs', 'DESKTOP_PACKAGING.md');
const releaseHardeningPath = join(root, 'docs', 'RELEASE_HARDENING.md');
const auditEvidencePath = join(root, 'docs', 'AUDIT_EVIDENCE.md');
const owaspPath = join(root, 'docs', 'OWASP_COMPLIANCE_MATRIX.md');
const desktopWorkflowPath = join(root, '.github', 'workflows', 'desktop-packaging.yml');
const qualityGatePath = join(root, '.github', 'workflows', 'quality-gate.yml');
const releasePreflightPath = join(root, '.github', 'workflows', 'release-preflight.yml');
const scheduledQualityPath = join(root, '.github', 'workflows', 'scheduled-quality.yml');

const failures = [];

const read = (path) => {
  if (!existsSync(path)) {
    failures.push(`${path} is missing.`);
    return '';
  }

  return readFileSync(path, 'utf8');
};

const policy = read(policyPath);
const readme = read(readmePath);
const packaging = read(packagingPath);
const releaseHardening = read(releaseHardeningPath);
const auditEvidence = read(auditEvidencePath);
const owasp = read(owaspPath);
const desktopWorkflow = read(desktopWorkflowPath);
const qualityGate = read(qualityGatePath);
const releasePreflight = read(releasePreflightPath);
const scheduledQuality = read(scheduledQualityPath);

const requiredPolicyTopics = [
  '# Desktop Smoke Evidence',
  'Windows installer or bundle',
  'macOS bundle or image',
  'Linux AppImage, deb, or package',
  'SHA-256 digest',
  'signing mode',
  'artifact attestation',
  'lock screen',
  'unlocked vault shell',
  'profile preset images',
  'Secure Share bundle',
  'Release Evidence Template',
  'Release Blocking Conditions',
  'npm run security:desktop-smoke',
];

for (const topic of requiredPolicyTopics) {
  if (!policy.includes(topic)) {
    failures.push(`docs/DESKTOP_SMOKE_EVIDENCE.md must include "${topic}".`);
  }
}

const docsThatMustReferencePolicy = [
  [readme, 'README.md'],
  [packaging, 'docs/DESKTOP_PACKAGING.md'],
  [releaseHardening, 'docs/RELEASE_HARDENING.md'],
  [auditEvidence, 'docs/AUDIT_EVIDENCE.md'],
  [owasp, 'docs/OWASP_COMPLIANCE_MATRIX.md'],
];

for (const [content, name] of docsThatMustReferencePolicy) {
  if (!content.includes('DESKTOP_SMOKE_EVIDENCE.md')) {
    failures.push(`${name} must reference docs/DESKTOP_SMOKE_EVIDENCE.md.`);
  }
}

const workflowsThatMustRunGate = [
  [desktopWorkflow, 'desktop-packaging.yml'],
  [qualityGate, 'quality-gate.yml'],
  [releasePreflight, 'release-preflight.yml'],
  [scheduledQuality, 'scheduled-quality.yml'],
];

for (const [content, name] of workflowsThatMustRunGate) {
  if (!content.includes('npm run security:desktop-smoke')) {
    failures.push(`${name} must run npm run security:desktop-smoke.`);
  }
}

const desktopWorkflowRequired = [
  'Build desktop artifacts',
  'aegisvault-macos',
  'aegisvault-linux',
  'aegisvault-windows',
  'Generate artifact checksums',
  'Attest desktop artifact provenance',
  'Upload desktop artifacts',
];

for (const topic of desktopWorkflowRequired) {
  if (!desktopWorkflow.includes(topic)) {
    failures.push(`desktop-packaging.yml must include "${topic}".`);
  }
}

if (!releaseHardening.includes('Desktop smoke evidence policy audit fails')) {
  failures.push('docs/RELEASE_HARDENING.md must list desktop smoke policy audit failures as release blockers.');
}

if (!auditEvidence.includes('npm run security:desktop-smoke')) {
  failures.push('docs/AUDIT_EVIDENCE.md must include the desktop smoke verification command.');
}

if (!owasp.includes('desktop smoke evidence')) {
  failures.push('docs/OWASP_COMPLIANCE_MATRIX.md must cite desktop smoke evidence.');
}

if (failures.length > 0) {
  console.error('Desktop smoke policy verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Desktop smoke policy verification passed.');
