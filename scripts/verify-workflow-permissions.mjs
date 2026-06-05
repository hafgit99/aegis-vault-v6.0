import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflowDir = join(process.cwd(), '.github', 'workflows');
const workflowFiles = readdirSync(workflowDir).filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));

const allowedWritePermissions = new Map([
  ['codeql.yml', new Set(['security-events'])],
  ['desktop-packaging.yml', new Set(['id-token', 'attestations', 'artifact-metadata'])],
]);

const failures = [];

function getTopLevelPermissionsBlock(text) {
  const match = text.match(/^permissions:\r?\n([\s\S]*?)(?=^[A-Za-z0-9_-]+:|\z)/m);
  return match?.[1] ?? null;
}

function parsePermissionLines(block) {
  return block
    .split(/\r?\n/)
    .map(line => line.match(/^\s{2}([A-Za-z-]+):\s*([A-Za-z-]+)\s*$/))
    .filter(Boolean)
    .map(match => ({ name: match[1], value: match[2] }));
}

for (const file of workflowFiles) {
  const text = readFileSync(join(workflowDir, file), 'utf8');
  const permissionsBlock = getTopLevelPermissionsBlock(text);
  const allowedWrites = allowedWritePermissions.get(file) ?? new Set();

  if (/\bpull_request_target\s*:/.test(text)) {
    failures.push(`${file}: pull_request_target is not allowed for this repository.`);
  }

  if (!permissionsBlock) {
    failures.push(`${file}: missing explicit top-level permissions block.`);
    continue;
  }

  if (/permissions:\s*(write-all|read-all)/.test(text)) {
    failures.push(`${file}: permissions must be explicit per scope, not read-all/write-all.`);
  }

  const permissions = parsePermissionLines(permissionsBlock);
  const contents = permissions.find(permission => permission.name === 'contents');
  if (!contents || contents.value !== 'read') {
    failures.push(`${file}: top-level permissions must include contents: read.`);
  }

  for (const permission of permissions) {
    if (permission.value === 'write' && !allowedWrites.has(permission.name)) {
      failures.push(`${file}: unexpected write permission "${permission.name}: write".`);
    }
  }

  if (file === 'quality-gate.yml' && !text.includes('actions/dependency-review-action@v4')) {
    failures.push(`${file}: pull request dependency review action is required.`);
  }
}

if (failures.length > 0) {
  console.error('Workflow permission verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Workflow permission verification passed for ${workflowFiles.length} workflow files.`);
