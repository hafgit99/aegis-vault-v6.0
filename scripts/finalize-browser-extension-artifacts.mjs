import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const artifactRoot = path.join(root, 'browser-extension-artifacts');

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(filePath));
    } else if (entry.isFile() && !['SHA256SUMS.txt', 'artifact-manifest.json'].includes(entry.name)) {
      files.push(filePath);
    }
  }
  return files;
}

function installability(fileName) {
  if (fileName.endsWith('.xpi') && !fileName.includes('unsigned')) {
    return 'Firefox signed XPI. Suitable for public website download after manual smoke.';
  }
  if (fileName.endsWith('.unsigned.xpi')) {
    return 'Firefox unsigned validation XPI. Not suitable for normal public Firefox users.';
  }
  if (fileName.endsWith('.zip')) {
    return 'Chromium package for Chrome Web Store / unpacked validation. Public one-click install should use a Web Store listing.';
  }
  return 'Browser extension artifact.';
}

const files = (await listFiles(artifactRoot)).sort((a, b) => a.localeCompare(b));
if (files.length === 0) {
  throw new Error(`No browser extension artifacts found under ${artifactRoot}`);
}

const checksums = [];
const manifest = [];
for (const filePath of files) {
  const bytes = await readFile(filePath);
  const fileName = path.relative(artifactRoot, filePath).split(path.sep).join('/');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  checksums.push(`${sha256}  ${fileName}`);
  manifest.push({
    fileName,
    sizeBytes: (await stat(filePath)).size,
    sha256,
    installability: installability(fileName),
  });
}

await writeFile(path.join(artifactRoot, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`);
await writeFile(path.join(artifactRoot, 'artifact-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Finalized ${manifest.length} browser extension artifact(s).`);
