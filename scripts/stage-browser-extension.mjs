import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'browser-extension', 'chromium');
const stageRoot = path.join(root, 'desktop-autofill-extension', 'chromium');
const manifestPath = path.join(sourceRoot, 'manifest.json');
const allowedExtensions = new Set(['.json', '.js', '.css', '.png', '.md']);

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath));
      continue;
    }
    if (entry.isFile() && allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(absolutePath);
    }
  }

  return files;
}

await rm(stageRoot, { recursive: true, force: true });
await mkdir(stageRoot, { recursive: true });

await stat(manifestPath).catch(() => {
  throw new Error(`Chromium extension manifest.json was not found at ${manifestPath}`);
});

const files = await collectFiles(sourceRoot);
if (files.length === 0) {
  throw new Error(`No extension files found under ${sourceRoot}`);
}

for (const sourcePath of files) {
  const relativePath = path.relative(sourceRoot, sourcePath);
  const targetPath = path.join(stageRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
}

const stagedFiles = await collectFiles(stageRoot);
const stagedStats = await Promise.all(stagedFiles.map(async filePath => ({
  fileName: path.relative(stageRoot, filePath).split(path.sep).join('/'),
  sizeBytes: (await stat(filePath)).size,
})));

console.log(`Staged Chromium extension in ${stageRoot}`);
for (const artifact of stagedStats.sort((a, b) => a.fileName.localeCompare(b.fileName))) {
  console.log(`- ${artifact.fileName} (${artifact.sizeBytes} bytes)`);
}
