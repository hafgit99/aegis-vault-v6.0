import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const privacyPath = join(process.cwd(), 'docs', 'PRIVACY_NOTICE.md');
const releasePath = join(process.cwd(), 'docs', 'RELEASE_HARDENING.md');
const owaspPath = join(process.cwd(), 'docs', 'OWASP_COMPLIANCE_MATRIX.md');
const tauriConfigPath = join(process.cwd(), 'src-tauri', 'tauri.conf.json');

const privacy = readFileSync(privacyPath, 'utf8');
const release = readFileSync(releasePath, 'utf8');
const owasp = readFileSync(owaspPath, 'utf8');
const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf8'));

const failures = [];

for (const section of [
  'Summary',
  'Data Stored Locally',
  'Data Exported By User Action',
  'Network Behavior',
  'Telemetry And Analytics',
  'User Responsibilities',
  'Release Requirements',
]) {
  if (!privacy.includes(`## ${section}`)) {
    failures.push(`docs/PRIVACY_NOTICE.md must include the "${section}" section.`);
  }
}

for (const required of [
  'does not operate a hosted account service',
  'does not provide cloud sync',
  'does not include telemetry',
  'connect-src',
  'user-provided remote avatar URL',
]) {
  if (!privacy.includes(required)) {
    failures.push(`docs/PRIVACY_NOTICE.md must document "${required}".`);
  }
}

const csp = tauriConfig?.app?.security?.csp;
if (typeof csp !== 'string' || !csp.includes("connect-src 'self'")) {
  failures.push("src-tauri/tauri.conf.json must keep connect-src scoped to 'self'.");
}

if (!release.includes('docs/PRIVACY_NOTICE.md')) {
  failures.push('docs/RELEASE_HARDENING.md must require privacy notice review.');
}

if (!owasp.includes('docs/PRIVACY_NOTICE.md')) {
  failures.push('docs/OWASP_COMPLIANCE_MATRIX.md must cite privacy notice evidence.');
}

if (failures.length > 0) {
  console.error('Privacy notice verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Privacy notice verification passed.');
