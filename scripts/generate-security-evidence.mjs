import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputDir = path.join(root, 'security-evidence');

const evidenceFiles = [
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
  'docs/FUTURE_CRYPTO_ROADMAP.md',
  'docs/RELEASE.md',
  'docs/DESKTOP_PACKAGING.md',
  'docs/MUTATION_POLICY.md',
  'docs/GITHUB_SETUP.md',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'src/lib/securityErrors.ts',
  'src/lib/secureShareBundle.ts',
  'scripts/security-regression-scan.mjs',
  'scripts/check-build-budget.mjs',
  'scripts/verify-workflow-permissions.mjs',
  'scripts/verify-dependency-policy.mjs',
  'scripts/verify-validation-rules.mjs',
  'scripts/verify-privacy-notice.mjs',
  'scripts/verify-release-signing.mjs',
  'scripts/verify-branch-protection-policy.mjs',
  'scripts/verify-desktop-smoke-policy.mjs',
  'scripts/verify-security-logging-policy.mjs',
  'scripts/verify-error-taxonomy.mjs',
  'scripts/verify-release-notes-template.mjs',
  'scripts/verify-vulnerability-disclosure.mjs',
  'scripts/generate-security-evidence.mjs',
  'scripts/verify-security-evidence-bundle.mjs',
  'scripts/generate-sbom.mjs',
  'src-tauri/tauri.conf.json',
  'src-tauri/Cargo.lock',
  '.github/workflows/quality-gate.yml',
  '.github/workflows/release-preflight.yml',
  '.github/workflows/desktop-packaging.yml',
  '.github/workflows/codeql.yml',
  '.github/workflows/mutation-testing.yml',
  '.github/workflows/scheduled-quality.yml',
];

const releaseGateCommands = [
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

const policyEvidence = [
  ['Workflow permissions', 'docs/RELEASE_HARDENING.md', 'npm run security:workflows'],
  ['Dependency update policy', 'docs/DEPENDENCY_POLICY.md', 'npm run security:dependencies'],
  ['Validation rules', 'docs/VALIDATION_RULES.md', 'npm run security:validation'],
  ['Privacy notice', 'docs/PRIVACY_NOTICE.md', 'npm run security:privacy'],
  ['Release signing policy', 'docs/RELEASE_SIGNING_POLICY.md', 'npm run security:signing'],
  ['Branch protection policy', 'docs/BRANCH_PROTECTION_POLICY.md', 'npm run security:branch-protection'],
  ['Desktop smoke evidence policy', 'docs/DESKTOP_SMOKE_EVIDENCE.md', 'npm run security:desktop-smoke'],
  ['Security logging policy', 'docs/SECURITY_LOGGING_POLICY.md', 'npm run security:logging'],
  ['Error taxonomy', 'docs/ERROR_TAXONOMY.md', 'npm run security:errors'],
  ['OWASP readiness matrix', 'docs/OWASP_COMPLIANCE_MATRIX.md', 'manual security review'],
];

async function sha256(filePath) {
  const contents = await readFile(filePath);
  return createHash('sha256').update(contents).digest('hex');
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const manifestFiles = [];
const checksumLines = [];

for (const relativePath of evidenceFiles) {
  const source = path.join(root, relativePath);
  const fileStat = await stat(source);
  if (!fileStat.isFile()) {
    throw new Error(`Evidence source is not a file: ${relativePath}`);
  }

  const destination = path.join(outputDir, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);

  const hash = await sha256(source);
  manifestFiles.push({
    path: relativePath,
    sizeBytes: fileStat.size,
    sha256: hash,
  });
  checksumLines.push(`${hash}  ${relativePath}`);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  version: JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version,
  algorithm: 'SHA-256',
  purpose: 'AegisVault security audit and release evidence bundle',
  releaseGateCommands,
  policyEvidence: policyEvidence.map(([control, document, verification]) => ({
    control,
    document,
    verification,
  })),
  files: manifestFiles,
};

const summary = `# AegisVault Security Evidence Summary

Generated: ${manifest.generatedAt}
Version: ${manifest.version}
Algorithm: ${manifest.algorithm}

This bundle is release evidence for AegisVault's local-first security posture. It is not a formal certification and must be paired with CI results from the exact commit being released.

## Release Gate Commands

${releaseGateCommands.map((command) => `- \`${command}\``).join('\n')}

## Policy Evidence

| Control | Document | Verification |
| --- | --- | --- |
${policyEvidence.map(([control, document, verification]) => `| ${control} | \`${document}\` | \`${verification}\` |`).join('\n')}

## External Evidence To Attach

- GitHub Quality Gate run URL.
- Release Preflight run URL.
- CodeQL code scanning status.
- Dependency Review result for the release pull request.
- CycloneDX SBOM artifact.
- Coverage report artifact.
- Playwright report artifact.
- Desktop artifact checksums.
- GitHub artifact attestation URLs.
- Windows, macOS, and Linux desktop smoke evidence records.
- Signing mode disclosure for every public desktop artifact.

## Included Files

${manifestFiles.map((file) => `- \`${file.path}\` (${file.sizeBytes} bytes, sha256: \`${file.sha256}\`)`).join('\n')}
`;

await writeFile(path.join(outputDir, 'security-evidence-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await writeFile(path.join(outputDir, 'SHA256SUMS.txt'), `${checksumLines.join('\n')}\n`, 'utf8');
await writeFile(path.join(outputDir, 'SECURITY_EVIDENCE_SUMMARY.md'), summary, 'utf8');

console.log(`Generated security evidence bundle with ${manifestFiles.length} file(s) in ${outputDir}`);
