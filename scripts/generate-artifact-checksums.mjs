import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootArg = process.argv[2] ?? 'src-tauri/target/release/bundle';
const rootDir = path.resolve(rootArg);
const checksumFileName = 'SHA256SUMS.txt';
const manifestFileName = 'artifact-manifest.json';
const ignoredNames = new Set([checksumFileName, manifestFileName]);

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && !ignoredNames.has(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function sha256(filePath) {
  const contents = await readFile(filePath);
  return createHash('sha256').update(contents).digest('hex');
}

const files = (await collectFiles(rootDir)).sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  throw new Error(`No files found under ${rootDir}`);
}

const manifestFiles = [];
const checksumLines = [];

for (const filePath of files) {
  const fileStat = await stat(filePath);
  const relativePath = path.relative(rootDir, filePath).replaceAll(path.sep, '/');
  const hash = await sha256(filePath);

  checksumLines.push(`${hash}  ${relativePath}`);
  manifestFiles.push({
    path: relativePath,
    sizeBytes: fileStat.size,
    sha256: hash,
  });
}

const manifest = {
  generatedAt: new Date().toISOString(),
  root: rootDir,
  algorithm: 'SHA-256',
  files: manifestFiles,
};

await writeFile(path.join(rootDir, checksumFileName), `${checksumLines.join('\n')}\n`, 'utf8');
await writeFile(path.join(rootDir, manifestFileName), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Generated checksums for ${files.length} artifact(s) under ${rootDir}`);
