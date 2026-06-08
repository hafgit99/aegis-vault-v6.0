import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const releaseRoot = process.argv[2];

if (!releaseRoot) {
  throw new Error('Usage: node scripts/verify-release-artifacts.mjs <downloaded-artifacts-root>');
}

const minimumSizes = new Map([
  ['.aab', 1024 * 1024],
  ['.apk', 1024 * 1024],
  ['.appimage', 1024 * 1024],
  ['.deb', 1024 * 1024],
  ['.dmg', 1024 * 1024],
  ['.exe', 1024 * 1024],
  ['.msi', 1024 * 1024],
  ['.rpm', 1024 * 1024],
]);

const expectedArtifacts = [
  {
    name: 'aegisvault-windows',
    required: true,
    extensions: new Set(['.exe', '.msi']),
  },
  {
    name: 'aegisvault-android',
    required: true,
    extensions: new Set(['.apk', '.aab']),
  },
  {
    name: 'aegisvault-macos',
    required: false,
    extensions: new Set(['.dmg']),
  },
  {
    name: 'aegisvault-linux',
    required: false,
    extensions: new Set(['.appimage', '.deb', '.rpm']),
  },
];

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(filePath));
    } else if (entry.isFile()) {
      files.push(filePath);
    }
  }

  return files;
}

async function readShaSums(dir) {
  const shaPath = path.join(dir, 'SHA256SUMS.txt');
  if (!await exists(shaPath)) {
    throw new Error(`Missing SHA256SUMS.txt in ${dir}`);
  }

  const lines = (await readFile(shaPath, 'utf8'))
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const checksums = new Map();

  for (const line of lines) {
    const match = line.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
    if (!match) {
      throw new Error(`Malformed checksum line in ${shaPath}: ${line}`);
    }
    checksums.set(match[2], match[1].toLowerCase());
  }

  return checksums;
}

async function verifyArtifactGroup({ name, required, extensions }) {
  const dir = path.resolve(releaseRoot, name);
  if (!await exists(dir)) {
    if (required) throw new Error(`Missing required release artifact directory: ${name}`);
    console.log(`Skipped optional artifact directory: ${name}`);
    return;
  }

  const files = await listFiles(dir);
  const distributables = files.filter(filePath => extensions.has(path.extname(filePath).toLowerCase()));
  if (distributables.length === 0) {
    throw new Error(`No distributable files found in ${name}`);
  }

  if (!await exists(path.join(dir, 'artifact-manifest.json'))) {
    throw new Error(`Missing artifact-manifest.json in ${name}`);
  }

  const checksums = await readShaSums(dir);
  for (const filePath of distributables) {
    const fileName = path.basename(filePath);
    const sizeBytes = (await stat(filePath)).size;
    const minimumSize = minimumSizes.get(path.extname(fileName).toLowerCase()) ?? 0;
    if (sizeBytes < minimumSize) {
      throw new Error(`${name}/${fileName} is unexpectedly small: ${sizeBytes} bytes`);
    }

    const expectedSha = checksums.get(fileName);
    if (!expectedSha) {
      throw new Error(`${name}/${fileName} is missing from SHA256SUMS.txt`);
    }

    const actualSha = createHash('sha256').update(await readFile(filePath)).digest('hex');
    if (actualSha !== expectedSha) {
      throw new Error(`${name}/${fileName} checksum mismatch`);
    }
  }

  console.log(`Verified ${name}: ${distributables.map(filePath => path.basename(filePath)).join(', ')}`);
}

for (const artifact of expectedArtifacts) {
  await verifyArtifactGroup(artifact);
}

console.log('Release artifact verification passed.');
