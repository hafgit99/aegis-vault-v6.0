import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const policyPath = join(root, 'docs', 'BRANCH_PROTECTION_POLICY.md');
const readmePath = join(root, 'README.md');
const releaseHardeningPath = join(root, 'docs', 'RELEASE_HARDENING.md');
const auditEvidencePath = join(root, 'docs', 'AUDIT_EVIDENCE.md');
const owaspPath = join(root, 'docs', 'OWASP_COMPLIANCE_MATRIX.md');
const githubSetupPath = join(root, 'docs', 'GITHUB_SETUP.md');
const qualityGatePath = join(root, '.github', 'workflows', 'quality-gate.yml');
const codeqlPath = join(root, '.github', 'workflows', 'codeql.yml');
const releasePreflightPath = join(root, '.github', 'workflows', 'release-preflight.yml');
const desktopPackagingPath = join(root, '.github', 'workflows', 'desktop-packaging.yml');

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
const releaseHardening = read(releaseHardeningPath);
const auditEvidence = read(auditEvidencePath);
const owasp = read(owaspPath);
const githubSetup = read(githubSetupPath);
const qualityGate = read(qualityGatePath);
const codeql = read(codeqlPath);
const releasePreflight = read(releasePreflightPath);
const desktopPackaging = read(desktopPackagingPath);

const requiredPolicyTopics = [
  '# Branch Protection Policy',
  'main',
  'At least one approving review',
  'No force pushes',
  'All conversations resolved',
  'Quality Gate / Lint, unit coverage, build, and e2e',
  'CodeQL / Analyze JavaScript, TypeScript, and Rust',
  'GitHub Dependency Review',
  'Release Preflight / Validate release candidate',
  'Desktop Packaging / Release gate',
  'Desktop Packaging / Build desktop artifacts',
  'administrator bypass',
  'npm run security:branch-protection',
];

for (const topic of requiredPolicyTopics) {
  if (!policy.includes(topic)) {
    failures.push(`docs/BRANCH_PROTECTION_POLICY.md must include "${topic}".`);
  }
}

const qualityGateRequired = [
  'name: Quality Gate',
  'pull_request:',
  'branches:',
  '- main',
  'name: Lint, unit coverage, build, and e2e',
  'Dependency review',
  'npm run security:workflows',
  'npm run security:dependencies',
  'npm run security:validation',
  'npm run security:privacy',
  'npm run security:signing',
  'npm run security:branch-protection',
  'npm run test:e2e:chromium',
  'npm run test:e2e:firefox:smoke',
  'npm run test:e2e:mobile-firefox:smoke',
];

for (const topic of qualityGateRequired) {
  if (!qualityGate.includes(topic)) {
    failures.push(`quality-gate.yml must include "${topic}".`);
  }
}

const codeqlRequired = [
  'name: CodeQL',
  'Analyze JavaScript, TypeScript, and Rust',
  'pull_request:',
  'push:',
];

for (const topic of codeqlRequired) {
  if (!codeql.includes(topic)) {
    failures.push(`codeql.yml must include "${topic}".`);
  }
}

const releaseWorkflowRequired = [
  [releasePreflight, 'release-preflight.yml', 'name: Validate release candidate'],
  [releasePreflight, 'release-preflight.yml', 'npm run security:branch-protection'],
  [desktopPackaging, 'desktop-packaging.yml', 'name: Release gate'],
  [desktopPackaging, 'desktop-packaging.yml', 'name: Build desktop artifacts'],
  [desktopPackaging, 'desktop-packaging.yml', 'npm run security:branch-protection'],
];

for (const [content, name, topic] of releaseWorkflowRequired) {
  if (!content.includes(topic)) {
    failures.push(`${name} must include "${topic}".`);
  }
}

const documentationRequired = [
  [readme, 'README.md'],
  [releaseHardening, 'docs/RELEASE_HARDENING.md'],
  [auditEvidence, 'docs/AUDIT_EVIDENCE.md'],
  [owasp, 'docs/OWASP_COMPLIANCE_MATRIX.md'],
  [githubSetup, 'docs/GITHUB_SETUP.md'],
];

for (const [content, name] of documentationRequired) {
  if (!content.includes('BRANCH_PROTECTION_POLICY.md')) {
    failures.push(`${name} must reference docs/BRANCH_PROTECTION_POLICY.md.`);
  }
}

if (!releaseHardening.includes('Branch protection policy audit fails')) {
  failures.push('docs/RELEASE_HARDENING.md must list branch protection audit failures as release blockers.');
}

if (!auditEvidence.includes('npm run security:branch-protection')) {
  failures.push('docs/AUDIT_EVIDENCE.md must include the branch protection verification command.');
}

if (!owasp.includes('branch protection policy gate')) {
  failures.push('docs/OWASP_COMPLIANCE_MATRIX.md must cite branch protection policy evidence.');
}

if (failures.length > 0) {
  console.error('Branch protection policy verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Branch protection policy verification passed.');
