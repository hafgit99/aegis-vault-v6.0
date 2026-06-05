import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const templatePath = join(root, 'docs', 'RELEASE_NOTES_TEMPLATE.md');
const releasePath = join(root, 'docs', 'RELEASE.md');
const signingPolicyPath = join(root, 'docs', 'RELEASE_SIGNING_POLICY.md');
const smokePolicyPath = join(root, 'docs', 'DESKTOP_SMOKE_EVIDENCE.md');
const hardeningPath = join(root, 'docs', 'RELEASE_HARDENING.md');
const auditPath = join(root, 'docs', 'AUDIT_EVIDENCE.md');
const readmePath = join(root, 'README.md');
const evidenceScriptPath = join(root, 'scripts', 'generate-security-evidence.mjs');

const failures = [];

const read = (path) => {
  if (!existsSync(path)) {
    failures.push(`${path} is missing.`);
    return '';
  }

  return readFileSync(path, 'utf8');
};

const template = read(templatePath);
const release = read(releasePath);
const signingPolicy = read(signingPolicyPath);
const smokePolicy = read(smokePolicyPath);
const hardening = read(hardeningPath);
const audit = read(auditPath);
const readme = read(readmePath);
const evidenceScript = read(evidenceScriptPath);

const requiredTemplateTopics = [
  '# Release Notes Template',
  'Signing Mode Disclosure',
  'unsigned community build',
  '`unsigned`',
  '`windows`',
  '`macos`',
  '`all`',
  'SHA256SUMS.txt',
  'artifact-manifest.json',
  'CycloneDX SBOM',
  'GitHub artifact provenance attestation',
  'SECURITY_EVIDENCE_SUMMARY.md',
  'security-evidence-manifest.json',
  'Desktop Smoke Evidence',
  'Security evidence bundle verification',
  'Known Limitations',
  'Independent security report',
];

for (const topic of requiredTemplateTopics) {
  if (!template.includes(topic)) {
    failures.push(`docs/RELEASE_NOTES_TEMPLATE.md must include "${topic}".`);
  }
}

const docsThatMustReferenceTemplate = [
  [release, 'docs/RELEASE.md'],
  [signingPolicy, 'docs/RELEASE_SIGNING_POLICY.md'],
  [smokePolicy, 'docs/DESKTOP_SMOKE_EVIDENCE.md'],
  [hardening, 'docs/RELEASE_HARDENING.md'],
  [audit, 'docs/AUDIT_EVIDENCE.md'],
  [readme, 'README.md'],
];

for (const [content, name] of docsThatMustReferenceTemplate) {
  if (!content.includes('RELEASE_NOTES_TEMPLATE.md')) {
    failures.push(`${name} must reference docs/RELEASE_NOTES_TEMPLATE.md.`);
  }
}

if (!hardening.includes('Release notes template audit fails')) {
  failures.push('docs/RELEASE_HARDENING.md must list release notes template audit failures as release blockers.');
}

if (!audit.includes('npm run security:release-notes')) {
  failures.push('docs/AUDIT_EVIDENCE.md must include the release notes template verification command.');
}

if (!evidenceScript.includes('docs/RELEASE_NOTES_TEMPLATE.md')) {
  failures.push('scripts/generate-security-evidence.mjs must include docs/RELEASE_NOTES_TEMPLATE.md.');
}

if (failures.length > 0) {
  console.error('Release notes template verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Release notes template verification passed.');
