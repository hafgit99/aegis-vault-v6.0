import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const sourceRoot = process.argv[2];
const stageRoot = process.argv[3];

if (!sourceRoot || !stageRoot) {
  throw new Error('Usage: node scripts/stage-desktop-artifacts.mjs <bundle-root> <stage-root>');
}

const distributableExtensions = new Set([
  '.appimage',
  '.deb',
  '.dmg',
  '.exe',
  '.msi',
  '.rpm',
]);

const releaseEvidenceNames = new Set([
  'SHA256SUMS.txt',
  'artifact-manifest.json',
]);

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath));
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

function isReleaseArtifact(filePath) {
  const fileName = path.basename(filePath);
  const extension = path.extname(fileName).toLowerCase();

  return releaseEvidenceNames.has(fileName) || distributableExtensions.has(extension);
}

function stagedFileName(filePath, root) {
  const relativePath = path.relative(root, filePath);
  return relativePath.split(path.sep).join('__');
}

const resolvedSourceRoot = path.resolve(sourceRoot);
const resolvedStageRoot = path.resolve(stageRoot);
const files = (await collectFiles(resolvedSourceRoot)).filter(isReleaseArtifact).sort();

if (files.length === 0) {
  throw new Error(`No desktop release artifacts found under ${resolvedSourceRoot}`);
}

await rm(resolvedStageRoot, { recursive: true, force: true });
await mkdir(resolvedStageRoot, { recursive: true });

for (const filePath of files) {
  const targetPath = path.join(resolvedStageRoot, stagedFileName(filePath, resolvedSourceRoot));
  await copyFile(filePath, targetPath);
}

const stagedFiles = await readdir(resolvedStageRoot);
const stagedStats = await Promise.all(stagedFiles.map(async fileName => ({
  fileName,
  sizeBytes: (await stat(path.join(resolvedStageRoot, fileName))).size,
})));

console.log(`Staged ${stagedStats.length} desktop release artifact(s) in ${resolvedStageRoot}`);
for (const artifact of stagedStats) {
  console.log(`- ${artifact.fileName} (${artifact.sizeBytes} bytes)`);
}
