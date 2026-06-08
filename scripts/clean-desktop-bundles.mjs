import { rm } from 'node:fs/promises';
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
