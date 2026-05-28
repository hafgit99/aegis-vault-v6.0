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
  'docs/OWASP_COMPLIANCE_MATRIX.md',
  'docs/RELEASE_HARDENING.md',
  'docs/AUDIT_EVIDENCE.md',
  'docs/FUTURE_CRYPTO_ROADMAP.md',
  'docs/RELEASE.md',
  'docs/DESKTOP_PACKAGING.md',
  'docs/MUTATION_POLICY.md',
  'docs/GITHUB_SETUP.md',
  'package.json',
  'src-tauri/tauri.conf.json',
  '.github/workflows/quality-gate.yml',
  '.github/workflows/release-preflight.yml',
  '.github/workflows/desktop-packaging.yml',
  '.github/workflows/mutation-testing.yml',
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
  files: manifestFiles,
};

await writeFile(path.join(outputDir, 'security-evidence-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await writeFile(path.join(outputDir, 'SHA256SUMS.txt'), `${checksumLines.join('\n')}\n`, 'utf8');

console.log(`Generated security evidence bundle with ${manifestFiles.length} file(s) in ${outputDir}`);
