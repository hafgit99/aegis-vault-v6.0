import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputDir = path.join(root, 'sbom');
const outputPath = path.join(outputDir, 'aegisvault.cdx.json');
const checksumsPath = path.join(outputDir, 'SHA256SUMS.txt');

function hashText(value) {
  return createHash('sha256').update(value).digest('hex');
}

function packageUrl(type, name, version) {
  if (type === 'npm') {
    if (name.startsWith('@')) {
      const [scope, packageName] = name.slice(1).split('/');
      return `pkg:npm/%40${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}@${encodeURIComponent(version)}`;
    }
    return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
  }
  return `pkg:cargo/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

async function collectNpmComponents() {
  const lockfile = await readJson('package-lock.json');
  const rootDependencies = new Set([
    ...Object.keys(lockfile.packages?.['']?.dependencies ?? {}),
    ...Object.keys(lockfile.packages?.['']?.devDependencies ?? {}),
  ]);

  return Object.entries(lockfile.packages ?? {})
    .filter(([packagePath, details]) => packagePath.startsWith('node_modules/') && details.version)
    .map(([packagePath, details]) => {
      const name = packagePath.replace(/^node_modules\//, '');
      const scope = rootDependencies.has(name) ? 'required' : 'optional';
      const component = {
        type: 'library',
        'bom-ref': `npm:${name}@${details.version}`,
        name,
        version: details.version,
        scope,
        purl: packageUrl('npm', name, details.version),
      };

      if (details.license) {
        component.licenses = [{ license: { name: details.license } }];
      }

      return component;
    });
}

async function collectCargoComponents() {
  const lockfile = await readFile(path.join(root, 'src-tauri', 'Cargo.lock'), 'utf8');
  const packageBlocks = lockfile.split(/\n\[\[package\]\]\n/).slice(1);

  return packageBlocks
    .map((block) => {
      const name = block.match(/^name = "(.+)"$/m)?.[1];
      const version = block.match(/^version = "(.+)"$/m)?.[1];
      const checksum = block.match(/^checksum = "(.+)"$/m)?.[1];

      if (!name || !version) {
        return null;
      }

      const component = {
        type: 'library',
        'bom-ref': `cargo:${name}@${version}`,
        name,
        version,
        scope: 'required',
        purl: packageUrl('cargo', name, version),
      };

      if (checksum) {
        component.hashes = [{ alg: 'SHA-256', content: checksum }];
      }

      return component;
    })
    .filter(Boolean);
}

const packageJson = await readJson('package.json');
const npmComponents = await collectNpmComponents();
const cargoComponents = await collectCargoComponents();
const components = [...npmComponents, ...cargoComponents].sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref']));

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${hashText(`${packageJson.name}@${packageJson.version}`).slice(0, 8)}-${hashText(packageJson.name).slice(0, 4)}-${hashText(packageJson.version).slice(0, 4)}-${hashText(root).slice(0, 4)}-${hashText(`${Date.now()}`).slice(0, 12)}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [
      {
        vendor: 'AegisVault',
        name: 'generate-sbom',
        version: packageJson.version,
      },
    ],
    component: {
      type: 'application',
      name: packageJson.name,
      version: packageJson.version,
      purl: `pkg:github/hafgit99/aegis-vault-v6.0@v${packageJson.version}`,
    },
  },
  components,
};

const serialized = `${JSON.stringify(sbom, null, 2)}\n`;

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, serialized, 'utf8');
await writeFile(checksumsPath, `${hashText(serialized)}  aegisvault.cdx.json\n`, 'utf8');

console.log(`Generated CycloneDX SBOM with ${components.length} component(s) in ${outputPath}`);
