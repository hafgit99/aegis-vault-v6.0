import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const defaultChromiumExtensionId = 'fbegblomolojcldifclfljlkddkcdehl';
const extensionId = process.env.AEGISVAULT_CHROMIUM_EXTENSION_ID || process.argv[2] || defaultChromiumExtensionId;
const hostName = 'com.aegisvault.desktop';
const hostBinaryName = process.platform === 'win32'
  ? 'AegisVaultNativeMessagingHost.exe'
  : 'AegisVaultNativeMessagingHost';
const sourceBinaryName = process.platform === 'win32'
  ? 'aegisvault_native_messaging_host.exe'
  : 'aegisvault_native_messaging_host';
const sourceBinaryPath = path.join(root, 'src-tauri', 'target', 'debug', sourceBinaryName);
const stageRoot = path.join(root, 'desktop-autofill-host', process.platform);
const stagedBinaryPath = path.join(stageRoot, hostBinaryName);
const stagedManifestPath = path.join(stageRoot, `${hostName}.json`);
const chromeRegPath = path.join(stageRoot, 'install-chrome-native-host.reg');
const edgeRegPath = path.join(stageRoot, 'install-edge-native-host.reg');
const braveRegPath = path.join(stageRoot, 'install-brave-native-host.reg');
const browserRegistryKeys = [
  ['Chrome', 'Google\\Chrome'],
  ['Edge', 'Microsoft\\Edge'],
  ['Brave', 'BraveSoftware\\Brave-Browser'],
];

function chromeOrigin(id) {
  return `chrome-extension://${id}/`;
}

function registryFile(browserKey) {
  const escapedPath = stagedManifestPath.replaceAll('\\', '\\\\');
  return [
    'Windows Registry Editor Version 5.00',
    '',
    `[HKEY_CURRENT_USER\\Software\\${browserKey}\\NativeMessagingHosts\\${hostName}]`,
    `@="${escapedPath}"`,
    '',
  ].join('\r\n');
}

function shellInstallSnippet(browserKey) {
  return [
    `# ${browserKey} native host registration`,
    `New-Item -Path "HKCU:\\Software\\${browserKey}\\NativeMessagingHosts\\${hostName}" -Force | Out-Null`,
    `Set-ItemProperty -Path "HKCU:\\Software\\${browserKey}\\NativeMessagingHosts\\${hostName}" -Name "(default)" -Value "${stagedManifestPath}"`,
  ].join('\n');
}

async function assertBuiltHost() {
  try {
    const info = await stat(sourceBinaryPath);
    if (!info.isFile() || info.size < 1024) {
      throw new Error('Native host binary is too small.');
    }
  } catch {
    throw new Error(`Native host binary was not found at ${sourceBinaryPath}. Run "npm run desktop:autofill:host:build" first.`);
  }
}

await assertBuiltHost();
await rm(stageRoot, { recursive: true, force: true });
await mkdir(stageRoot, { recursive: true });
await copyFile(sourceBinaryPath, stagedBinaryPath);

const manifestTemplate = JSON.parse(await readFile(path.join(root, 'native-messaging', 'chromium', `${hostName}.json`), 'utf8'));
const manifest = {
  ...manifestTemplate,
  path: stagedBinaryPath,
  allowed_origins: [chromeOrigin(extensionId)],
};
await writeFile(stagedManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

if (process.platform === 'win32') {
  await writeFile(chromeRegPath, registryFile('Google\\Chrome'));
  await writeFile(edgeRegPath, registryFile('Microsoft\\Edge'));
  await writeFile(braveRegPath, registryFile('BraveSoftware\\Brave-Browser'));
  await writeFile(path.join(stageRoot, 'install-native-host.ps1'), [
    '$ErrorActionPreference = "Stop"',
    ...browserRegistryKeys.map(([, browserKey]) => shellInstallSnippet(browserKey)),
    'Write-Host "AegisVault native messaging host registered for Chrome, Edge, and Brave."',
    '',
  ].join('\n'));
}

console.log(`Staged desktop Autofill native host in ${stageRoot}`);
console.log(`- ${path.basename(stagedBinaryPath)}`);
console.log(`- ${path.basename(stagedManifestPath)}`);
if (process.platform === 'win32') {
  console.log(`- ${path.basename(chromeRegPath)}`);
  console.log(`- ${path.basename(edgeRegPath)}`);
  console.log(`- ${path.basename(braveRegPath)}`);
  console.log('- install-native-host.ps1');
}
console.log(`Allowed Chromium extension ID: ${extensionId}`);
