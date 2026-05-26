import { readFileSync } from 'node:fs';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function matchVersion(contents, pattern, label) {
  const match = contents.match(pattern);
  if (!match) {
    throw new Error(`Could not read ${label} version.`);
  }
  return match[1];
}

function normalizeExpected(value) {
  if (!value) return null;
  return value.trim().replace(/^refs\/tags\//, '').replace(/^v/, '');
}

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const tauriConfig = readJson('src-tauri/tauri.conf.json');
const cargoToml = readFileSync('src-tauri/Cargo.toml', 'utf8');
const cargoLock = readFileSync('src-tauri/Cargo.lock', 'utf8');

const versions = {
  'package.json': packageJson.version,
  'package-lock.json': packageLock.version,
  'package-lock root package': packageLock.packages?.['']?.version,
  'src-tauri/tauri.conf.json': tauriConfig.version,
  'src-tauri/Cargo.toml': matchVersion(cargoToml, /^version\s*=\s*"([^"]+)"/m, 'Cargo.toml'),
  'src-tauri/Cargo.lock': matchVersion(
    cargoLock,
    /name\s*=\s*"aegisvault"\s*\nversion\s*=\s*"([^"]+)"/m,
    'Cargo.lock aegisvault package',
  ),
};

const uniqueVersions = new Set(Object.values(versions));

if (uniqueVersions.size !== 1) {
  console.error('Release version mismatch:');
  for (const [source, version] of Object.entries(versions)) {
    console.error(`- ${source}: ${version}`);
  }
  process.exit(1);
}

const releaseVersion = [...uniqueVersions][0];
const expectedVersion = normalizeExpected(process.argv[2] ?? process.env.GITHUB_REF_NAME);

if (expectedVersion && expectedVersion !== releaseVersion) {
  console.error(`Release tag/version mismatch: expected ${expectedVersion}, found ${releaseVersion}`);
  process.exit(1);
}

console.log(`Release version verified: v${releaseVersion}`);
