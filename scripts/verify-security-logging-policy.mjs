import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const policyPath = join(root, 'docs', 'SECURITY_LOGGING_POLICY.md');
const appPath = join(root, 'src', 'App.tsx');
const securityLogsHookPath = join(root, 'src', 'hooks', 'useSecurityLogs.ts');
const readmePath = join(root, 'README.md');
const releaseHardeningPath = join(root, 'docs', 'RELEASE_HARDENING.md');
const auditEvidencePath = join(root, 'docs', 'AUDIT_EVIDENCE.md');
const owaspPath = join(root, 'docs', 'OWASP_COMPLIANCE_MATRIX.md');
const componentTestPath = join(root, 'test', 'unit', 'app.integration.test.tsx');

const failures = [];

const read = (path) => {
  if (!existsSync(path)) {
    failures.push(`${path} is missing.`);
    return '';
  }

  return readFileSync(path, 'utf8');
};

const policy = read(policyPath);
const app = read(appPath);
const securityLogsHook = read(securityLogsHookPath);
const readme = read(readmePath);
const releaseHardening = read(releaseHardeningPath);
const auditEvidence = read(auditEvidencePath);
const owasp = read(owaspPath);
const componentTest = read(componentTestPath);

const requiredPolicyTopics = [
  '# Security Logging Policy',
  'aegis_security_logs',
  'most recent 200 security log entries',
  'master passwords',
  'backup passwords',
  'Secure Share transfer passwords',
  'TOTP secrets',
  'device secrets',
  'Release Review',
  'npm run security:logging',
];

for (const topic of requiredPolicyTopics) {
  if (!policy.includes(topic)) {
    failures.push(`docs/SECURITY_LOGGING_POLICY.md must include "${topic}".`);
  }
}

const appRequired = [
  'useSecurityLogs',
  'addSecurityLog',
  'clearLogs',
];

for (const topic of appRequired) {
  if (!app.includes(topic)) {
    failures.push(`src/App.tsx must include "${topic}".`);
  }
}

const hookRequired = [
  'SECURITY_LOG_STORAGE_KEY',
  'SECURITY_LOG_MAX_ENTRIES = 200',
  'normalizeSecurityLogs',
  '.slice(-SECURITY_LOG_MAX_ENTRIES)',
  'sessionStorage.setItem(SECURITY_LOG_STORAGE_KEY',
  'localStorage.removeItem(SECURITY_LOG_STORAGE_KEY',
  'logsClearedRecord',
];

for (const topic of hookRequired) {
  if (!securityLogsHook.includes(topic)) {
    failures.push(`src/hooks/useSecurityLogs.ts must include "${topic}".`);
  }
}

const docsThatMustReferencePolicy = [
  [readme, 'README.md'],
  [releaseHardening, 'docs/RELEASE_HARDENING.md'],
  [auditEvidence, 'docs/AUDIT_EVIDENCE.md'],
  [owasp, 'docs/OWASP_COMPLIANCE_MATRIX.md'],
];

for (const [content, name] of docsThatMustReferencePolicy) {
  if (!content.includes('SECURITY_LOGGING_POLICY.md')) {
    failures.push(`${name} must reference docs/SECURITY_LOGGING_POLICY.md.`);
  }
}

if (!componentTest.includes('keeps only the latest 200 local security logs')) {
  failures.push('test/unit/app.integration.test.tsx must cover local security log retention.');
}

if (!releaseHardening.includes('Security logging policy audit fails')) {
  failures.push('docs/RELEASE_HARDENING.md must list security logging audit failures as release blockers.');
}

if (!auditEvidence.includes('npm run security:logging')) {
  failures.push('docs/AUDIT_EVIDENCE.md must include the security logging verification command.');
}

if (!owasp.includes('security logging policy gate')) {
  failures.push('docs/OWASP_COMPLIANCE_MATRIX.md must cite security logging policy evidence.');
}

if (failures.length > 0) {
  console.error('Security logging policy verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Security logging policy verification passed.');
