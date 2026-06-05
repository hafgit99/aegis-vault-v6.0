import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dependabotPath = join(process.cwd(), '.github', 'dependabot.yml');
const qualityGatePath = join(process.cwd(), '.github', 'workflows', 'quality-gate.yml');
const policyPath = join(process.cwd(), 'docs', 'DEPENDENCY_POLICY.md');

const dependabot = readFileSync(dependabotPath, 'utf8');
const qualityGate = readFileSync(qualityGatePath, 'utf8');
const policy = readFileSync(policyPath, 'utf8');

const failures = [];

for (const ecosystem of ['npm', 'cargo', 'github-actions']) {
  if (!dependabot.includes(`package-ecosystem: ${ecosystem}`)) {
    failures.push(`dependabot.yml must configure ${ecosystem} updates.`);
  }
}

for (const required of [
  'interval: weekly',
  'timezone: Europe/Istanbul',
  'open-pull-requests-limit: 5',
]) {
  if (!dependabot.includes(required)) {
    failures.push(`dependabot.yml must include "${required}".`);
  }
}

for (const group of ['npm-production', 'npm-development']) {
  if (!dependabot.includes(`${group}:`)) {
    failures.push(`dependabot.yml must group ${group} updates.`);
  }
}

if (!qualityGate.includes('actions/dependency-review-action@v4')) {
  failures.push('quality-gate.yml must run dependency review on pull requests.');
}

if (!qualityGate.includes('fail-on-severity: high')) {
  failures.push('dependency review must fail on high severity findings.');
}

for (const policyTerm of [
  'Dependency Update Policy',
  'Production dependency updates',
  'Development dependency updates',
  'GitHub Actions updates',
  'Triage SLA',
]) {
  if (!policy.includes(policyTerm)) {
    failures.push(`docs/DEPENDENCY_POLICY.md must document "${policyTerm}".`);
  }
}

if (failures.length > 0) {
  console.error('Dependency policy verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Dependency policy verification passed.');
