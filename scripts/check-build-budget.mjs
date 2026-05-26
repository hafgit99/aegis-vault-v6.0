import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const assetsDir = path.join(root, 'dist', 'assets');

const kib = 1024;
const budgets = {
  appEntryJs: 250 * kib,
  maxJsChunk: 250 * kib,
  totalJs: 900 * kib,
  css: 120 * kib,
  wasm: 700 * kib,
};

const format = (bytes) => `${(bytes / kib).toFixed(1)} KiB`;

async function listAssets() {
  const names = await readdir(assetsDir);
  const files = await Promise.all(
    names.map(async (name) => {
      const filePath = path.join(assetsDir, name);
      const fileStat = await stat(filePath);
      return {
        name,
        bytes: fileStat.size,
        ext: path.extname(name),
      };
    })
  );

  return files.sort((a, b) => b.bytes - a.bytes);
}

function assertBudget(label, actual, limit, failures) {
  if (actual > limit) {
    failures.push(`${label}: ${format(actual)} exceeds ${format(limit)}`);
  }
}

const assets = await listAssets();
const jsAssets = assets.filter((asset) => asset.ext === '.js');
const cssAssets = assets.filter((asset) => asset.ext === '.css');
const wasmAssets = assets.filter((asset) => asset.ext === '.wasm');
const appEntry = jsAssets.find((asset) => /^index-[\w-]+\.js$/.test(asset.name));
const totalJs = jsAssets.reduce((sum, asset) => sum + asset.bytes, 0);
const largestJs = jsAssets[0];
const largestCss = cssAssets[0];
const largestWasm = wasmAssets[0];

const failures = [];

if (!appEntry) {
  failures.push('App entry chunk was not found.');
} else {
  assertBudget(`App entry chunk (${appEntry.name})`, appEntry.bytes, budgets.appEntryJs, failures);
}

if (largestJs) {
  assertBudget(`Largest JS chunk (${largestJs.name})`, largestJs.bytes, budgets.maxJsChunk, failures);
}

if (largestCss) {
  assertBudget(`Largest CSS asset (${largestCss.name})`, largestCss.bytes, budgets.css, failures);
}

if (largestWasm) {
  assertBudget(`Largest WASM asset (${largestWasm.name})`, largestWasm.bytes, budgets.wasm, failures);
}

assertBudget('Total JS payload', totalJs, budgets.totalJs, failures);

console.log('Build budget summary:');
for (const asset of assets) {
  console.log(`- ${asset.name}: ${format(asset.bytes)}`);
}
console.log(`- total JS: ${format(totalJs)}`);

if (failures.length > 0) {
  console.error('\nBuild budget failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('\nBuild budget passed.');
