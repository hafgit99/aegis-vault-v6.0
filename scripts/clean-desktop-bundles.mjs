import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const bundleRoots = [
  path.join(root, 'src-tauri', 'target', 'release', 'bundle'),
  path.join(root, 'src-tauri', 'target', 'universal-apple-darwin', 'release', 'bundle'),
];

for (const bundleRoot of bundleRoots) {
  await rm(bundleRoot, { recursive: true, force: true });
  console.log(`Removed stale desktop bundle directory: ${bundleRoot}`);
}

const releaseRoot = path.join(root, 'src-tauri', 'target', 'release');
const releaseDepsRoot = path.join(releaseRoot, 'deps');
const staleBinaryNames = new Set([
  'aegisvault',
  'aegisvault.exe',
  'aegisvault.pdb',
]);

async function removeOwnCrateArtifacts(dir) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const shouldRemove = staleBinaryNames.has(entry.name)
      || entry.name.startsWith('aegisvault-')
      || entry.name.startsWith('aegisvault.');

    if (!shouldRemove) continue;

    const filePath = path.join(dir, entry.name);
    await rm(filePath, { force: true });
    console.log(`Removed stale AegisVault crate artifact: ${filePath}`);
  }
}

await removeOwnCrateArtifacts(releaseRoot);
await removeOwnCrateArtifacts(releaseDepsRoot);
