import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sourceRoot = process.argv[2] ?? 'src-tauri/gen/android/app/build/outputs/apk';
const stageRoot = process.argv[3] ?? 'android-artifacts/aegisvault-android';

const androidArtifactExtensions = new Set(['.apk', '.aab']);

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath));
      continue;
    }

    if (entry.isFile()) files.push(absolutePath);
  }

  return files;
}

function isAndroidArtifact(filePath) {
  const fileName = path.basename(filePath);
  const extension = path.extname(fileName).toLowerCase();

  if (filePath.split(path.sep).includes('debug')) return false;

  return androidArtifactExtensions.has(extension);
}

function stagedFileName(filePath, root) {
  return path.relative(root, filePath).split(path.sep).join('__');
}

const resolvedSourceRoot = path.resolve(sourceRoot);
const resolvedStageRoot = path.resolve(stageRoot);
const collectedFiles = (await collectFiles(resolvedSourceRoot)).filter(isAndroidArtifact).sort();
const hasSignedReleaseArtifact = collectedFiles.some(filePath => {
  const fileName = path.basename(filePath).toLowerCase();
  return androidArtifactExtensions.has(path.extname(fileName)) &&
    filePath.split(path.sep).includes('release') &&
    !fileName.includes('unsigned');
});
const files = collectedFiles.filter(filePath => {
  const fileName = path.basename(filePath).toLowerCase();
  const isUnsignedReleaseArtifact = androidArtifactExtensions.has(path.extname(fileName)) &&
    filePath.split(path.sep).includes('release') &&
    fileName.includes('unsigned');

  return !(hasSignedReleaseArtifact && isUnsignedReleaseArtifact);
});

if (files.length === 0) {
  throw new Error(`No Android release artifacts found under ${resolvedSourceRoot}`);
}

await rm(resolvedStageRoot, { recursive: true, force: true });
await mkdir(resolvedStageRoot, { recursive: true });

for (const filePath of files) {
  await copyFile(filePath, path.join(resolvedStageRoot, stagedFileName(filePath, resolvedSourceRoot)));
}

const stagedFiles = await readdir(resolvedStageRoot);
const stagedStats = await Promise.all(stagedFiles.map(async fileName => ({
  fileName,
  sizeBytes: (await stat(path.join(resolvedStageRoot, fileName))).size,
  sha256: createHash('sha256').update(await readFile(path.join(resolvedStageRoot, fileName))).digest('hex'),
})));

await writeFile(
  path.join(resolvedStageRoot, 'SHA256SUMS.txt'),
  `${stagedStats.map(artifact => `${artifact.sha256}  ${artifact.fileName}`).join('\n')}\n`,
  'utf8',
);

await writeFile(
  path.join(resolvedStageRoot, 'artifact-manifest.json'),
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    algorithm: 'SHA-256',
    files: stagedStats,
  }, null, 2)}\n`,
  'utf8',
);

console.log(`Staged ${stagedStats.length} Android artifact(s) in ${resolvedStageRoot}`);
for (const artifact of stagedStats) {
  console.log(`- ${artifact.fileName} (${artifact.sizeBytes} bytes)`);
}
