import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflowPath = join(process.cwd(), '.github', 'workflows', 'desktop-packaging.yml');
const policyPath = join(process.cwd(), 'docs', 'RELEASE_SIGNING_POLICY.md');
const releasePath = join(process.cwd(), 'docs', 'RELEASE_HARDENING.md');
const owaspPath = join(process.cwd(), 'docs', 'OWASP_COMPLIANCE_MATRIX.md');
const desktopPath = join(process.cwd(), 'docs', 'DESKTOP_PACKAGING.md');

const workflow = readFileSync(workflowPath, 'utf8');
const policy = readFileSync(policyPath, 'utf8');
const release = readFileSync(releasePath, 'utf8');
const owasp = readFileSync(owaspPath, 'utf8');
const desktop = readFileSync(desktopPath, 'utf8');

const failures = [];

for (const mode of ['unsigned', 'windows', 'macos', 'all']) {
  if (!workflow.includes(`- ${mode}`)) {
    failures.push(`desktop-packaging.yml must expose signing mode "${mode}".`);
  }
  if (!policy.includes(`\`${mode}\``)) {
    failures.push(`docs/RELEASE_SIGNING_POLICY.md must document signing mode "${mode}".`);
  }
}

for (const secret of [
  'WINDOWS_CERTIFICATE',
  'WINDOWS_CERTIFICATE_PASSWORD',
  'APPLE_CERTIFICATE',
  'APPLE_CERTIFICATE_PASSWORD',
  'APPLE_SIGNING_IDENTITY',
  'APPLE_ID',
  'APPLE_PASSWORD',
  'APPLE_TEAM_ID',
]) {
  if (!workflow.includes(secret)) {
    failures.push(`desktop-packaging.yml must validate or use ${secret}.`);
  }
  if (!policy.includes(secret)) {
    failures.push(`docs/RELEASE_SIGNING_POLICY.md must document ${secret}.`);
  }
}

for (const required of [
  'id-token: write',
  'attestations: write',
  'artifact-metadata: write',
  'npm run desktop:checksums',
  'Import macOS Developer ID certificate',
  'Sign Windows desktop artifacts with Authenticode',
  'Notarize macOS desktop artifacts',
  'signtool.exe',
  'xcrun notarytool submit',
  'Attest desktop artifact provenance',
  'Attest desktop SBOM',
  'Upload desktop artifacts',
]) {
  if (!workflow.includes(required)) {
    failures.push(`desktop-packaging.yml must include "${required}".`);
  }
}

for (const policyTerm of [
  'Artifact Integrity Requirements',
  'Public Release Rules',
  'unsigned community build',
  'GitHub attestations do not replace OS-native code signing',
  'Release notes must disclose signing mode',
]) {
  if (!policy.includes(policyTerm)) {
    failures.push(`docs/RELEASE_SIGNING_POLICY.md must document "${policyTerm}".`);
  }
}

if (!release.includes('docs/RELEASE_SIGNING_POLICY.md')) {
  failures.push('docs/RELEASE_HARDENING.md must require release signing policy review.');
}

if (!owasp.includes('docs/RELEASE_SIGNING_POLICY.md')) {
  failures.push('docs/OWASP_COMPLIANCE_MATRIX.md must cite release signing policy evidence.');
}

if (!desktop.includes('RELEASE_SIGNING_POLICY.md')) {
  failures.push('docs/DESKTOP_PACKAGING.md must link to the release signing policy.');
}

if (failures.length > 0) {
  console.error('Release signing verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Release signing verification passed.');
