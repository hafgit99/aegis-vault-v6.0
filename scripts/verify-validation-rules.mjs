import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const validationPath = join(process.cwd(), 'docs', 'VALIDATION_RULES.md');
const releasePath = join(process.cwd(), 'docs', 'RELEASE_HARDENING.md');
const owaspPath = join(process.cwd(), 'docs', 'OWASP_COMPLIANCE_MATRIX.md');

const validation = readFileSync(validationPath, 'utf8');
const release = readFileSync(releasePath, 'utf8');
const owasp = readFileSync(owaspPath, 'utf8');

const failures = [];

for (const section of [
  'Import Inputs',
  'Export Inputs',
  'Vault Entry Inputs',
  'Search And Filter Inputs',
  'Profile Inputs',
  'Release Review Checklist',
]) {
  if (!validation.includes(`## ${section}`)) {
    failures.push(`docs/VALIDATION_RULES.md must include the "${section}" section.`);
  }
}

for (const topic of [
  'AegisVault encrypted backup',
  'Secure Share bundle',
  'CSV imports',
  'Encrypted backup password',
  'Search query',
  'Display name',
  'Uploaded avatar',
]) {
  if (!validation.includes(topic)) {
    failures.push(`docs/VALIDATION_RULES.md must document "${topic}".`);
  }
}

if (!release.includes('docs/VALIDATION_RULES.md')) {
  failures.push('docs/RELEASE_HARDENING.md must require validation rules review.');
}

if (!owasp.includes('docs/VALIDATION_RULES.md')) {
  failures.push('docs/OWASP_COMPLIANCE_MATRIX.md must cite validation rules evidence.');
}

if (failures.length > 0) {
  console.error('Validation rules verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Validation rules verification passed.');
