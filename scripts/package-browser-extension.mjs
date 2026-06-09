import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const stageRoot = path.join(root, 'desktop-autofill-extension');
const artifactRoot = path.join(root, 'browser-extension-artifacts');
const artifactBaseNames = {
  chromium: 'aegisvault-autofill-chromium',
  firefox: 'aegisvault-autofill-firefox',
};

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let value = i;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  crcTable[i] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(absolutePath));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

async function createZip(sourceRoot, outputPath) {
  const files = (await listFiles(sourceRoot)).sort((a, b) => a.localeCompare(b));
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime();

  for (const filePath of files) {
    const relativeName = path.relative(sourceRoot, filePath).split(path.sep).join('/');
    const name = Buffer.from(relativeName, 'utf8');
    const data = await readFile(filePath);
    const crc = crc32(data);

    const localHeader = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
    ]);
    localParts.push(localHeader, data);

    const centralHeader = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDirectory.length),
    u32(offset),
    u16(0),
  ]);

  await writeFile(outputPath, Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]));
}

async function packageExtension({ browser, extension }) {
  const sourceRoot = path.join(stageRoot, browser);
  const manifestPath = path.join(sourceRoot, 'manifest.json');
  await stat(manifestPath).catch(() => {
    throw new Error(`Staged ${browser} extension was not found. Run npm run desktop:autofill:extension:stage first.`);
  });

  const outputPath = path.join(artifactRoot, `${artifactBaseNames[browser]}-${process.env.npm_package_version || '0.0.0'}.${extension}`);
  await createZip(sourceRoot, outputPath);
  return outputPath;
}

await rm(artifactRoot, { recursive: true, force: true });
await mkdir(artifactRoot, { recursive: true });

const artifacts = [
  await packageExtension({ browser: 'chromium', extension: 'zip' }),
  await packageExtension({ browser: 'firefox', extension: 'unsigned.xpi' }),
];

const checksums = [];
const manifest = [];
for (const artifactPath of artifacts) {
  const bytes = await readFile(artifactPath);
  const fileName = path.basename(artifactPath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  checksums.push(`${sha256}  ${fileName}`);
  manifest.push({
    fileName,
    sizeBytes: bytes.length,
    sha256,
    installability: fileName.endsWith('.unsigned.xpi')
      ? 'Firefox requires AMO signing before public installation.'
      : 'Chromium package for Chrome Web Store / unpacked validation.',
  });
}

await writeFile(path.join(artifactRoot, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`);
await writeFile(path.join(artifactRoot, 'artifact-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Packaged browser extension artifacts in ${artifactRoot}`);
for (const item of manifest) {
  console.log(`- ${item.fileName} (${item.sizeBytes} bytes)`);
}
